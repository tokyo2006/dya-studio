/**
 * Registry of custom-subsystem notification decoders, keyed by subsystem
 * identifier, used only by the dev RPC logging ({@link decodeCustomNotification}).
 *
 * A custom-subsystem notification arrives as a raw `Uint8Array` payload — the
 * device doesn't tell the transport which proto it is; each subsystem's hook
 * decodes it with its own `Notification` proto (e.g. {@link usePmw3610},
 * {@link useWatchdog}). The generic logging layer sits below those hooks and has
 * only the payload bytes, so without this map it can only log the raw bytes.
 * This mirrors each hook's `Notification.decode` so the log shows the decoded
 * payload instead.
 *
 * This whole module is referenced only from inside the `RPC_LOG_ENABLED` branch
 * of {@link withLoggedNotifications}; when that flag folds to `false` in the
 * production release, the reference is dead code and Vite tree-shakes this
 * module (and its proto imports) out of the bundle.
 */
import { Notification as WatchdogNotification } from "../proto/cormoran/watchdog/watchdog";
import { Notification as InputStreamNotification } from "../proto/zmk/input_stream/input_stream";
import { Notification as RuntimeInputProcessorNotification } from "../proto/zmk/runtime_input_processor/runtime_input_processor";
import { Notification as CustomSettingsNotification } from "../proto/cormoran/zmk/custom_settings/custom_settings";
import { Notification as SettingsNotification } from "../proto/zmk/settings/core";
import { Notification as Pmw3610Notification } from "../proto/cormoran/pmw3610/pmw3610";
import { Notification as DevtoolNotification } from "../proto/cormoran/devtool/devtool";

/**
 * Notification decoders per subsystem identifier. Each identifier matches the
 * one its hook passes to `useCustomSubsystem`, and each decoder is that hook's
 * own `Notification` proto (see the corresponding `use*` hook). Identifiers
 * absent here (or notifications that fail to decode) fall back to raw-byte
 * logging.
 */
const CUSTOM_NOTIFICATION_DECODERS: Record<
  string,
  (payload: Uint8Array) => unknown
> = {
  cormoran__watchdog: (payload) => WatchdogNotification.decode(payload),
  zmk__input_stream: (payload) => InputStreamNotification.decode(payload),
  cormoran_rip: (payload) => RuntimeInputProcessorNotification.decode(payload),
  cormoran_custom_settings: (payload) =>
    CustomSettingsNotification.decode(payload),
  zmk__settings: (payload) => SettingsNotification.decode(payload),
  cormoran__pmw3610: (payload) => Pmw3610Notification.decode(payload),
  cormoran__devtool: (payload) => DevtoolNotification.decode(payload),
};

/**
 * Decode a custom-subsystem notification payload for logging, or `undefined`
 * when the subsystem has no registered decoder (unknown identifier) or the
 * payload fails to decode — in which case the caller logs the raw bytes.
 *
 * @param identifier - The subsystem identifier (e.g. `cormoran__watchdog`), or
 *   `undefined` when the index couldn't be resolved to one
 * @param payload - The raw notification payload bytes
 */
export function decodeCustomNotification(
  identifier: string | undefined,
  payload: Uint8Array | undefined,
): unknown {
  if (identifier === undefined || payload === undefined) return undefined;
  const decode = CUSTOM_NOTIFICATION_DECODERS[identifier];
  if (!decode) return undefined;
  try {
    return decode(payload);
  } catch {
    return undefined;
  }
}
