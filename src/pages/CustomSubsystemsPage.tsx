import { useContext, useState } from "react";
import {
  IconPuzzle,
  IconExternalLink,
  IconAlertTriangleFilled,
  IconX,
} from "@tabler/icons-react";
import { ZMKAppContext } from "@cormoran/zmk-studio-react-hook";

interface ExternalLinkWarningDialogProps {
  url: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function ExternalLinkWarningDialog({
  url,
  onConfirm,
  onCancel,
}: ExternalLinkWarningDialogProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="external-link-dialog-title"
    >
      <div
        className="glass-card p-6 max-w-md w-full mx-4 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          className="absolute top-4 right-4 btn-ghost p-1"
          onClick={onCancel}
          aria-label="Close dialog"
        >
          <IconX size={16} className="text-[var(--color-text-muted)]" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20">
            <IconAlertTriangleFilled size={24} className="text-red-500" />
          </div>
          <h2
            id="external-link-dialog-title"
            className="text-base font-medium text-[var(--color-text)]"
          >
            External Link Warning
          </h2>
        </div>

        {/* Warning message */}
        <p className="text-sm text-[var(--color-text-secondary)] mb-3">
          You are about to open an external website provided by the keyboard
          firmware author:
        </p>
        <div className="mb-4 px-3 py-2 rounded-lg bg-[var(--color-border)] border border-[var(--color-border-hover)] break-all">
          <span className="text-xs font-mono text-[var(--color-electric)]">
            {url}
          </span>
        </div>
        <div className="mb-6 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
          <p className="text-xs text-red-400 leading-relaxed">
            <strong>Security Notice:</strong> Please do not connect to
            unreliable author&apos;s web page. Only proceed if you trust the
            keyboard firmware author. External pages may request sensitive
            permissions or send data to third-party servers.
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <button className="btn-ghost text-sm" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-500 hover:bg-red-600 transition-colors flex items-center gap-2"
            onClick={onConfirm}
          >
            <IconExternalLink size={16} />
            Open Anyway
          </button>
        </div>
      </div>
    </div>
  );
}

export function CustomSubsystemsPage() {
  const zmkApp = useContext(ZMKAppContext);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);

  const subsystems = zmkApp?.state.customSubsystems?.subsystems ?? [];

  const handleLinkClick = (url: string) => {
    setPendingUrl(url);
  };

  const handleConfirm = () => {
    if (pendingUrl) {
      window.open(pendingUrl, "_blank", "noopener,noreferrer");
    }
    setPendingUrl(null);
  };

  const handleCancel = () => {
    setPendingUrl(null);
  };

  return (
    <div className="p-6 h-full overflow-auto">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2 rounded-lg bg-[var(--color-electric)]/10 border border-[var(--color-electric)]/20">
            <IconPuzzle size={24} className="text-[var(--color-electric)]" />
          </div>
          <div>
            <h1 className="text-xl font-medium text-[var(--color-text)]">
              Custom Subsystems
            </h1>
            <p className="text-sm text-[var(--color-text-muted)]">
              Available custom firmware subsystems and their web interfaces
            </p>
          </div>
        </div>

        {/* Subsystem list */}
        {subsystems.length > 0 ? (
          <div className="space-y-4">
            {subsystems.map((subsystem) => (
              <div key={subsystem.index} className="glass-card p-5">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-[var(--color-cyber)]/10 border border-[var(--color-cyber)]/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-mono text-[var(--color-cyber)]">
                      {subsystem.index}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--color-text)] font-mono break-all">
                      {subsystem.identifier}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                      Subsystem index: {subsystem.index}
                    </p>
                  </div>
                </div>

                {subsystem.uiUrl.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide">
                      Web UI
                    </p>
                    {subsystem.uiUrl.map((url, urlIndex) => (
                      <button
                        key={urlIndex}
                        className="flex items-center gap-2 text-sm text-[var(--color-electric)] hover:text-[var(--color-neon)] transition-colors group w-full text-left"
                        onClick={() => handleLinkClick(url)}
                      >
                        <IconExternalLink
                          size={14}
                          className="flex-shrink-0 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform"
                        />
                        <span className="underline break-all">{url}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[var(--color-text-muted)] mt-2">
                    No web UI available for this subsystem.
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="glass-card p-6">
            <p className="text-sm text-[var(--color-text-muted)]">
              No custom subsystems available. Custom subsystems are provided by
              the keyboard firmware.
            </p>
          </div>
        )}

        {/* Info box */}
        <div className="mt-8 p-4 rounded-lg bg-[var(--color-border)] border border-[var(--color-border-hover)]">
          <p className="text-xs text-[var(--color-text-muted)]">
            Custom subsystems are additional features provided by your keyboard
            firmware author. Web UI links open external pages supplied by the
            firmware metadata.
          </p>
        </div>
      </div>

      {/* External link warning dialog */}
      {pendingUrl && (
        <ExternalLinkWarningDialog
          url={pendingUrl}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}
    </div>
  );
}
