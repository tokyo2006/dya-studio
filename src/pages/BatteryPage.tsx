import { IconBattery2, IconRefresh } from "@tabler/icons-react";
import { useBatteryHistory } from "../hooks/useBatteryHistory";
import { BatteryHistoryChart } from "../components/BatteryHistoryChart";

function getBatteryColor(level: number): string {
  if (level > 75) return "var(--color-neon)";
  if (level > 25) return "var(--color-electric)";
  return "#ef4444"; // red for low battery
}

export function BatteryPage() {
  const { devices, isLoading, error, loadBatteryHistory } = useBatteryHistory();

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
  const lastUpdated = currentLevels.length > 0
    ? new Date(Math.max(...currentLevels.map(d => d.timestamp)) * 1000).toLocaleTimeString()
    : "--:--";

  // Device colors for chart
  const deviceColors = [
    "var(--color-electric)",
    "var(--color-neon)",
    "var(--color-cyber)",
    "#f59e0b", // amber
    "#ec4899", // pink
  ];

  return (
    <div className="p-6 h-full overflow-auto">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2 rounded-lg bg-[var(--color-electric)]/10 border border-[var(--color-electric)]/20">
            <IconBattery2 size={24} className="text-[var(--color-electric)]" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-medium text-[var(--color-text)]">
              Battery Status
            </h1>
            <p className="text-sm text-[var(--color-text-muted)]">
              Monitor battery levels and history
            </p>
          </div>
          <button
            onClick={loadBatteryHistory}
            disabled={isLoading}
            className="btn-ghost flex items-center gap-2"
            aria-label="Refresh battery history"
          >
            <IconRefresh size={16} className={isLoading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

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

        {/* Battery History Charts */}
        <div className="glass-card p-6">
          <h2 className="text-sm font-medium text-[var(--color-text-secondary)] mb-4">
            Battery History
          </h2>
          
          {isLoading && devices.length === 0 ? (
            <div className="h-64 flex items-center justify-center border border-dashed border-[var(--color-border)] rounded-lg">
              <span className="text-[var(--color-text-muted)] text-sm">
                Loading battery history...
              </span>
            </div>
          ) : devices.length === 0 ? (
            <div className="h-64 flex items-center justify-center border border-dashed border-[var(--color-border)] rounded-lg">
              <span className="text-[var(--color-text-muted)] text-sm">
                No battery history available. Connect keyboard to view battery history.
              </span>
            </div>
          ) : (
            <div className="space-y-8">
              {devices.map((device, index) => (
                <BatteryHistoryChart
                  key={device.sourceId}
                  entries={device.entries}
                  deviceName={device.deviceName}
                  color={deviceColors[index % deviceColors.length]}
                />
              ))}
            </div>
          )}
        </div>

        {/* Info Box */}
        <div className="mt-8 p-4 rounded-lg bg-[var(--color-border)] border border-[var(--color-border-hover)]">
          <p className="text-xs text-[var(--color-text-muted)]">
            Battery history is recorded on the keyboard and shows data from all connected devices.
            The timestamp resets when the keyboard restarts, indicated by dashed vertical lines in the chart.
          </p>
        </div>
      </div>
    </div>
  );
}
