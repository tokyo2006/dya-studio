import {
  IconBattery2,
  IconRefresh,
  IconTrash,
  IconAlertTriangle,
  IconAlertTriangleFilled,
} from "@tabler/icons-react";
import { useState } from "react";
import { useBatteryHistory } from "../hooks/useBatteryHistory";
import { BatteryHistoryChart } from "../components/BatteryHistoryChart";

function getBatteryColor(level: number): string {
  if (level > 75) return "var(--color-neon)";
  if (level > 25) return "var(--color-electric)";
  return "#ef4444"; // red for low battery
}

export function BatteryPage() {
  const {
    isAvailable,
    devices,
    isLoading,
    error,
    loadBatteryHistory,
    clearBatteryHistory,
  } = useBatteryHistory();
  const [showClearWarning, setShowClearWarning] = useState(false);

  // Get current battery levels from the latest entry of each device
  const currentLevels = devices.map((device) => {
    const lastEntry = device.entries[device.entries.length - 1];
    return {
      deviceName: device.deviceName,
      level: lastEntry?.batteryLevel ?? 0,
      timestamp: lastEntry?.timestamp ?? 0,
    };
  });

  // Format last updated time
  const lastUpdated =
    currentLevels.length > 0
      ? new Date(
          Math.max(...currentLevels.map((d) => d.timestamp)) * 1000,
        ).toLocaleTimeString()
      : "--:--";

  // Device colors for chart
  const deviceColors = [
    "var(--color-electric)",
    "var(--color-neon)",
    "var(--color-cyber)",
    "#f59e0b", // amber
    "#ec4899", // pink
  ];

  const handleClearHistory = async () => {
    await clearBatteryHistory();
    setShowClearWarning(false);
  };

  const cancelClearHistory = () => {
    setShowClearWarning(false);
  };

  return (
    <div className="p-6 h-full overflow-auto">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex flex-col tablet:flex-row tablet:items-center gap-3 mb-8">
          <div className="flex items-center gap-3 flex-1">
            <div className="p-2 rounded-lg bg-[var(--color-electric)]/10 border border-[var(--color-electric)]/20">
              <IconBattery2
                size={24}
                className="text-[var(--color-electric)]"
              />
            </div>
            <div>
              <h1 className="text-xl font-medium text-[var(--color-text)]">
                Battery Status
              </h1>
              <p className="text-sm text-[var(--color-text-muted)]">
                Monitor battery levels and history
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={loadBatteryHistory}
              disabled={isLoading}
              className="btn-ghost flex items-center gap-2"
              aria-label="Refresh battery history"
            >
              <IconRefresh
                size={16}
                className={isLoading ? "animate-spin" : ""}
              />
              Refresh
            </button>
            <button
              onClick={() => setShowClearWarning(true)}
              disabled={isLoading || devices.length === 0}
              className="btn-ghost flex items-center gap-2 text-red-400 hover:text-red-300 disabled:opacity-50"
              aria-label="Clear battery history"
            >
              <IconTrash size={16} />
              Clear History
            </button>
          </div>
        </div>
        {!isAvailable && !isLoading && !error && (
          <div className="mb-6 p-4 rounded-lg bg-[var(--color-border)] border border-[var(--color-border-hover)] flex items-start gap-3">
            <div className="p-2">
              <IconAlertTriangleFilled size={24} className="text-red-500" />
            </div>
            <p className="text-sm text-[var(--color-text-muted)]">
              Battery history subsystem is not available for your keyboard.
              <br />
              Make sure your firmware has the
              <a
                href="https://github.com/cormoran/zmk-module-battery-history"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--color-electric)] underline mx-1"
              >
                cormoran/zmk-module-battery-history
              </a>
              enabled.
            </p>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="mb-4 p-4 rounded-lg bg-red-500/10 border border-red-500/20">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Current Battery Levels */}
        <div className="grid grid-cols-1 tablet:grid-cols-3 gap-4 mb-8">
          {currentLevels.length > 0 ? (
            <>
              {currentLevels.map((device, index) => (
                <div key={index} className="glass-card data-card">
                  <span className="data-card-label">{device.deviceName}</span>
                  <span
                    className="data-card-value"
                    style={{ color: getBatteryColor(device.level) }}
                  >
                    {device.level}%
                  </span>
                </div>
              ))}
              <div className="glass-card data-card">
                <span className="data-card-label">Last Updated</span>
                <span className="data-card-value text-lg">{lastUpdated}</span>
              </div>
            </>
          ) : (
            <>
              <div className="glass-card data-card">
                <span className="data-card-label">Central</span>
                <span className="data-card-value text-[var(--color-text-muted)]">
                  ---%
                </span>
              </div>
              <div className="glass-card data-card">
                <span className="data-card-label">Peripheral</span>
                <span className="data-card-value text-[var(--color-text-muted)]">
                  ---%
                </span>
              </div>
              <div className="glass-card data-card">
                <span className="data-card-label">Last Updated</span>
                <span className="data-card-value text-lg">--:--</span>
              </div>
            </>
          )}
        </div>

        {/* Battery History Chart */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-[var(--color-text-secondary)]">
              Battery History
            </h2>

            {
              <div className="flex flex-wrap gap-2 items-center">
                {devices
                  .filter((dev) => dev.totalEntries != dev.entries.length)
                  .map((dev) => (
                    <span
                      key={dev.deviceName}
                      className="flex items-center gap-1 px-2 py-1 rounded bg-[var(--color-border)] text-xs text-[var(--color-text-muted)]"
                    >
                      {!dev.lastEntryLoaded && (
                        <>
                          <svg
                            className="animate-spin h-4 w-4 text-[var(--color-electric)]"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                              fill="none"
                              opacity="0.2"
                            />
                            <path
                              d="M12 2a10 10 0 0 1 10 10"
                              stroke="currentColor"
                              strokeWidth="4"
                              fill="none"
                            />
                          </svg>
                          Loading
                        </>
                      )}
                      {dev.deviceName} ({dev.entries.length}/{dev.totalEntries})
                    </span>
                  ))}
              </div>
            }
          </div>

          {isLoading && devices.length === 0 ? (
            <div className="h-64 flex items-center justify-center border border-dashed border-[var(--color-border)] rounded-lg">
              <span className="text-[var(--color-text-muted)] text-sm">
                Loading battery history...
              </span>
            </div>
          ) : devices.length === 0 ? (
            <div className="h-64 flex items-center justify-center border border-dashed border-[var(--color-border)] rounded-lg">
              <span className="text-[var(--color-text-muted)] text-sm">
                No battery history available. Connect keyboard to view battery
                history.
              </span>
            </div>
          ) : (
            <BatteryHistoryChart
              devices={devices}
              deviceColors={deviceColors}
            />
          )}
        </div>

        {/* Info Box */}
        <div className="mt-8 p-4 rounded-lg bg-[var(--color-border)] border border-[var(--color-border-hover)]">
          <p className="text-xs text-[var(--color-text-muted)]">
            Battery history is recorded on the keyboard and shows data from all
            connected devices. The timestamp resets when the keyboard restarts,
            indicated by dashed vertical lines in the chart.
          </p>
        </div>

        {/* Clear History Warning Dialog */}
        {showClearWarning && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="glass-card p-6 max-w-md mx-4 border-red-500/20 bg-[var(--color-surface)]">
              <div className="flex items-start gap-3 mb-4">
                <IconAlertTriangle
                  size={24}
                  className="text-red-500 flex-shrink-0 mt-0.5"
                />
                <div>
                  <h3 className="text-lg font-medium text-[var(--color-text)] mb-2">
                    Clear Battery History?
                  </h3>
                  <p className="text-sm text-[var(--color-text-secondary)] mb-2">
                    This will permanently delete all battery history data from
                    your keyboard.
                  </p>
                  <p className="text-sm text-[var(--color-text-muted)]">
                    This action cannot be undone.
                  </p>
                </div>
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  className="btn-ghost text-sm px-4 py-2"
                  onClick={cancelClearHistory}
                  disabled={isLoading}
                >
                  Cancel
                </button>
                <button
                  className="bg-red-500/20 hover:bg-red-500/30 text-red-400 text-sm px-4 py-2 rounded-lg border border-red-500/40 transition-colors disabled:opacity-50"
                  onClick={handleClearHistory}
                  disabled={isLoading}
                >
                  Clear History
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
