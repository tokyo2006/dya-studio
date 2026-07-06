/**
 * Shared formatting helpers for the Troubleshooting page.
 *
 * Ported from zmk-feature-device-info's reference web UI so reset-cause
 * decoding stays consistent between the Device Info and Watchdog sections.
 */

// Zephyr hwinfo reset cause bits (include/zephyr/drivers/hwinfo.h)
const RESET_CAUSE_LABELS: [number, string][] = [
  [1 << 0, "External Pin"],
  [1 << 1, "Software"],
  [1 << 2, "Brownout"],
  [1 << 3, "Power-On"],
  [1 << 4, "Watchdog"],
  [1 << 5, "Debug"],
  [1 << 6, "Security"],
  [1 << 7, "Low Power Wake"],
  [1 << 8, "CPU Lockup"],
  [1 << 9, "Parity Error"],
  [1 << 10, "PLL Error"],
  [1 << 11, "Clock Error"],
  [1 << 12, "Hardware Reset"],
  [1 << 13, "User Reset"],
  [1 << 14, "Temperature"],
];

export function formatResetCause(cause: number): string {
  if (!cause) return "Unknown";
  const labels = RESET_CAUSE_LABELS.filter(([bit]) => cause & bit).map(
    ([, label]) => label,
  );
  return labels.length > 0 ? labels.join(", ") : "Unknown";
}

export function formatUptime(ms: number | bigint): string {
  const totalMs = Number(ms);
  const s = Math.floor(totalMs / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ${h % 24}h ${m % 60}m`;
  if (h > 0) return `${h}h ${m % 60}m ${s % 60}s`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

export function formatHex(value: number, minDigits = 2): string {
  return `0x${value.toString(16).padStart(minDigits, "0")}`;
}
