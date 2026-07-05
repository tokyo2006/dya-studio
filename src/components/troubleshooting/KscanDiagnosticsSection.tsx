import { useState } from "react";
import {
  IconAlertTriangle,
  IconCircleCheck,
  IconExternalLink,
  IconKeyboard,
  IconRefresh,
} from "@tabler/icons-react";
import { KscanDriverType } from "../../proto/cormoran/kscan_diagnostics/kscan_diagnostics";
import type { UseKscanDiagnosticsReturn } from "../../hooks/useKscanDiagnostics";
import { useLanguage } from "../../hooks/useLanguage";
import { findSuspectKeys } from "../../lib/troubleshootingReport";
import { formatUptime } from "../../lib/troubleshootingFormat";
import { NotAvailableNotice, SectionCard, SectionError } from "./SectionCard";

const MODULE_NAME = "cormoran/zmk-feature-kscan-diagnostics";
const MODULE_URL = "https://github.com/cormoran/zmk-feature-kscan-diagnostics";
const DEEP_DIAGNOSIS_URL =
  "https://cormoran.github.io/zmk-feature-kscan-diagnostics/";

function driverTypeLabel(type: KscanDriverType): string {
  switch (type) {
    case KscanDriverType.MATRIX:
      return "MATRIX";
    case KscanDriverType.DIRECT:
      return "DIRECT";
    case KscanDriverType.CHARLIEPLEX:
      return "CHARLIEPLEX";
    case KscanDriverType.DEMUX:
      return "DEMUX";
    case KscanDriverType.MOCK:
      return "MOCK";
    default:
      return "UNKNOWN";
  }
}

