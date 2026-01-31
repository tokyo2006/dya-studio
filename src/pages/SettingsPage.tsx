import { useState, useMemo } from "react";
import { IconSettings, IconAlertTriangle } from "@tabler/icons-react";
import { useSettings } from "../hooks/useSettings";

// Helper to format milliseconds to human readable
function formatMs(ms: number): string {
  if (ms === 0) return "Never";
  if (ms < 60000) return `${ms / 1000}s`;
  if (ms < 3600000) return `${ms / 60000}m`;
  return `${ms / 3600000}h`;
}

// Helper to parse human readable to milliseconds
function parseTimeString(value: string): number {
  if (value === "0") return 0;
  const num = parseInt(value);
  if (value.endsWith("s")) return num * 1000;
  if (value.endsWith("m")) return num * 60000;
  if (value.endsWith("h")) return num * 3600000;
  return num;
}

export function SettingsPage() {
  const { devices, isLoading, error, setActivitySettings, resetToDefaults } = useSettings();
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Get central device settings (source 0)
  const centralSettings = useMemo(
    () => devices.find((d) => d.sourceId === 0),
    [devices]
  );

  // Local state for form inputs (initialized from central settings)
  const [idleTimeout, setIdleTimeout] = useState<string>("30000");
  const [sleepTimeout, setSleepTimeout] = useState<string>("900000");

  // Update form values when central settings arrive
  useMemo(() => {
    if (centralSettings) {
      setIdleTimeout(centralSettings.idleMs.toString());
      setSleepTimeout(centralSettings.sleepMs.toString());
    }
  }, [centralSettings]);

  const handleSaveSettings = async () => {
    const idleMs = parseTimeString(idleTimeout);
    const sleepMs = parseTimeString(sleepTimeout);
    await setActivitySettings(idleMs, sleepMs);
  };

  const handleResetToDefaults = async () => {
    await resetToDefaults();
    setShowResetConfirm(false);
  };

  return (
    <div className="p-6 h-full overflow-auto">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2 rounded-lg bg-[var(--color-electric)]/10 border border-[var(--color-electric)]/20">
            <IconSettings size={24} className="text-[var(--color-electric)]" />
          </div>
          <div>
            <h1 className="text-xl font-medium text-[var(--color-text)]">
              Settings
            </h1>
            <p className="text-sm text-[var(--color-text-muted)]">
              Device configuration and power management
            </p>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/30">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Loading State */}
        {isLoading && !centralSettings && (
          <div className="glass-card p-6">
            <p className="text-sm text-[var(--color-text-muted)]">
              Loading settings...
            </p>
          </div>
        )}

        {/* Settings Groups */}
        {centralSettings && (
          <div className="space-y-6">
            {/* Power Management */}
            <div className="glass-card p-6">
              <h3 className="text-sm font-medium text-[var(--color-text)] mb-4">
                Power Management
              </h3>

              {/* Show all devices status */}
              {devices.length > 0 && (
                <div className="mb-6 p-4 rounded-lg bg-[var(--color-border)]">
                  <p className="text-xs font-medium text-[var(--color-text-muted)] mb-2">
                    Current Settings by Device:
                  </p>
                  <div className="space-y-1">
                    {devices.map((device) => (
                      <div
                        key={device.sourceId}
                        className="text-xs text-[var(--color-text-secondary)]"
                      >
                        <span className="font-mono">{device.deviceName}:</span>{" "}
                        Idle: {formatMs(device.idleMs)}, Sleep:{" "}
                        {formatMs(device.sleepMs)}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      Idle Timeout
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      Time before keyboard enters idle mode (0 to disable)
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      className="input-field w-24 text-sm text-center"
                      value={idleTimeout}
                      onChange={(e) => setIdleTimeout(e.target.value)}
                      placeholder="30000"
                    />
                    <span className="text-xs text-[var(--color-text-muted)]">
                      ms
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      Sleep Timeout
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      Time before entering deep sleep (0 to disable)
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      className="input-field w-24 text-sm text-center"
                      value={sleepTimeout}
                      onChange={(e) => setSleepTimeout(e.target.value)}
                      placeholder="900000"
                    />
                    <span className="text-xs text-[var(--color-text-muted)]">
                      ms
                    </span>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    className="btn-electric text-sm"
                    onClick={handleSaveSettings}
                    disabled={isLoading}
                  >
                    {isLoading ? "Saving..." : "Apply to All Devices"}
                  </button>
                </div>
              </div>
            </div>

            {/* Danger Zone */}
            <div className="glass-card p-6 border-red-500/20">
              <h3 className="text-sm font-medium text-red-400 mb-4">
                Danger Zone
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      Reset to Defaults
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      Restore power settings to factory defaults (Idle: 30s,
                      Sleep: 15m)
                    </p>
                  </div>
                  {!showResetConfirm ? (
                    <button
                      className="px-4 py-2 rounded-lg text-sm font-medium text-red-400 border border-red-500/30 hover:bg-red-500/10 transition-colors"
                      onClick={() => setShowResetConfirm(true)}
                      disabled={isLoading}
                    >
                      Reset
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:bg-[var(--color-border)] transition-colors"
                        onClick={() => setShowResetConfirm(false)}
                      >
                        Cancel
                      </button>
                      <button
                        className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-500 hover:bg-red-600 transition-colors flex items-center gap-2"
                        onClick={handleResetToDefaults}
                        disabled={isLoading}
                      >
                        <IconAlertTriangle size={16} />
                        {isLoading ? "Resetting..." : "Confirm Reset"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Info */}
        <div className="mt-8 p-4 rounded-lg bg-[var(--color-border)] border border-[var(--color-border-hover)]">
          <p className="text-xs text-[var(--color-text-muted)]">
            Connect your keyboard to modify settings. Changes apply to all
            devices (central + peripherals). Individual device settings are shown
            for reference only.
          </p>
        </div>
      </div>
    </div>
  );
}
