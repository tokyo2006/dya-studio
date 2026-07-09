/**
 * Shared formatting helpers for the Troubleshooting page.
 *
 * Ported from zmk-feature-device-info's reference web UI so reset-cause
 * decoding stays consistent between the Device Info and Watchdog sections.
 */

type Translate = (
  key: string,
  params?: Record<string, string | number>,
) => string;

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

export function formatResetCause(cause: number, t: Translate): string {
  if (!cause) return t("Unknown");
  const labels = RESET_CAUSE_LABELS.filter(([bit]) => cause & bit).map(
    ([, label]) => t(label),
  );
  return labels.length > 0 ? labels.join(", ") : t("Unknown");
}

// Zephyr k_fatal_error_reason codes (include/zephyr/fatal_types.h), plus the
// ARM Cortex-M/R architecture-specific codes appended from K_ERR_ARCH_START
// (include/zephyr/arch/arm/arch.h). ZMK boards are all ARM Cortex-M, so this
// covers the values firmware can actually report.
const FATAL_REASON_LABELS: Record<number, string> = {
  0: "CPU exception",
  1: "Spurious interrupt",
  2: "Stack overflow (corruption detected)",
  3: "Kernel oops",
  4: "Kernel panic",
  16: "Memory fault",
  17: "Memory fault while stacking",
  18: "Memory fault while unstacking",
  19: "Memory fault: data access",
  20: "Memory fault: instruction access",
  21: "Memory fault: FP lazy state preservation",
  22: "Bus fault",
  23: "Bus fault while stacking",
  24: "Bus fault while unstacking",
  25: "Bus fault: precise data bus error",
  26: "Bus fault: imprecise data bus error",
  27: "Bus fault: instruction bus error",
  28: "Bus fault: FP lazy state preservation",
  29: "Usage fault",
  30: "Usage fault: division by zero",
  31: "Usage fault: unaligned access",
  32: "Usage fault: stack overflow",
  33: "Usage fault: no coprocessor",
  34: "Usage fault: illegal EXC_RETURN",
  35: "Usage fault: illegal EPSR state",
  36: "Usage fault: undefined instruction",
  37: "Secure fault",
  38: "Secure fault: entry point",
  39: "Secure fault: integrity signature",
  40: "Secure fault: exception return",
  41: "Secure fault: attribution unit",
  42: "Secure fault: transition",
  43: "Secure fault: lazy state preservation",
  44: "Secure fault: lazy state error",
  45: "Undefined instruction",
  46: "Alignment fault",
  47: "Background fault",
  48: "Permission fault",
  49: "Synchronous external abort",
  50: "Asynchronous external abort",
  51: "Synchronous parity error",
  52: "Asynchronous parity error",
  53: "Debug event",
  54: "Translation fault",
  55: "Unsupported exclusive access fault",
};

export function formatFatalReason(reason: number, t: Translate): string {
  const label = FATAL_REASON_LABELS[reason];
  return `${label ? t(label) : t("Unknown fault")} (${reason})`;
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
