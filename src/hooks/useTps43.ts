import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useCustomSubsystem, useLockAwareCall } from "./useCustomSubsystem";
import {
  useDebouncedMemoryWrite,
  type MemoryWriteState,
} from "./useDebouncedMemoryWrite";
import {
  Request,
  Response,
  type Tps43State,
} from "../proto/tokyo2006/tps43/tps43";

// Registered by tokyo2006/tps43-input-module.
export const TPS43_SUBSYSTEM_IDENTIFIER = "tokyo2006__tps43";

const CODEC = {
  encode: (request: Request) => Request.encode(request).finish(),
  decode: (payload: Uint8Array) => Response.decode(payload),
};

export interface UseTps43Return {
  isAvailable: boolean;
  /** Last state confirmed by the device. */
  state: Tps43State | null;
  /** Device state with not-yet-written edits applied, for display. */
  values: Tps43State | null;
  isLoading: boolean;
  isResetting: boolean;
  error: string | null;
  writeState: MemoryWriteState;
  load: () => Promise<void>;
  /** Queue a debounced, persisted write of the given fields. */
  update: (patch: Tps43State) => void;
  /** Restore firmware defaults (also clears saved settings). */
  reset: () => Promise<boolean>;
}

function errorText(prefix: string, err: unknown): string {
  return `${prefix}: ${err instanceof Error ? err.message : "Unknown error"}`;
}

export function useTps43(): UseTps43Return {
  const {
    subsystem,
    ready,
    call: gatedCall,
  } = useCustomSubsystem(TPS43_SUBSYSTEM_IDENTIFIER, CODEC);
  const [state, setState] = useState<Tps43State | null>(null);
  const [pending, setPending] = useState<Tps43State>({});
  const pendingRef = useRef<Tps43State>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const call = useLockAwareCall(gatedCall, setError);

  const setPendingBoth = useCallback((next: Tps43State) => {
    pendingRef.current = next;
    setPending(next);
  }, []);

  // Drop sent fields unless the user changed them again while in flight.
  const clearSent = useCallback(
    (sent: Tps43State) => {
      const next = { ...pendingRef.current };
      for (const key of Object.keys(sent) as (keyof Tps43State)[]) {
        if (next[key] === sent[key]) delete next[key];
      }
      setPendingBoth(next);
    },
    [setPendingBoth],
  );

  const load = useCallback(async () => {
    if (!ready) return;
    setIsLoading(true);
    setError(null);
    try {
      const resp = await call(Request.create({ getState: {} }));
      if (resp?.getState?.state) {
        setState(resp.getState.state);
      } else if (resp?.error) {
        setError(resp.error.message);
      }
    } catch (err) {
      console.error("Failed to load trackpad state:", err);
      setError(errorText("Failed to load trackpad state", err));
    } finally {
      setIsLoading(false);
    }
  }, [ready, call]);

  const write = useCallback(
    async (patch: Tps43State) => {
      if (!ready) return;
      setError(null);
      let rejected = false;
      try {
        const resp = await call(
          Request.create({ setState: { state: patch, persist: true } }),
        );
        if (resp?.setState?.state) {
          setState(resp.setState.state);
        } else if (resp?.error) {
          setError(resp.error.message);
          rejected = true;
        }
      } catch (err) {
        console.error("Failed to save trackpad settings:", err);
        setError(errorText("Failed to save trackpad settings", err));
        rejected = true;
      } finally {
        clearSent(patch);
      }
      // Firmware applies valid fields even when one fails; resync to show truth.
      if (rejected) {
        try {
          const resp = await call(Request.create({ getState: {} }));
          if (resp?.getState?.state) setState(resp.getState.state);
        } catch (err) {
          console.error("Failed to reload trackpad state:", err);
        }
      }
    },
    [ready, call, clearSent],
  );

  const writer = useDebouncedMemoryWrite<Tps43State>(write);

  const update = useCallback(
    (patch: Tps43State) => {
      const next = { ...pendingRef.current, ...patch };
      setPendingBoth(next);
      writer.queue(next);
    },
    [setPendingBoth, writer],
  );

  const reset = useCallback(async () => {
    if (!ready) return false;
    writer.cancel();
    setPendingBoth({});
    setIsResetting(true);
    setError(null);
    try {
      const resp = await call(
        Request.create({ reset: { factoryDefaults: true } }),
      );
      if (resp?.reset?.state) {
        setState(resp.reset.state);
        return true;
      }
      if (resp?.error) setError(resp.error.message);
      return false;
    } catch (err) {
      console.error("Failed to reset trackpad settings:", err);
      setError(errorText("Failed to reset trackpad settings", err));
      return false;
    } finally {
      setIsResetting(false);
    }
  }, [ready, call, writer, setPendingBoth]);

  useEffect(() => {
    if (ready) {
      load();
    } else {
      writer.cancel();
      setPendingBoth({});
      setState(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const values = useMemo(
    () => (state ? { ...state, ...pending } : null),
    [state, pending],
  );

  return {
    isAvailable: subsystem !== null,
    state,
    values,
    isLoading,
    isResetting,
    error,
    writeState: writer.state,
    load,
    update,
    reset,
  };
}
