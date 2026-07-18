/**
 * StudioUnlockContext — the single, app-wide gate for "the keyboard is locked".
 *
 * Every feature routes its device requests through {@link useStudioUnlock}'s
 * `runWithUnlock`. When a request fails with a Studio-unlock error the failed
 * operation is *parked* and the shared {@link UnlockPrompt} modal opens; once
 * the user unlocks (auto-detected via `lockStateChanged`, or by clicking Retry)
 * the parked operation is retried and its original promise resolves with the
 * real result — so the caller sees a single awaited call that "just works"
 * after the unlock detour.
 *
 * `requireUnlock` is the proactive counterpart used by editor pages: it opens
 * the same modal *before* sending a doomed request when Studio is already known
 * to be locked.
 *
 * Cancel cooldown: after the user dismisses the modal, further unlock errors
 * are auto-cancelled (no modal) until every unlock-gated request has finished
 * *and* things have stayed quiet for {@link DEFAULT_QUIET_MS}. This keeps a load
 * that fans out into several RPCs — some of which may take a while — from
 * immediately re-popping the modal the user just closed: as long as requests
 * keep arriving the quiet timer restarts, so suppression lasts until the burst
 * settles. An actual unlock clears it.
 */
import type { ReactNode } from "react";
import { createContext, useEffect, useRef, useState } from "react";
import { useStudioLockState } from "@cormoran/zmk-studio-react-hook";
import { UnlockPrompt } from "../components/UnlockPrompt";
import {
  StudioUnlockCancelledError,
  isStudioUnlockError,
} from "../lib/studioUnlock";

/** A request that failed with an unlock error and is awaiting unlock+retry. */
interface ParkedOp {
  /** Re-runs the original request; throws/returns-unlock while still locked. */
  attempt: () => Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
}

export interface StudioUnlockContextValue {
  /**
   * Run `fn` (a device request). If it fails with a Studio-unlock error, open
   * the unlock modal, and after the user unlocks retry `fn` and resolve with
   * its result. Non-unlock errors propagate unchanged. If the user cancels the
   * modal, the returned promise rejects with {@link StudioUnlockCancelledError}.
   */
  runWithUnlock: <T>(fn: () => Promise<T>) => Promise<T>;
  /**
   * Proactive gate for editor actions: if Studio is currently locked, open the
   * unlock modal and return `false` (caller should bail); otherwise `true`.
   */
  requireUnlock: () => boolean;
}

/**
 * How long unlock-gated requests must stay quiet (no request in flight, none
 * arriving) after a Cancel before the modal is allowed to re-open. See file doc.
 */
export const DEFAULT_QUIET_MS = 1_000;

// Default (no provider): a transparent passthrough so hooks that call device
// RPCs still work when rendered outside the provider (e.g. isolated unit
// tests) — they simply don't get the unlock modal. The real gate is supplied
// by StudioUnlockProvider, which wraps the whole app.
const StudioUnlockContext = createContext<StudioUnlockContextValue>({
  runWithUnlock: (fn) => fn(),
  requireUnlock: () => true,
});

