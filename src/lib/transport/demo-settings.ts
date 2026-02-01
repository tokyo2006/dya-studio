/**
 * Demo Settings Custom Subsystem Handler
 *
 * Provides mock device settings for demo mode.
 */

export const SETTINGS_IDENTIFIER = "zmk__settings";

/**
 * Mock device activity settings
 */
const MOCK_ACTIVITY_SETTINGS = [
  { source: 0, idleMs: 300000, sleepMs: 900000 }, // Central: 5min idle, 15min sleep
  { source: 1, idleMs: 300000, sleepMs: 900000 }, // Peripheral: 5min idle, 15min sleep
];

/**
 * Settings state
 */
export class SettingsHandler {
  private activitySettings = JSON.parse(JSON.stringify(MOCK_ACTIVITY_SETTINGS));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  process(request: any): any {
    if (request.getAllActivitySettings !== undefined) {
      // Return empty response - settings are sent via notifications
      return { getAllActivitySettings: {} };
    }

    if (request.setActivitySettings !== undefined) {
      const { idleMs, sleepMs } = request.setActivitySettings;
      // Update all devices
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.activitySettings.forEach((s: any) => {
        s.idleMs = idleMs;
        s.sleepMs = sleepMs;
      });
      return { setActivitySettings: { ok: {} } };
    }

    if (request.resetActivitySettings !== undefined) {
      // Reset to defaults
      this.activitySettings = JSON.parse(JSON.stringify(MOCK_ACTIVITY_SETTINGS));
      return { resetActivitySettings: { ok: {} } };
    }

    return null;
  }

  // Get notifications for getAllActivitySettings
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getNotifications(): any[] {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.activitySettings.map((s: any) => ({
      activitySettings: s,
    }));
  }
}
