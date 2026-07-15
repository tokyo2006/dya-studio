/**
 * Dev-only debug logging for device RPC traffic.
 *
 * Every request that reaches the keyboard goes through one of two paths:
 * the official `call_rpc` (see {@link useKeymap}, {@link useKeymapSource}) and
 * the custom-subsystem `callRPC`/`call` (see {@link useCustomSubsystem}). This
 * module wraps both so each call logs its request, response, and round-trip
 * duration to the console — invaluable when debugging slow BLE round-trips or a
 * desynced response stream.
 *
 * All of this is gated behind {@link RPC_LOG_ENABLED} (local dev and the
 * dev/preview Cloudflare deployments; off for the production release), so the
 * release bundle gets neither the log noise nor the (tiny) timing overhead:
 * `logRpc` returns the bare `invoke()` promise and Vite tree-shakes the logging
 * branch away.
 */
import { call_rpc } from "@zmkfirmware/zmk-studio-ts-client";
import { RPC_LOG_ENABLED } from "./viteEnv";

/** Monotonic id so a request line and its response line can be matched even
 * when several BLE calls are in flight at once. */
let rpcSeq = 0;

/**
 * Wrap a single RPC round-trip with request/response/duration logging.
 *
 * When logging is disabled (the production release) this is a no-op passthrough
 * that just returns `invoke()`. Otherwise it logs `→` when the call starts and
 * `←` (or `✗` on throw) with the elapsed milliseconds when it settles.
 *
 * @param label - Human-readable RPC name, e.g. `keymap.getKeymap` or `custom:cormoran__fast_keymap`
 * @param request - The request payload/message, logged as-is
 * @param invoke - Performs the actual call and resolves with the response
 */
export async function logRpc<T>(
  label: string,
  request: unknown,
  invoke: () => Promise<T>,
): Promise<T> {
  if (!RPC_LOG_ENABLED) return invoke();

  const id = ++rpcSeq;
  const start = performance.now();
  console.debug(`[rpc #${id} →] ${label}`, request);
  try {
    const response = await invoke();
    const ms = (performance.now() - start).toFixed(1);
    console.debug(`[rpc #${id} ←] ${label} · ${ms}ms`, response);
    return response;
  } catch (err) {
    const ms = (performance.now() - start).toFixed(1);
    console.debug(`[rpc #${id} ✗] ${label} · ${ms}ms`, err);
    throw err;
  }
}

/**
 * Drop-in replacement for `call_rpc` that logs request/response/duration in
 * dev. Same signature and return type — swap the import at call sites.
 */
export function loggedCallRpc(
  conn: Parameters<typeof call_rpc>[0],
  request: Parameters<typeof call_rpc>[1],
): ReturnType<typeof call_rpc> {
  return logRpc(describeOfficialRequest(request), request, () =>
    call_rpc(conn, request),
  );
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
