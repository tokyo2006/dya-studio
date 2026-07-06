import { useState } from "react";
import {
  IconAlertTriangle,
  IconCircleCheck,
  IconHeartRateMonitor,
  IconRefresh,
  IconTrash,
} from "@tabler/icons-react";
import type { Incident } from "../../proto/cormoran/watchdog/watchdog";
import { IncidentType } from "../../proto/cormoran/watchdog/watchdog";
import type { UseWatchdogReturn } from "../../hooks/useWatchdog";
import { useLanguage } from "../../hooks/useLanguage";
import {
  formatHex,
  formatResetCause,
  formatUptime,
} from "../../lib/troubleshootingFormat";
import {
  NotAvailableNotice,
  SectionCard,
  SectionError,
  SectionSummaryBadge,
} from "./SectionCard";

const MODULE_NAME = "cormoran/zmk-feature-watchdog";
const MODULE_URL = "https://github.com/cormoran/zmk-feature-watchdog";

function incidentTypeLabel(type: IncidentType): string {
  switch (type) {
    case IncidentType.FREEZE:
      return "FREEZE";
    case IncidentType.FATAL:
      return "FATAL";
    case IncidentType.RESET_CAUSE:
      return "RESET_CAUSE";
    default:
      return "UNKNOWN";
  }
}

function incidentTypeBadgeClass(type: IncidentType): string {
  switch (type) {
    case IncidentType.FREEZE:
      return "bg-amber-500/10 border-amber-500/20 text-amber-400";
    case IncidentType.FATAL:
      return "bg-red-500/10 border-red-500/20 text-red-400";
    default:
      return "bg-[var(--color-electric)]/10 border-[var(--color-electric)]/20 text-[var(--color-electric)]";
  }
}

function incidentDetail(incident: Incident): string {
  if (incident.freeze) {
    return `queue: ${incident.freeze.queueName || `#${incident.freeze.channelId}`}`;
  }
  if (incident.fatal) {
    const thread = incident.fatal.threadName
      ? `, thread: ${incident.fatal.threadName}`
      : "";
    return `reason ${incident.fatal.reason}, PC ${formatHex(incident.fatal.pc, 8)}, LR ${formatHex(incident.fatal.lr, 8)}${thread}`;
  }
  if (incident.reset) {
    return formatResetCause(incident.reset.causeBits);
  }
  return "";
}

