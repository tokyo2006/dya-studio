/**
 * Demo Battery History Custom Subsystem Handler
 *
 * Provides mock battery history data for demo mode.
 */

import {
  Notification,
  type Request,
  type Response,
  type BatteryHistoryEntry,
} from "../../proto/zmk/battery_history/battery_history";

export const BATTERY_HISTORY_IDENTIFIER = "zmk__battery_history";

/**
 * Generate realistic battery history data
 * Simulates battery drain over time for split keyboard halves
 */
function generateBatteryHistory(
  sourceId: number,
  count: number = 48,
): BatteryHistoryEntry[] {
  const entries: BatteryHistoryEntry[] = [];
  const now = Math.floor(Date.now() / 1000); // Current time in seconds
  const intervalSeconds = 3600; // 1 hour between entries

  // Different starting battery levels for variety
  const startLevel = sourceId === 0 ? 85 : 78;

  // Generate entries going back in time
  for (let i = 0; i < count; i++) {
    const timestamp = now - (count - i - 1) * intervalSeconds;
    // Simulate battery drain: more recent = lower battery
    // Add some variation to make it look realistic
    const drainRate = sourceId === 0 ? 0.8 : 1.0; // Central drains slower
    const variation = Math.sin(i * 0.3) * 2; // Small periodic variation
    const batteryLevel = Math.max(
      20,
      Math.min(100, startLevel - i * drainRate + variation),
    );

    entries.push({
      timestamp,
      batteryLevel: Math.round(batteryLevel),
    });
  }

  return entries;
}

/**
 * Battery History Handler
 */
export class BatteryHistoryHandler {
  private callbacks: ((data: Uint8Array) => void)[] = [];
  private batteryHistory = {
    central: generateBatteryHistory(0, 48),
    peripheral: generateBatteryHistory(1, 48),
  };

  process(request: Request): Response {
    if (request.getHistory !== undefined) {
      // Send battery history via notifications
      const sendHistoryForDevice = (
        sourceId: number,
        entries: BatteryHistoryEntry[],
      ) => {
        const totalEntries = entries.length;

        entries.forEach((entry, index) => {
          const isLast = index === entries.length - 1;

          this.callbacks.forEach((cb) => {
            cb(
              Notification.encode({
                batteryHistory: {
                  sourceId,
                  entry,
                  isLast,
                  totalEntries,
                  entryIndex: index,
                },
              }).finish(),
            );
          });
        });
      };

      // Schedule notifications for both devices
      setTimeout(() => {
        console.log("Demo sending battery history for central");
        sendHistoryForDevice(0, this.batteryHistory.central);
      }, 100);

      setTimeout(() => {
        console.log("Demo sending battery history for peripheral");
        sendHistoryForDevice(1, this.batteryHistory.peripheral);
      }, 200);

      return { getHistory: {} };
    }

    if (request.clearHistory !== undefined) {
      // Calculate total entries before clearing
      const totalEntries =
        this.batteryHistory.central.length +
        this.batteryHistory.peripheral.length;

      // Clear history and regenerate fresh data
      this.batteryHistory.central = generateBatteryHistory(0, 48);
      this.batteryHistory.peripheral = generateBatteryHistory(1, 48);

      return {
        clearHistory: {
          entriesCleared: totalEntries,
        },
      };
    }

    return { error: { message: "Not implemented" } };
  }

  notify(callback: (data: Uint8Array) => void) {
    this.callbacks.push(callback);
  }
}
