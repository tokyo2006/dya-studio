/**
 * UnlockPrompt Component
 *
 * A dialog that prompts the user to unlock their keyboard
 * when ZMK Studio lock is detected.
 */
import { useTranslation } from "react-i18next";
import * as Dialog from "@radix-ui/react-dialog";
import { IconLock, IconKeyboard, IconRefresh } from "@tabler/icons-react";

interface UnlockPromptProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog should close */
  onClose: () => void;
  /** Callback to retry the operation after unlock */
  onRetry: () => void;
}

export function UnlockPrompt({ open, onClose, onRetry }: UnlockPromptProps) {
  const { t } = useTranslation();
  return (
    <Dialog.Root open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-md bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] shadow-2xl z-50 p-6">
          {/* Icon */}
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-[var(--color-electric)]/10 border border-[var(--color-electric)]/20 flex items-center justify-center">
              <IconLock size={32} className="text-[var(--color-electric)]" />
            </div>
          </div>

          {/* Title */}
          <Dialog.Title className="text-lg font-medium text-[var(--color-text)] text-center mb-2">
            {t("unlockPrompt.keyboardUnlockRequired")}
          </Dialog.Title>

          {/* Description */}
          <Dialog.Description className="text-sm text-[var(--color-text-muted)] text-center mb-6">
            {t("unlockPrompt.keyboardLockedMessage")}
          </Dialog.Description>

          {/* Instructions */}
          <div className="glass-card p-4 mb-6">
            <h4 className="text-sm font-medium text-[var(--color-text)] mb-3 flex items-center gap-2">
              <IconKeyboard
                size={18}
                className="text-[var(--color-text-muted)]"
              />
              {t("unlockPrompt.howToUnlock")}
            </h4>
            <ol className="space-y-2 text-sm text-[var(--color-text-secondary)]">
              <li className="flex gap-2">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[var(--color-electric)]/20 text-[var(--color-electric)] text-xs flex items-center justify-center">
                  1
                </span>
                <span>
                  {t("unlockPrompt.step1")}{" "}
                  <strong>{t("unlockPrompt.studioUnlockKey")}</strong>{" "}
                  {t("unlockPrompt.keyCombination")}
                </span>
              </li>
              <li className="flex gap-2">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[var(--color-electric)]/20 text-[var(--color-electric)] text-xs flex items-center justify-center">
                  2
                </span>
                <span>
                  {t("unlockPrompt.lookForNotification")}
                </span>
              </li>
              <li className="flex gap-2">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[var(--color-electric)]/20 text-[var(--color-electric)] text-xs flex items-center justify-center">
                  3
                </span>
                <span>
                  {t("unlockPrompt.step3")}{" "}
                  <strong>{t("unlockPrompt.retry")}</strong>{" "}
                  {t("unlockPrompt.toContinue")}
                </span>
              </li>
            </ol>
          </div>

          {/* Note */}
          <p className="text-xs text-[var(--color-text-muted)] mb-6 text-center">
            {t("unlockPrompt.unlockKeyCombinationNote")}
          </p>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              className="flex-1 btn-ghost border border-[var(--color-border)]"
              onClick={onClose}
            >
              {t("common.cancel")}
            </button>
            <button
              className="flex-1 btn-electric flex items-center justify-center gap-2"
              onClick={() => {
                onRetry();
              }}
            >
              <IconRefresh size={18} />
              {t("unlockPrompt.retry")}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
