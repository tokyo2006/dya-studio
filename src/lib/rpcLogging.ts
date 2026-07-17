/**
 * Dev-only debug logging for device RPC traffic.
 *
 * Every request that reaches the keyboard goes through one of two paths:
 * the official `call_rpc` (see {@link useKeymap}, {@link useKeymapSource}) and
 * the custom-subsystem `callRPC`/`call` (see {@link useCustomSubsystem}). This
 * module wraps both so each call logs its request, response, round-trip
 * duration, and encoded byte size — invaluable when debugging slow BLE
 * round-trips, oversized payloads, or a desynced response stream.
 *
 * All of this is gated behind {@link RPC_LOG_ENABLED} (local dev and the
 * dev/preview Cloudflare deployments; off for the production release), so the
 * release bundle gets neither the log noise nor the (tiny) timing overhead:
 * `logRpc` returns the bare `invoke()` promise and Vite tree-shakes the logging
 * branch away. Byte sizes are computed via lazy thunks that only run when
 * logging is enabled.
 */
import {
  call_rpc,
  Request,
  RequestResponse,
} from "@zmkfirmware/zmk-studio-ts-client";
import type {
  CustomNotification,
  CustomSubsystemInfo,
} from "@zmkfirmware/zmk-studio-ts-client/custom";
import type { NotificationSubscription } from "@cormoran/zmk-studio-react-hook";
import { RPC_LOG_ENABLED } from "./viteEnv";

/** Monotonic id so a request line and its response line can be matched even
 * when several BLE calls are in flight at once. */
let rpcSeq = 0;

/** Optional byte-size reporters for a logged RPC. Both are lazy so they never
 * run in the production release (where {@link RPC_LOG_ENABLED} is false). */
export interface LogRpcByteSizes<T> {
  /** Encoded size of the request payload in bytes. */
  request?: () => number | undefined;
  /** Encoded size of the response payload in bytes, given the resolved value. */
  response?: (response: T) => number | undefined;
}

/** Format a byte count for a log line, or `""` when it isn't known. */
function bytesLabel(bytes: number | undefined): string {
  return bytes === undefined ? "" : ` · ${bytes}B`;
}

/**
 * Wrap a single RPC round-trip with request/response/duration/bytes logging.
 *
 * When logging is disabled (the production release) this is a no-op passthrough
 * that just returns `invoke()`. Otherwise it logs `→` when the call starts and
 * `←` (or `✗` on throw) with the elapsed milliseconds when it settles.
 *
 * @param label - Human-readable RPC name, e.g. `keymap.getKeymap` or `custom:cormoran__fast_keymap`
 * @param request - The request payload/message, logged as-is
 * @param invoke - Performs the actual call and resolves with the response
 * @param bytes - Optional lazy reporters for request/response byte sizes
 */
export async function logRpc<T>(
  label: string,
  request: unknown,
  invoke: () => Promise<T>,
  bytes?: LogRpcByteSizes<T>,
): Promise<T> {
  if (!RPC_LOG_ENABLED) return invoke();

  const id = ++rpcSeq;
  const start = performance.now();
  console.debug(
    `[rpc #${id} →] ${label}${bytesLabel(bytes?.request?.())}`,
    request,
  );
  try {
    const response = await invoke();
    const ms = (performance.now() - start).toFixed(1);
    console.debug(
      `[rpc #${id} ←] ${label} · ${ms}ms${bytesLabel(bytes?.response?.(response))}`,
      response,
    );
    return response;
  } catch (err) {
    const ms = (performance.now() - start).toFixed(1);
    console.debug(`[rpc #${id} ✗] ${label} · ${ms}ms`, err);
    throw err;
  }
}

/**
 * Drop-in replacement for `call_rpc` that logs request/response/duration/bytes
 * in dev. Same signature and return type — swap the import at call sites.
 */
export function loggedCallRpc(
  conn: Parameters<typeof call_rpc>[0],
  request: Parameters<typeof call_rpc>[1],
): ReturnType<typeof call_rpc> {
  return logRpc(
    describeOfficialRequest(request),
    request,
    () => call_rpc(conn, request),
    {
      request: () => protoByteLength(Request, request as Request),
      response: (res) => protoByteLength(RequestResponse, res),
    },
  );
}

/** Encoded byte length of a ts-proto message, or `undefined` if encoding
 * fails. Cheap enough to run per-call, but only ever called when logging is on. */
export function protoByteLength<M>(
  codec: { encode: (message: M) => { finish: () => Uint8Array } },
  message: M,
): number | undefined {
  try {
    return codec.encode(message).finish().byteLength;
  } catch {
    return undefined;
  }
}

