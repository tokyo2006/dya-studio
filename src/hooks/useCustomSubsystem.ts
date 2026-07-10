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
 */
import { useCallback } from "react";
import {
  useCustomSubsystem as libUseCustomSubsystem,
  type Codec,
  type UseCustomSubsystemReturn,
  type UseCustomSubsystemTypedReturn,
} from "@cormoran/zmk-studio-react-hook";

/** Default per-RPC timeout (ms) applied to every custom-subsystem call. */
export const DEFAULT_CUSTOM_SUBSYSTEM_TIMEOUT_MS = 30_000;

export function useCustomSubsystem(
  identifier: string,
): UseCustomSubsystemReturn;
export function useCustomSubsystem<TReq, TRes>(
  identifier: string,
  codec: Codec<TReq, TRes>,
): UseCustomSubsystemTypedReturn<TReq, TRes>;
export function useCustomSubsystem<TReq, TRes>(
  identifier: string,
  codec?: Codec<TReq, TRes>,
): UseCustomSubsystemReturn | UseCustomSubsystemTypedReturn<TReq, TRes> {
  // The library handles an undefined codec (returns without `call`).
  const base = libUseCustomSubsystem(
    identifier,
    codec as Codec<TReq, TRes>,
  ) as UseCustomSubsystemTypedReturn<TReq, TRes>;

  const baseCallRPC = base.callRPC;
  const baseCall = base.call as
    | UseCustomSubsystemTypedReturn<TReq, TRes>["call"]
    | undefined;

  const callRPC = useCallback<UseCustomSubsystemReturn["callRPC"]>(
    (payload, options) =>
      baseCallRPC(payload, {
        timeout: DEFAULT_CUSTOM_SUBSYSTEM_TIMEOUT_MS,
        ...options,
      }),
    [baseCallRPC],
  );

  const call = useCallback(
    (request: TReq, options?: { timeout?: number }) =>
      baseCall!(request, {
        timeout: DEFAULT_CUSTOM_SUBSYSTEM_TIMEOUT_MS,
        ...options,
      }),
    [baseCall],
  );

  return baseCall
    ? { subsystem: base.subsystem, ready: base.ready, callRPC, call }
    : { subsystem: base.subsystem, ready: base.ready, callRPC };
}
