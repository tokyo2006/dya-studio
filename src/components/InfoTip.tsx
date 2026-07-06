import * as Tooltip from "@radix-ui/react-tooltip";
import { IconInfoCircle } from "@tabler/icons-react";
import { useLanguage } from "../hooks/useLanguage";

interface InfoTipProps {
  /** Tooltip body text (already translated). */
  text: string;
}

/**
 * Small info icon that reveals a short explanation on hover/focus.
 * Used next to labels that need a denser explanation than a caption.
 */
export function InfoTip({ text }: InfoTipProps) {
  const { t } = useLanguage();
  return (
    <Tooltip.Provider delayDuration={200}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <button
            type="button"
            className="btn-ghost p-0.5 opacity-60 hover:opacity-100 align-middle"
            aria-label={t("More info")}
          >
            <IconInfoCircle size={14} />
          </button>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            className="px-3 py-2 rounded bg-[var(--color-surface-elevated)] border border-[var(--color-border)] text-xs text-[var(--color-text-secondary)] shadow-lg z-50 max-w-xs"
            sideOffset={5}
          >
            {text}
            <Tooltip.Arrow className="fill-[var(--color-surface-elevated)]" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