export function StudioUnlockProvider({
  children,
  quietMs = DEFAULT_QUIET_MS,
}: {
  children: ReactNode;
  /**
   * Quiet window (ms) after a Cancel before the modal may re-open. Overridable
   * mainly so tests don't have to wait out the real-world default.
   */
  quietMs?: number;
}) {
  const { locked, lockState } = useStudioLockState();

  // Parked ops are held in a ref (not state) so `runWithUnlock`/`requireUnlock`
  // stay referentially stable and don't churn every consumer's useCallback.
  const parkedRef = useRef<ParkedOp[]>([]);
  // True when the proactive gate opened the modal without a parked op.
  const proactiveOpenRef = useRef(false);
  // Cancel cooldown state: `suppressing` is true from a Cancel until things go
  // quiet; `inFlight` counts executing unlock-gated requests; `quietTimer` fires
  // once no request has been in flight for `quietMs`.
  const suppressingRef = useRef(false);
  const inFlightRef = useRef(0);
  const quietTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isOpen, setIsOpen] = useState(false);

  // Plain functions: React Compiler (enabled in this project) handles the
  // memoization, so manual useCallback/useMemo is intentionally omitted.
  const syncOpen = () => {
    setIsOpen(parkedRef.current.length > 0 || proactiveOpenRef.current);
  };

  const clearQuietTimer = () => {
    if (quietTimerRef.current !== null) {
      clearTimeout(quietTimerRef.current);
      quietTimerRef.current = null;
    }
  };

  // While suppressing, (re)arm the quiet timer once nothing is in flight; when
  // it fires with no further activity the cooldown ends and the modal may open
  // again.
  const scheduleQuietTimer = () => {
    clearQuietTimer();
    if (suppressingRef.current && inFlightRef.current === 0) {
      quietTimerRef.current = setTimeout(() => {
        quietTimerRef.current = null;
        suppressingRef.current = false;
      }, quietMs);
    }
  };

  const beginActivity = () => {
    inFlightRef.current += 1;
    // A request in flight means we're not quiet — hold off the timer.
    clearQuietTimer();
  };

  const endActivity = () => {
    inFlightRef.current -= 1;
    scheduleQuietTimer();
  };

  const retryAll = async () => {
    // Snapshot and clear: any op that is still locked re-parks itself below.
    const ops = parkedRef.current;
    parkedRef.current = [];
    proactiveOpenRef.current = false;
    syncOpen();

    await Promise.all(
      ops.map(async (op) => {
        try {
          op.resolve(await op.attempt());
        } catch (err) {
          if (isStudioUnlockError(err)) {
            // Still locked: keep it parked and the modal open.
            parkedRef.current.push(op);
            syncOpen();
          } else {
            op.reject(err);
          }
        }
      }),
    );
  };

  const cancel = () => {
    // Enter the cooldown; arm the quiet timer (nothing may be in flight right
    // now, in which case it starts counting down immediately).
    suppressingRef.current = true;
    scheduleQuietTimer();
    const ops = parkedRef.current;
    parkedRef.current = [];
    proactiveOpenRef.current = false;
    syncOpen();
    for (const op of ops) {
      op.reject(new StudioUnlockCancelledError());
    }
  };

  // On unlock: clear the cancel cooldown (a real unlock supersedes any recent
  // dismissal) and auto-retry any parked requests.
  useEffect(() => {
    if (lockState === "unlocked") {
      suppressingRef.current = false;
      clearQuietTimer();
      if (parkedRef.current.length > 0 || proactiveOpenRef.current) {
        void retryAll();
      }
    }
    // retryAll reads only refs; re-run solely on lock-state transitions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lockState]);

  // Clean up the quiet timer on unmount.
  useEffect(() => {
    return () => {
      if (quietTimerRef.current !== null) {
        clearTimeout(quietTimerRef.current);
      }
    };
  }, []);

  const runWithUnlock = <T,>(fn: () => Promise<T>): Promise<T> => {
    const attempt = async (): Promise<T> => {
      // Count this as in-flight activity so the cancel cooldown knows whether
      // requests are still arriving (each keeps the quiet timer from firing).
      beginActivity();
      try {
        const result = await fn();
        // Normalize a resolved-but-locked response (official reads) into a
        // throw so parking/retry treats both error shapes identically.
        if (isStudioUnlockError(result)) {
          throw result;
        }
        return result;
      } finally {
        endActivity();
      }
    };

    return attempt().catch((err) => {
      if (!isStudioUnlockError(err)) {
        throw err;
      }
      // Cancel cooldown: while suppressing (Cancel pressed, activity not yet
      // quiet for `quietMs`), auto-cancel instead of re-opening the modal.
      if (suppressingRef.current) {
        throw new StudioUnlockCancelledError();
      }
      return new Promise<T>((resolve, reject) => {
        parkedRef.current.push({
          attempt: attempt as () => Promise<unknown>,
          resolve: resolve as (value: unknown) => void,
          reject,
        });
        syncOpen();
      });
    });
  };

  const requireUnlock = (): boolean => {
    if (locked) {
      proactiveOpenRef.current = true;
      syncOpen();
      return false;
    }
    return true;
  };

  return (
    <StudioUnlockContext.Provider value={{ runWithUnlock, requireUnlock }}>
      {children}
      <UnlockPrompt open={isOpen} onClose={cancel} onRetry={retryAll} />
    </StudioUnlockContext.Provider>
  );
}

export { StudioUnlockContext };
