/**
 * Demo Device Info Custom Subsystem Handler
 *
 * Provides mock device/build/hardware diagnostic info for demo mode.
 */

import {
  type Request,
  type Response,
} from "../../proto/zmk/device_info/device_info";

export const DEVICE_INFO_IDENTIFIER = "zmk__device_info";

// Power-On reset cause bit (see RESET_CAUSE_LABELS in DeviceInfoSection.tsx).
const RESET_CAUSE_POWER_ON = 1 << 3;

export class DeviceInfoHandler {
  private startedAtMs = Date.now();

  process(request: Request): Response {
    if (request.getDeviceInfo !== undefined) {
      return {
        deviceInfo: {
          build: {
            zmkVersion: "3.5-cormoran-abc1234",
            zmkDirty: false,
            zmkConfigVersion: "v1.4.0",
            zmkConfigDirty: false,
            moduleVersion: "demo-0001",
            moduleDirty: false,
            zephyrVersion: "3.7.0",
            buildTimestamp: "2026-07-01T09:00:00Z",
            board: "dya_dash",
          },
          hardware: {
            deviceId: "DYADEMO0001",
            resetCause: RESET_CAUSE_POWER_ON,
            flashSizeKb: 1024,
            sramSizeKb: 256,
          },
          zephyrDevices: [
            { name: "kscan0", ready: true },
            { name: "pmw3610@0", ready: true },
            { name: "ble_hci", ready: true },
            { name: "gpio@0", ready: true },
            { name: "i2c@0", ready: true },
          ],
          zmkConfig: {
            kscanCompatible: "cormoran,kscan-diagnostics",
            bleEnabled: true,
            bleProfileCount: 5,
            usbEnabled: true,
            splitEnabled: true,
            splitRole: "central",
            displayEnabled: false,
            rgbUnderglowEnabled: false,
            backlightEnabled: false,
            batteryLevelEnabled: true,
          },
          runtime: {
            uptimeMs: Date.now() - this.startedAtMs,
          },
        },
      };
    }

    return { error: { message: "Not implemented" } };
  }
}
