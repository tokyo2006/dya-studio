/**
 * Demo Settings Custom Subsystem Handler
 *
 * Provides mock device settings for demo mode.
 */

import {
  ActivitySettings,
  Notification,
  type Request,
  type Response,
} from "../../proto/zmk/settings/core";

export const SETTINGS_IDENTIFIER = "zmk__settings";

/**
 * Mock device activity settings
 */
const MOCK_ACTIVITY_SETTINGS: ActivitySettings[] = [
  { source: 0, idleMs: 300000, sleepMs: 900000 }, // Central: 5min idle, 15min sleep
  { source: 1, idleMs: 300000, sleepMs: 900000 }, // Peripheral: 5min idle, 15min sleep
  { source: 2, idleMs: 500000, sleepMs: 900000 }, // Peripheral: 5min idle, 15min sleep
];

/**
 * Settings state
 */
export class SettingsHandler {
  private activitySettings = JSON.parse(JSON.stringify(MOCK_ACTIVITY_SETTINGS));
  private callbacks: ((data: Uint8Array) => void)[] = [];

  process(request: Request): Response {
    if (request.getAllActivitySettings !== undefined) {
      // Return empty response - settings are sent via notifications
      const f: (i: number) => void = (i: number) => {
        if (i >= this.activitySettings.length) {
          return;
        }
        console.log(
          "Demo sending activity settings:",
          this.activitySettings[i],
        );
        const setting = this.activitySettings[i];
        this.callbacks.forEach((cb) =>
          cb(
            Notification.encode({
              activitySettings: {
                settings: setting,
              },
            }).finish(),
          ),
        );
        setTimeout(() => f(i + 1), 100);
      };
      setTimeout(() => f(0), 100);
      return { getAllActivitySettings: { requestSent: true } };
    }

    if (request.setActivitySettings !== undefined) {
      if (request.setActivitySettings.settings) {
        const { idleMs, sleepMs } = request.setActivitySettings.settings;
        // Update all devices
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.activitySettings.forEach((s: any) => {
          s.idleMs = idleMs;
          s.sleepMs = sleepMs;
        });
        return { setActivitySettings: { success: true } };
      }
      return { setActivitySettings: { success: false } };
    }

    return { error: { message: "Not implemented" } };
  }

  notify(callback: (data: Uint8Array) => void) {
    this.callbacks.push(callback);
  }
}
