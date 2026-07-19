/**
 * ConnectionNoticeDialog Component
 *
 * A dialog that shows data collection notice and connection guide
 * when user attempts to connect via USB or BLE.
 */
import * as Dialog from "@radix-ui/react-dialog";
import {
  IconAlertCircle,
  IconUsb,
  IconBluetooth,
  IconCheck,
  IconX,
  IconAlertTriangleFilled,
} from "@tabler/icons-react";
import type { ConnectionMethod } from "./DeviceConnection";
import { saveNoticeAcceptance } from "../lib/connectionNoticeStorage";
import { isUsbConnectionAvailable } from "../lib/transport/usb";
import { useCallback, useMemo, useState } from "react";
import { useLanguage } from "../hooks/useLanguage";

interface ConnectionNoticeDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Connection method (USB or BLE) */
  method: ConnectionMethod | null;
  /** Callback when user agrees to connect */
  onAgree: () => void;
  /** Callback when user cancels */
  onCancel: () => void;
}

export function ConnectionNoticeDialog({
  open,
  method,
  onAgree,
  onCancel,
}: ConnectionNoticeDialogProps) {
  const { t } = useLanguage();
  const isUSB = method === "serial";
  const isBLE = method === "ble";
  const isUSBAvailable = useMemo(() => isUsbConnectionAvailable(), []);
  const isBLEAvailable = useMemo(() => "bluetooth" in navigator, []);
  const canContinue = (isUSB && isUSBAvailable) || (isBLE && isBLEAvailable);
  const [neverShowAgain, setNeverShowAgain] = useState(false);

  const handleAgree = useCallback(() => {
    if (neverShowAgain && method) {
      saveNoticeAcceptance(method);
    }
    onAgree();
  }, [neverShowAgain, onAgree, method]);

  return (
    <Dialog.Root open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-md bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] shadow-2xl z-50 p-6 max-h-[90vh] overflow-y-auto">
          {/* Icon */}
          <div className="hidden tablet:flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-[var(--color-electric)]/10 border border-[var(--color-electric)]/20 flex items-center justify-center">
              {isUSB && (
                <IconUsb size={32} className="text-[var(--color-electric)]" />
              )}
              {isBLE && (
                <IconBluetooth size={32} className="text-[var(--color-neon)]" />
              )}
            </div>
          </div>

          {/* Title */}
          <Dialog.Title className="text-lg font-medium text-[var(--color-text)] text-center mb-2">
            {t("Connect via {{method}}", {
              method: isUSB ? "USB" : "Bluetooth",
            })}
          </Dialog.Title>

          {/* Data Collection Notice */}
          {canContinue && (
            <div className="glass-card p-4 mb-4">
              <h4 className="text-sm font-medium text-[var(--color-text)] mb-3 flex items-center gap-2">
                <IconAlertCircle
                  size={18}
                  className="text-[var(--color-text-muted)]"
                />
                {t("Data Collection Notice")}
              </h4>
              <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                {t(
                  "DYA Studio collects your keyboard name and anonymous usage data — such as which features you use, how you connect, and connection errors — for usage analysis. No keymaps, settings, or other keyboard configuration data is ever sent; everything is handled locally on your device.",
                )}
              </p>
            </div>
          )}

          {/* Unavailability Warning */}
          {isBLE && !isBLEAvailable && (
            <div className="glass-card p-4 mb-4 border-l-4 border-[var(--color-warning)] bg-[var(--color-warning)]/10">
              <h4 className="text-sm font-medium text-[var(--color-text)] mb-3 flex items-center gap-2">
                <IconAlertTriangleFilled
                  size={18}
                  className="text-[var(--color-cyber)]"
                />
                {t("BLE Not Supported on your Browser")}
              </h4>
              <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                {t(
                  "Your browser does not support Web Bluetooth API. Please use a compatible browser like Chrome, Edge, or Bluefy (iOS). BLE device discovery on non-Linux system requires cormoran's ZMK fork + press the studio unlock key on your keyboard.",
                )}
                {/* Keep the compatibility reference discoverable. */}
                <a
                  href="https://developer.mozilla.org/docs/Web/API/Web_Bluetooth_API#browser_compatibility"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline mx-1"
                >
                  {t("compatible browser")}
                </a>
              </p>
            </div>
          )}
          {isUSB && !isUSBAvailable && (
            <div className="glass-card p-4 mb-4 border-l-4 border-[var(--color-warning)] bg-[var(--color-warning)]/10">
              <h4 className="text-sm font-medium text-[var(--color-text)] mb-3 flex items-center gap-2">
                <IconAlertTriangleFilled
                  size={18}
                  className="text-[var(--color-cyber)]"
                />
                {t("Serial Not Supported on your Browser")}
              </h4>
              <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                {t(
                  "Your browser does not support Web Serial API. Please use a compatible browser. Note that web serial is not available on mobile devices.",
                )}
                <a
                  href="https://developer.mozilla.org/docs/Web/API/Web_Serial_API#browser_compatibility"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline mx-1"
                >
                  {t("compatible browser")}
                </a>
              </p>
            </div>
          )}

          {/* Connection Guide */}
          {isBLE && isBLEAvailable && (
            <div className="glass-card p-4 mb-6">
              <h4 className="text-sm font-medium text-[var(--color-text)] mb-3 flex items-center gap-2">
                <IconBluetooth
                  size={18}
                  className="text-[var(--color-text-muted)]"
                />
                {t("How to Discover your Keyboard via BLE")}
              </h4>
              <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed mb-2">
                {t(
                  "Press the studio unlock key on your keyboard for non-linux systems.",
                )}
              </p>
              <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                {t(
                  "cormoran's ZMK fork is also required for BLE device discovery on non-Linux systems.",
                )}
              </p>
            </div>
          )}

          {/* Never show again checkbox */}
          {canContinue && (
            <div className="mb-6 flex items-center justify-center">
              <label className="flex items-center gap-2 cursor-pointer text-sm text-[var(--color-text-secondary)]">
                <input
                  type="checkbox"
                  className="accent-[var(--color-electric)]"
                  id="neverShowAgain"
                  checked={neverShowAgain}
                  onChange={(e) => setNeverShowAgain(e.target.checked)}
                />
                {t("Never show again")}
              </label>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              className="flex-1 btn-ghost border border-[var(--color-border)] flex items-center justify-center gap-2"
              onClick={onCancel}
            >
              <IconX size={18} />
              {t("Cancel")}
            </button>
            {canContinue && (
              <button
                className="flex-1 btn-electric flex items-center justify-center gap-2"
                disabled={!canContinue}
                onClick={handleAgree}
              >
                <IconCheck size={18} />
                {t("Agree to start")}
              </button>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
