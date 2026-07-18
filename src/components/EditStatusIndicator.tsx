import * as Tooltip from "@radix-ui/react-tooltip";
import { useLanguage } from "../hooks/useLanguage";

/**
 * Unified edit-status vocabulary shared by every editing surface (keymap,
 * combo, macro, custom settings, ...). Keeping one enum + one dot component
 * means the green/blue/stock convention looks and reads identically everywhere.
 *
 * - "unsaved"  → value written to keyboard RAM but not yet persisted to flash.
 *               Reverted by Discard. Rendered GREEN (--color-neon).
 * - "modified" → value is persisted but differs from the compile-time default.
 *               Reverted by Reset. Rendered BLUE (--color-electric).
 * - "default"  → persisted value equals the compile-time default. No dot.
 */
export type EditStatus = "unsaved" | "modified" | "default";

const DOT_COLOR: Record<EditStatus, string> = {
  unsaved: "bg-[var(--color-neon)]",
  modified: "bg-[var(--color-electric)]",
  default: "bg-[var(--color-text-muted)]",
};

const TEXT_COLOR: Record<EditStatus, string> = {
  unsaved: "text-[var(--color-neon)]",
  modified: "text-[var(--color-electric)]",
  default: "text-[var(--color-text-muted)]",
};

const DOT_SIZE = {
  sm: "h-1.5 w-1.5",
  md: "h-2 w-2",
} as const;

/** Human-readable label for a status (already translated). */
function useEditStatusLabel(): (status: EditStatus) => string {
  const { t } = useLanguage();
  return (status: EditStatus) => {
    switch (status) {
      case "unsaved":
        return t("Unsaved");
      case "modified":
        return t("Changed from default");
      case "default":
        return t("Default");
    }
  };
}

interface StatusDotProps {
  status: EditStatus;
  /** Dot diameter. Defaults to "sm" (1.5) to match inline label rows. */
  size?: keyof typeof DOT_SIZE;
  /** Render the muted dot for the "default" state. Off by default (no dot). */
  showDefault?: boolean;
  className?: string;
}

/**
 * Small colored dot indicating a value's edit status. Carries its own
 * title/aria-label so it is self-describing next to any label.
 */
export function StatusDot({
  status,
  size = "sm",
  showDefault = false,
  className = "",
}: StatusDotProps) {
  const label = useEditStatusLabel()(status);
  if (status === "default" && !showDefault) {
    return null;
  }
  return (
    <span
      className={`flex-shrink-0 rounded-full ${DOT_SIZE[size]} ${DOT_COLOR[status]} ${className}`}
      title={label}
      aria-label={label}
    />
  );
}

interface StatusBadgeProps {
  status: EditStatus;
  /** Optional override text; defaults to the status label. */
  text?: string;
  size?: keyof typeof DOT_SIZE;
  className?: string;
}

/**
 * Dot + text label, for section headers that summarize a group's status.
 * Renders nothing for the "default" state (nothing worth calling out).
 */
export function StatusBadge({
  status,
  text,
  size = "sm",
  className = "",
}: StatusBadgeProps) {
  const label = useEditStatusLabel()(status);
  if (status === "default") {
    return null;
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs ${TEXT_COLOR[status]} ${className}`}
    >
      <StatusDot status={status} size={size} />
      {text ?? label}
    </span>
  );
}

/**
 * Shared legend explaining the green/blue dot convention. Drop next to a
 * group's controls so users can decode the dots without guessing.
 */
export function EditStatusLegend() {
  const { t } = useLanguage();
  return (
    <Tooltip.Provider delayDuration={200}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <button
            type="button"
            className="inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
          >
            <StatusDot status="unsaved" />
            <StatusDot status="modified" />
            {t("Legend")}
          </button>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            className="px-3 py-2 rounded bg-[var(--color-surface-elevated)] border border-[var(--color-border)] text-xs text-[var(--color-text-secondary)] shadow-lg z-50 max-w-xs"
            sideOffset={5}
          >
            <ul className="space-y-1.5">
              <li className="flex items-center gap-2">
                <StatusDot status="unsaved" />
                {t("Green: in memory, not yet saved. Discard reverts it.")}
              </li>
              <li className="flex items-center gap-2">
                <StatusDot status="modified" />
                {t(
                  "Blue: saved, but changed from the default. Reset restores the default.",
                )}
              </li>
            </ul>
            <Tooltip.Arrow className="fill-[var(--color-surface-elevated)]" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
