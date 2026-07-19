/**
 * Centralized Google Analytics (GA4) event tracking.
 *
 * This is the single place where usage analytics is sent, so what leaves the
 * device is easy to audit against the data-collection notice shown before
 * connecting (see {@link file://../components/ConnectionNoticeDialog.tsx}).
 *
 * Privacy rules for anything added here:
 * - Never send keymaps, settings, or other keyboard configuration data.
 * - Never send device identifiers (serial numbers) or raw error strings, which
 *   can carry device paths / OS identifiers. Bucket errors into coarse reasons
 *   instead (see {@link classifyConnectError}).
 * - Keep parameters to the minimum needed for aggregate usage analysis.
 *
 * When the *categories* of data collected here change, update the notice text
 * and bump `NOTICE_VERSION` in `connectionNoticeStorage.ts` so users re-consent.
 */
import type { ConnectionMethod } from "../components/DeviceConnection";

/** Coarse, non-identifying bucket for a failed connection attempt. */
export type ConnectFailReason =
  | "cancelled"
  | "unsupported"
  | "timeout"
  | "error";

/**
 * Thin guarded wrapper around `gtag`. No-ops when GA isn't loaded (e.g. the
 * script is blocked, or `VITE_GOOGLE_ANALYTICS_ID` is unset in dev builds).
 */
function trackEvent(name: string, params?: Record<string, unknown>): void {
  if (typeof window === "undefined" || !window.gtag) return;
  window.gtag("event", name, params);
}

/** SPA page view, fired on tab navigation. */
export function trackPageView(pageTitle: string, pagePath: string): void {
  trackEvent("page_view", { page_title: pageTitle, page_path: pagePath });
}

/**
 * A keyboard finished connecting. `name` is the device name (already disclosed);
 * `method` records how the user connected for aggregate usage analysis.
 */
export function trackKeyboardConnected(
  method: ConnectionMethod,
  name: string,
): void {
  trackEvent("keyboard_connected", { method, name });
}

/**
 * A connection attempt failed. Only the method and a coarse reason bucket are
 * sent -- never the raw error, which may contain device paths or identifiers.
 */
export function trackConnectFailed(
  method: ConnectionMethod,
  reason: ConnectFailReason,
): void {
  trackEvent("keyboard_connect_failed", { method, reason });
}

/**
 * Map an arbitrary connection error to a coarse, non-identifying reason bucket.
 * Matches on well-known Web Serial / Web Bluetooth error names and messages so
 * the raw string (which can include device paths) is never sent to analytics.
 */
export function classifyConnectError(error: unknown): ConnectFailReason {
  const name =
    typeof error === "object" && error !== null && "name" in error
      ? String((error as { name?: unknown }).name)
      : "";
  const message = (
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : ""
  ).toLowerCase();

  // Web Serial / Web Bluetooth throw these when the user dismisses the browser
  // device picker without choosing a device.
  if (
    name === "NotFoundError" ||
    name === "AbortError" ||
    message.includes("cancel") ||
    message.includes("no device selected") ||
    message.includes("user gesture")
  ) {
    return "cancelled";
  }
  if (name === "NotSupportedError" || message.includes("not supported")) {
    return "unsupported";
  }
  if (
    name === "TimeoutError" ||
    message.includes("timeout") ||
    message.includes("timed out")
  ) {
    return "timeout";
  }
  return "error";
}
