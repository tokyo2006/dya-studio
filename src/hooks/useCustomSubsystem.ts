/**
 * App-wide wrapper around `@cormoran/zmk-studio-react-hook`'s
 * `useCustomSubsystem` that raises the per-RPC timeout for every custom
 * subsystem.
 *
 * Custom-subsystem calls are wrapped in a `withTimeout` (the official
 * `call_rpc` is not), defaulting to 5s. Over slow BLE a single call can exceed
 * that; when it does, the timed-out call abandons the shared RPC mutex
 * mid-read, desyncing the response stream and cascading into "No response"
 * errors across the app. 5s is simply too tight for BLE, so every custom
 * subsystem gets a generous default here. Callers may still pass an explicit
 * `timeout` to override it.
 *
 * All app hooks should import `useCustomSubsystem` from here rather than from
 * the library directly, so the raised timeout applies uniformly.
 *
 * This wrapper also routes every call through the shared Studio-unlock gate
 * ({@link useStudioUnlock}): a call that fails because the subsystem is SECURED
 * and Studio is locked opens the unlock modal and is retried after unlock, so
 * consumers never have to detect the lock state themselves. Background/telemetry
 * hooks that must NOT surface a modal can opt out with `{ unlockGate: false }`.
 */
import { useCallback } from "react";
import {
  useCustomSubsystem as libUseCustomSubsystem,
  type Codec,
  type UseCustomSubsystemReturn,
  type UseCustomSubsystemTypedReturn,
} from "@cormoran/zmk-studio-react-hook";
import { logRpc } from "../lib/rpcLogging";
import { useStudioUnlock } from "./useStudioUnlock";
import { studioLockErrorText } from "../lib/studioUnlock";

/** Default per-RPC timeout (ms) applied to every custom-subsystem call. */
export const DEFAULT_CUSTOM_SUBSYSTEM_TIMEOUT_MS = 30_000;

export interface UseCustomSubsystemOptions {
  /**
   * Route calls through the shared unlock gate (show the unlock modal and retry
   * on an UNLOCK_REQUIRED failure). Defaults to `true`. Set `false` for passive
   * background/telemetry subsystems that should never pop the modal on their own.
   */
  unlockGate?: boolean;
}

export function useCustomSubsystem(
  identifier: string,
): UseCustomSubsystemReturn;
export function useCustomSubsystem<TReq, TRes>(
  identifier: string,
  codec: Codec<TReq, TRes>,
  options?: UseCustomSubsystemOptions,
): UseCustomSubsystemTypedReturn<TReq, TRes>;
export function useCustomSubsystem<TReq, TRes>(
  identifier: string,
  codec?: Codec<TReq, TRes>,
  options?: UseCustomSubsystemOptions,
): UseCustomSubsystemReturn | UseCustomSubsystemTypedReturn<TReq, TRes> {
  const unlockGate = options?.unlockGate ?? true;
  const { runWithUnlock } = useStudioUnlock();

  // The library handles an undefined codec (returns without `call`).
  const base = libUseCustomSubsystem(
    identifier,
    codec as Codec<TReq, TRes>,
  ) as UseCustomSubsystemTypedReturn<TReq, TRes>;

  const baseCallRPC = base.callRPC;
  const baseCall = base.call as
    | UseCustomSubsystemTypedReturn<TReq, TRes>["call"]
    | undefined;

  // Wrap a call in the unlock gate: a locked-subsystem failure opens the unlock
  // modal and retries after unlock. If the user dismisses the modal (or the
  // request lands during the post-cancel cooldown) the promise rejects with
  // StudioUnlockCancelledError, which callers map to a clear "device is locked"
  // message (see studioLockErrorText) instead of a subsystem-specific error.
  const gate = useCallback(
    <T>(run: () => Promise<T>): Promise<T> => {
      if (!unlockGate) return run();
      return runWithUnlock(run);
    },
    [unlockGate, runWithUnlock],
  );

  const callRPC = useCallback<UseCustomSubsystemReturn["callRPC"]>(
    (payload, options) =>
      gate(() =>
        logRpc(
          `custom:${identifier}`,
          payload,
          () =>
            baseCallRPC(payload, {
              timeout: DEFAULT_CUSTOM_SUBSYSTEM_TIMEOUT_MS,
              ...options,
            }),
          {
            request: () => payload.byteLength,
            response: (res) => res?.byteLength,
          },
        ),
      ),
    [gate, baseCallRPC, identifier],
  );

  const call = useCallback(
    (request: TReq, options?: { timeout?: number }) =>
      gate(() => {
        // Reimplement the library's typed call (encode → callRPC → decode)
        // ourselves rather than delegating to `base.call`, so we can log the
        // exact request/response payload sizes; the encode below is the same
        // work `base.call` would do internally, not extra overhead.
        const payload = codec!.encode(request);
        let responseBytes: number | undefined;
        return logRpc(
          `custom:${identifier}`,
          request,
          async () => {
            const responsePayload = await baseCallRPC(payload, {
              timeout: DEFAULT_CUSTOM_SUBSYSTEM_TIMEOUT_MS,
              ...options,
            });
            responseBytes = responsePayload?.byteLength;
            return responsePayload === null
              ? null
              : codec!.decode(responsePayload);
          },
          {
            request: () => payload.byteLength,
            response: () => responseBytes,
          },
        );
      }),
    [gate, baseCallRPC, codec, identifier],
  );

  return baseCall
    ? { subsystem: base.subsystem, ready: base.ready, callRPC, call }
    : { subsystem: base.subsystem, ready: base.ready, callRPC };
}

/**
 * Wrap a gated `call` so a lock/cancel rejection (the user dismissed the unlock
 * modal, or the request landed during the post-cancel cooldown) becomes the
 * shared "device is locked" message plus a `null` result — the same "no
 * response" shape these hooks already treat as a silent no-op. Non-lock errors
 * propagate unchanged. Use this in hooks whose call sites ignore a `null`
 * response; hooks that treat "no response" as an error (or rethrow) instead rely
 * on {@link StudioUnlockCancelledError}'s message being {@link STUDIO_LOCKED_MESSAGE}.
 */
export function useLockAwareCall<TReq, TRes>(
  call: (request: TReq, options?: { timeout?: number }) => Promise<TRes | null>,
  setError: (message: string) => void,
): (request: TReq, options?: { timeout?: number }) => Promise<TRes | null> {
  return useCallback(
    async (request: TReq, options?: { timeout?: number }) => {
      try {
        return await call(request, options);
      } catch (err) {
        const locked = studioLockErrorText(err);
        if (locked !== null) {
          setError(locked);
          return null;
        }
        throw err;
      }
    },
    [call, setError],
  );
}
