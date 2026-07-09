import { IconLoader2 } from "@tabler/icons-react";

export interface LoadingIndicatorProps {
  /**
   * Already-translated text describing *what* is being loaded, e.g.
   * "Loading behaviors...". Shown next to the spinner.
   */
  label: string;
  /**
   * Number of items loaded so far. Combined with {@link total} to render a
   * determinate progress bar and percentage. Omit for indeterminate loads.
   */
  current?: number;
  /**
   * Total number of items to load. When this is a positive number a progress
   * bar and "current / total · NN%" line are shown; otherwise the indicator is
   * indeterminate (spinner + label only).
   */
  total?: number;
  /**
   * Visual layout:
   * - "card" (default): a standalone glass-card block, for empty/loading page
   *   regions.
   * - "inline": no card chrome, for loading text embedded inside a section.
   */
  variant?: "card" | "inline";
  /** Extra classes for the outer element (typically margins). */
  className?: string;
}

/**
 * Shared loading indicator.
 *
 * Communicates two things consistently across the app:
 * 1. *What* is loading (via {@link LoadingIndicatorProps.label}).
 * 2. *How far* along it is, when the caller can supply a count
 *    ({@link LoadingIndicatorProps.current} / {@link LoadingIndicatorProps.total}) —
 *    e.g. behaviors loaded one-by-one on the keymap tab.
 */
export function LoadingIndicator({
  label,
  current,
  total,
  variant = "card",
  className,
}: LoadingIndicatorProps) {
  const isDeterminate = typeof total === "number" && total > 0;
  const clampedCurrent =
    isDeterminate && typeof current === "number"
      ? Math.min(Math.max(current, 0), total)
      : 0;
  const percent = isDeterminate
    ? Math.round((clampedCurrent / total) * 100)
    : null;

  const spinnerSize = variant === "inline" ? 16 : 20;

  const header = (
    <div
      className={`flex items-center gap-2 ${
        variant === "card" ? "justify-center" : ""
      }`}
    >
      <IconLoader2
        size={spinnerSize}
        className="animate-spin text-[var(--color-electric)] flex-shrink-0"
      />
      <span className="text-sm text-[var(--color-text-muted)]">{label}</span>
    </div>
  );

  const progressBar = isDeterminate && (
    <div
      className={`mt-3 w-full max-w-xs ${variant === "card" ? "mx-auto" : ""}`}
    >
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-border)]"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={clampedCurrent}
      >
        <div
          className="h-full rounded-full bg-[var(--color-electric)] transition-[width] duration-200 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="mt-1.5 text-xs text-[var(--color-text-muted)] tabular-nums">
        {clampedCurrent} / {total} · {percent}%
      </p>
    </div>
  );

  const containerClass =
    variant === "card"
      ? `glass-card p-6 text-center${className ? ` ${className}` : ""}`
      : `flex flex-col${className ? ` ${className}` : ""}`;

  return (
    <div className={containerClass}>
      {header}
      {progressBar}
    </div>
  );
}
