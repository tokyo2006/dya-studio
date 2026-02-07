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
} from "@tabler/icons-react";
import type { ConnectionMethod } from "./DeviceConnection";
import { saveNoticeAcceptance } from "../lib/connectionNoticeStorage";

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
  const isUSB = method === "serial";
  const isBLE = method === "ble";

  const handleAgree = () => {
    saveNoticeAcceptance();
    onAgree();
  };

  return (
    <Dialog.Root open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-md bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] shadow-2xl z-50 p-6 max-h-[90vh] overflow-y-auto">
          {/* Icon */}
          <div className="flex justify-center mb-4">
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
            Connect via {isUSB ? "USB" : "Bluetooth"}
          </Dialog.Title>

          {/* Description */}
          <Dialog.Description className="text-sm text-[var(--color-text-muted)] text-center mb-6">
            Please read the following information before connecting
          </Dialog.Description>

          {/* Data Collection Notice */}
          <div className="glass-card p-4 mb-4">
            <h4 className="text-sm font-medium text-[var(--color-text)] mb-3 flex items-center gap-2">
              <IconAlertCircle
                size={18}
                className="text-[var(--color-text-muted)]"
              />
              Data Collection Notice
            </h4>
            <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
              DYA Studio collects your <strong>keyboard name</strong> for usage
              analysis purposes. However, <strong>no other data</strong> about
              your keyboard configuration, keymap, or settings is sent to any
              server.
            </p>
          </div>

          {/* Connection Guide */}
          <div className="glass-card p-4 mb-6">
            <h4 className="text-sm font-medium text-[var(--color-text)] mb-3 flex items-center gap-2">
              {isUSB && (
                <IconUsb size={18} className="text-[var(--color-text-muted)]" />
              )}
              {isBLE && (
                <IconBluetooth
                  size={18}
                  className="text-[var(--color-text-muted)]"
                />
              )}
              How to Connect
            </h4>
            {isUSB && (
              <ol className="space-y-2 text-sm text-[var(--color-text-secondary)]">
                <li className="flex gap-2">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[var(--color-electric)]/20 text-[var(--color-electric)] text-xs flex items-center justify-center">
                    1
                  </span>
                  <span>Connect your keyboard via USB cable</span>
                </li>
                <li className="flex gap-2">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[var(--color-electric)]/20 text-[var(--color-electric)] text-xs flex items-center justify-center">
                    2
                  </span>
                  <span>
                    Click <strong>&quot;Agree to start&quot;</strong> below
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[var(--color-electric)]/20 text-[var(--color-electric)] text-xs flex items-center justify-center">
                    3
                  </span>
                  <span>
                    Select your keyboard from the browser&apos;s device picker
                  </span>
                </li>
              </ol>
            )}
            {isBLE && (
              <ol className="space-y-2 text-sm text-[var(--color-text-secondary)]">
                <li className="flex gap-2">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[var(--color-neon)]/20 text-[var(--color-neon)] text-xs flex items-center justify-center">
                    1
                  </span>
                  <span>
                    <strong>For iOS users:</strong> Use{" "}
                    <a
                      href="https://apps.apple.com/app/bluefy-web-ble-browser/id1492822055"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[var(--color-neon)] hover:underline"
                    >
                      Bluefy browser
                    </a>{" "}
                    (Web Bluetooth support)
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[var(--color-neon)]/20 text-[var(--color-neon)] text-xs flex items-center justify-center">
                    2
                  </span>
                  <span>
                    Press the <strong>studio unlock</strong> key combination on
                    your keyboard to make it discoverable
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[var(--color-neon)]/20 text-[var(--color-neon)] text-xs flex items-center justify-center">
                    3
                  </span>
                  <span>
                    Click <strong>&quot;Agree to start&quot;</strong> below
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[var(--color-neon)]/20 text-[var(--color-neon)] text-xs flex items-center justify-center">
                    4
                  </span>
                  <span>
                    Select your keyboard from the browser&apos;s device picker
                  </span>
                </li>
              </ol>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              className="flex-1 btn-ghost border border-[var(--color-border)] flex items-center justify-center gap-2"
              onClick={onCancel}
            >
              <IconX size={18} />
              Cancel
            </button>
            <button
              className="flex-1 btn-electric flex items-center justify-center gap-2"
              onClick={handleAgree}
            >
              <IconCheck size={18} />
              Agree to start
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