/**
 * Notifications already logged, so a single device push isn't logged once per
 * subscriber. The library fan-outs the *same* notification object to every
 * registered callback for a given type/subsystem (see `dispatchNotification` /
 * `dispatchCustomNotification` in `useZMKApp`), and several hooks subscribe to
 * the same stream (e.g. `core` from both {@link useKeymap} and {@link usePmw3610}).
 * Keying on object identity lets us log each notification exactly once. Weak so
 * entries are collected with the notification itself.
 */
const loggedNotifications = new WeakSet<object>();

/**
 * Log a single inbound notification pushed from the device, mirroring
 * {@link logRpc} for the unsolicited direction. Unlike an RPC there is no
 * request/response/duration — just the notification payload and, for custom
 * subsystems, its encoded byte size.
 *
 * A no-op in the production release (gated on {@link RPC_LOG_ENABLED}), and
 * deduped by object identity so overlapping subscribers don't double-log.
 *
 * @param label - `core`, `keymap`, or `custom:<identifier>` (see {@link describeCustomNotification})
 * @param notification - The decoded (core/keymap) or raw (custom) notification
 * @param bytes - Optional lazy reporter for the payload byte size
 */
export function logNotification(
  label: string,
  notification: unknown,
  bytes?: () => number | undefined,
): void {
  if (!RPC_LOG_ENABLED) return;

  if (notification && typeof notification === "object") {
    if (loggedNotifications.has(notification)) return;
    loggedNotifications.add(notification);
  }

  console.debug(`[rpc ⇐] ${label}${bytesLabel(bytes?.())}`, notification);
}

/**
 * Derive a notification label from a custom subsystem index, resolving it to
 * `custom:<identifier>` (matching the `custom:<identifier>` label {@link logRpc}
 * uses for outbound calls). Falls back to `custom:#<index>` when the subsystem
 * list is unavailable or the index isn't found — `index` is the device-assigned
 * `CustomSubsystemInfo.index`, not the array position.
 */
export function describeCustomNotification(
  subsystemIndex: number,
  subsystems: readonly CustomSubsystemInfo[] | undefined,
): string {
  const identifier = subsystems?.find(
    (s) => s.index === subsystemIndex,
  )?.identifier;
  return identifier ? `custom:${identifier}` : `custom:#${subsystemIndex}`;
}

/**
 * Wrap an `onNotification` subscriber so every notification it receives is
 * logged via {@link logNotification}. Returns the original function untouched in
 * the production release so there's zero overhead and Vite tree-shakes the
 * logging away.
 *
 * Applied once to the shared `zmkApp` (see {@link DeviceConnectionProvider}) so
 * all current and future subscribers are covered without wrapping each call
 * site; per-notification dedup keeps overlapping subscribers to one line each.
 *
 * @param onNotification - The app's `zmkApp.onNotification`
 * @param describeCustom - Resolves a custom `subsystemIndex` to a label, given
 *   the connected device's subsystem list
 */
export function withLoggedNotifications(
  onNotification: (subscription: NotificationSubscription) => () => void,
  describeCustom: (subsystemIndex: number) => string,
): (subscription: NotificationSubscription) => () => void {
  if (!RPC_LOG_ENABLED) return onNotification;

  return (subscription) => {
    const label =
      subscription.type === "custom"
        ? describeCustom(subscription.subsystemIndex)
        : subscription.type;

    // Rebuild the union member with a wrapped callback. TS can't narrow the
    // callback parameter across the union after the spread, so the cast keeps
    // the discriminant intact while re-typing only the callback.
    const logged = {
      ...subscription,
      callback: (notification: never) => {
        logNotification(
          label,
          notification,
          subscription.type === "custom"
            ? () => (notification as CustomNotification).payload?.byteLength
            : undefined,
        );
        subscription.callback(notification);
      },
    } as NotificationSubscription;

    return onNotification(logged);
  };
}

/** The subsystem oneof fields on an official `Request`, in wire order. */
const REQUEST_SUBSYSTEMS = ["core", "behaviors", "keymap", "custom"] as const;

/**
 * Derive a `subsystem.method` label from an official RPC request, e.g.
 * `{ keymap: { getKeymap: {} } }` → `keymap.getKeymap`. Falls back to just the
 * subsystem, or `unknown`, when the shape is unexpected.
 */
export function describeOfficialRequest(request: unknown): string {
  if (request && typeof request === "object") {
    const req = request as Record<string, unknown>;
    for (const subsystem of REQUEST_SUBSYSTEMS) {
      const body = req[subsystem];
      if (body && typeof body === "object") {
        const method = Object.keys(body)[0];
        return method ? `${subsystem}.${method}` : subsystem;
      }
    }
  }
  return "unknown";
}