export function KscanDiagnosticsSection({
  kscan,
}: {
  kscan: UseKscanDiagnosticsReturn;
}) {
  const { t } = useLanguage();
  const {
    isAvailable,
    info,
    devices,
    stats,
    isLoading,
    error,
    refresh,
    resetStats,
  } = kscan;
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const suspectKeys = findSuspectKeys(stats);
  const totalPresses = stats.reduce((sum, s) => sum + s.presses, 0);

  const handleResetStats = async () => {
    setShowResetConfirm(false);
    await resetStats();
  };

  return (
    <SectionCard
      icon={<IconKeyboard size={20} className="text-[var(--color-electric)]" />}
      title={t("Key Switches")}
      subtitle={t("Key press statistics and chatter detection")}
      actions={
        isAvailable && (
          <button
            onClick={() => void refresh()}
            disabled={isLoading}
            className="btn-ghost flex items-center gap-2 text-sm"
            aria-label={t("Refresh key switch statistics")}
          >
            <IconRefresh
              size={14}
              className={isLoading ? "animate-spin" : ""}
            />
            {t("Refresh")}
          </button>
        )
      }
    >
      {!isAvailable ? (
        <NotAvailableNotice module={MODULE_NAME} moduleUrl={MODULE_URL} />
      ) : (
        <>
          {error && <SectionError message={error} />}

          {info && (
            <div className="flex flex-wrap gap-4 mb-4 text-xs text-[var(--color-text-secondary)]">
              <span>
                {t("Devices")}: <strong>{info.deviceCount}</strong>
              </span>
              <span>
                {t("Statistics")}:{" "}
                <strong>
                  {info.statsEnabled ? t("Enabled") : t("Disabled")}
                </strong>
              </span>
              <span>
                {t("Uptime")}: <strong>{formatUptime(info.uptimeMs)}</strong>
              </span>
              {info.statsEnabled && (
                <span>
                  {t("Total presses")}: <strong>{totalPresses}</strong>
                </span>
              )}
            </div>
          )}

          {/* Devices */}
          {devices.map((device) => (
            <div
              key={device.deviceIndex}
              className="mb-3 p-3 rounded-lg bg-[var(--color-border)]/50 border border-[var(--color-border)] text-xs text-[var(--color-text-secondary)]"
            >
              <span className="font-mono text-[var(--color-text)]">
                {device.nodeName}
              </span>{" "}
              — {driverTypeLabel(device.type)}, {device.rows}×{device.columns},{" "}
              {t("debounce {{press}}/{{release}}ms", {
                press: device.debouncePressMs,
                release: device.debounceReleaseMs,
              })}
              {device.pollPeriodMs > 0 &&
                `, ${t("poll {{ms}}ms", { ms: device.pollPeriodMs })}`}
            </div>
          ))}

          {/* Suspect keys */}
          {info?.statsEnabled &&
            (suspectKeys.length === 0 ? (
              <div className="p-4 rounded-lg border border-dashed border-[var(--color-border)] flex items-center gap-2">
                <IconCircleCheck size={18} className="text-green-400" />
                <span className="text-sm text-[var(--color-text-muted)]">
                  {t("No chatter or anomalies detected.")}
                </span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <p className="text-xs text-[var(--color-text-muted)] mb-2">
                  {t(
                    "Suspect keys (possible chatter or stuck switch) — position numbers follow the keymap order.",
                  )}
                </p>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
                      <th className="py-2 pr-3 font-medium">{t("Position")}</th>
                      <th className="py-2 pr-3 font-medium">{t("Presses")}</th>
                      <th className="py-2 pr-3 font-medium">{t("Releases")}</th>
                      <th className="py-2 pr-3 font-medium">
                        {t("Min gap (ms)")}
                      </th>
                      <th className="py-2 pr-3 font-medium">&lt;5ms</th>
                      <th className="py-2 pr-3 font-medium">&lt;10ms</th>
                      <th className="py-2 pr-3 font-medium">&lt;20ms</th>
                      <th className="py-2 font-medium">&lt;50ms</th>
                    </tr>
                  </thead>
                  <tbody>
                    {suspectKeys.map((s) => (
                      <tr
                        key={s.position}
                        className="border-b border-[var(--color-border)] last:border-b-0 font-mono"
                      >
                        <td className="py-2 pr-3">{s.position}</td>
                        <td className="py-2 pr-3">{s.presses}</td>
                        <td className="py-2 pr-3">{s.releases}</td>
                        <td className="py-2 pr-3">{s.minRepressGapMs}</td>
                        <td className="py-2 pr-3">{s.repressLt5}</td>
                        <td className="py-2 pr-3">{s.repressLt10}</td>
                        <td className="py-2 pr-3">{s.repressLt20}</td>
                        <td className="py-2">{s.repressLt50}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}

          {/* Footer actions */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <a
              href={DEEP_DIAGNOSIS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-[var(--color-electric)] hover:text-[var(--color-neon)] underline transition-colors"
            >
              <IconExternalLink size={14} />
              {t("Open the dedicated diagnostics UI for deep analysis")}
            </a>
            {info?.statsEnabled && (
              <button
                onClick={() => setShowResetConfirm(true)}
                disabled={isLoading}
                className="btn-ghost flex items-center gap-2 text-sm text-red-400 hover:text-red-300"
              >
                {t("Reset statistics")}
              </button>
            )}
          </div>

          {/* Reset confirm dialog */}
          {showResetConfirm && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="glass-card p-6 max-w-md mx-4 border-red-500/20 bg-[var(--color-surface)]">
                <div className="flex items-start gap-3 mb-4">
                  <IconAlertTriangle
                    size={24}
                    className="text-red-500 flex-shrink-0 mt-0.5"
                  />
                  <div>
                    <h3 className="text-lg font-medium text-[var(--color-text)] mb-2">
                      {t("Reset key statistics?")}
                    </h3>
                    <p className="text-sm text-[var(--color-text-secondary)] mb-2">
                      {t(
                        "This will reset all key press statistics recorded on your keyboard.",
                      )}
                    </p>
                    <p className="text-sm text-[var(--color-text-muted)]">
                      {t("This action cannot be undone.")}
                    </p>
                  </div>
                </div>
                <div className="flex gap-3 justify-end">
                  <button
                    className="btn-ghost text-sm px-4 py-2"
                    onClick={() => setShowResetConfirm(false)}
                    disabled={isLoading}
                  >
                    {t("Cancel")}
                  </button>
                  <button
                    className="bg-red-500/20 hover:bg-red-500/30 text-red-400 text-sm px-4 py-2 rounded-lg border border-red-500/40 transition-colors disabled:opacity-50"
                    onClick={() => void handleResetStats()}
                    disabled={isLoading}
                  >
                    {t("Reset statistics")}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </SectionCard>
  );
}