export function WatchdogSection({ watchdog }: { watchdog: UseWatchdogReturn }) {
  const { t } = useLanguage();
  const {
    isAvailable,
    source,
    setSource,
    status,
    incidents,
    isLoading,
    error,
    refresh,
    deleteOne,
    deleteAll,
  } = watchdog;
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);

  const handleDeleteAll = async () => {
    setShowDeleteAllConfirm(false);
    await deleteAll();
  };

  return (
    <SectionCard
      icon={
        <IconHeartRateMonitor
          size={20}
          className="text-[var(--color-electric)]"
        />
      }
      title={t("Stability (Watchdog)")}
      subtitle={t("Freeze, crash and unexpected reset incidents")}
      summary={
        status && (
          <>
            {incidents.length > 0 ? (
              <SectionSummaryBadge
                tone={incidents.length > 3 ? "red" : "amber"}
              >
                {t("{{count}} incidents", { count: incidents.length })}
              </SectionSummaryBadge>
            ) : (
              <SectionSummaryBadge tone="ok">
                {t("No incidents")}
              </SectionSummaryBadge>
            )}
            {status.recordingStopped && (
              <SectionSummaryBadge tone="red">
                {t("recording paused")}
              </SectionSummaryBadge>
            )}
          </>
        )
      }
      actions={
        isAvailable && (
          <button
            onClick={() => void refresh()}
            disabled={isLoading}
            className="btn-ghost flex items-center gap-2 text-sm"
            aria-label={t("Refresh incidents")}
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
          {/* Source selector */}
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs text-[var(--color-text-muted)]">
              {t("Source")}
            </span>
            {[0, 1].map((s) => (
              <button
                key={s}
                onClick={() => setSource(s)}
                disabled={isLoading}
                className={`px-3 py-1 rounded-lg text-xs border transition-colors ${
                  source === s
                    ? "bg-[var(--color-electric)]/10 border-[var(--color-electric)]/40 text-[var(--color-electric)]"
                    : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-border-hover)]"
                }`}
              >
                {s === 0 ? t("Central") : t("Peripheral {{n}}", { n: s })}
              </button>
            ))}
          </div>

          {error && <SectionError message={error} />}

          {/* Status */}
          {status && (
            <div className="flex flex-wrap gap-4 mb-4 text-xs text-[var(--color-text-secondary)]">
              <span>
                {t("Capacity")}: <strong>{status.capacity}</strong>
              </span>
              <span>
                {t("Stored")}: <strong>{status.stored}</strong>
              </span>
              <span>
                {t("Dropped since boot")}:{" "}
                <strong>{status.droppedSinceBoot}</strong>
              </span>
            </div>
          )}
          {status?.recordingStopped && (
            <div className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-start gap-2">
              <IconAlertTriangle
                size={16}
                className="text-amber-400 flex-shrink-0 mt-0.5"
              />
              <p className="text-xs text-amber-400">
                {t(
                  "Incident storage is full — recording is paused. Delete incidents to resume.",
                )}
              </p>
            </div>
          )}

          {/* Incident table / empty state */}
          {incidents.length === 0 ? (
            <div className="p-4 rounded-lg border border-dashed border-[var(--color-border)] flex items-center gap-2">
              <IconCircleCheck size={18} className="text-green-400" />
              <span className="text-sm text-[var(--color-text-muted)]">
                {t("No incidents recorded — your keyboard looks stable.")}
              </span>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
                      <th className="py-2 pr-3 font-medium">ID</th>
                      <th className="py-2 pr-3 font-medium">{t("Type")}</th>
                      <th className="py-2 pr-3 font-medium">
                        {t("Boot / Uptime")}
                      </th>
                      <th className="py-2 pr-3 font-medium">{t("Detail")}</th>
                      <th className="py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {incidents.map((incident) => (
                      <tr
                        key={incident.id}
                        className="border-b border-[var(--color-border)] last:border-b-0"
                      >
                        <td className="py-2 pr-3 font-mono">{incident.id}</td>
                        <td className="py-2 pr-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded border ${incidentTypeBadgeClass(incident.type)}`}
                          >
                            {incidentTypeLabel(incident.type)}
                          </span>
                        </td>
                        <td className="py-2 pr-3 font-mono">
                          #{incident.bootOrdinal} @{" "}
                          {formatUptime(incident.uptimeS * 1000)}
                        </td>
                        <td className="py-2 pr-3 text-[var(--color-text-secondary)] break-all">
                          {incidentDetail(incident)}
                        </td>
                        <td className="py-2 text-right">
                          <button
                            onClick={() => void deleteOne(incident.id)}
                            disabled={isLoading}
                            className="btn-ghost p-1 text-red-400 hover:text-red-300"
                            aria-label={t("Delete incident {{id}}", {
                              id: incident.id,
                            })}
                          >
                            <IconTrash size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 flex justify-end">
                <button
                  onClick={() => setShowDeleteAllConfirm(true)}
                  disabled={isLoading}
                  className="btn-ghost flex items-center gap-2 text-sm text-red-400 hover:text-red-300"
                >
                  <IconTrash size={14} />
                  {t("Delete all")}
                </button>
              </div>
            </>
          )}

          {/* Delete-all confirm dialog */}
          {showDeleteAllConfirm && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="glass-card p-6 max-w-md mx-4 border-red-500/20 bg-[var(--color-surface)]">
                <div className="flex items-start gap-3 mb-4">
                  <IconAlertTriangle
                    size={24}
                    className="text-red-500 flex-shrink-0 mt-0.5"
                  />
                  <div>
                    <h3 className="text-lg font-medium text-[var(--color-text)] mb-2">
                      {t("Delete all incidents?")}
                    </h3>
                    <p className="text-sm text-[var(--color-text-secondary)] mb-2">
                      {t(
                        "This will permanently delete all recorded incidents from your keyboard.",
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
                    onClick={() => setShowDeleteAllConfirm(false)}
                    disabled={isLoading}
                  >
                    {t("Cancel")}
                  </button>
                  <button
                    className="bg-red-500/20 hover:bg-red-500/30 text-red-400 text-sm px-4 py-2 rounded-lg border border-red-500/40 transition-colors disabled:opacity-50"
                    onClick={() => void handleDeleteAll()}
                    disabled={isLoading}
                  >
                    {t("Delete all")}
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
