/**
 * Demo OS Detection Custom Subsystem Handler
 *
 * Simulates the cormoran__os_detection subsystem for demo mode:
 * USB connected on macOS, BLE profile 0 paired+connected+active on macOS,
 * BLE profile 1 paired on Windows with a manual override, the rest open.
 */

import {
  Os,
  type Request,
  type Response,
  type BleProfileState,
} from "../../proto/cormoran/os_detection/os_detection";

export const OS_DETECTION_IDENTIFIER = "cormoran__os_detection";

const MOCK_BLE_PROFILES: BleProfileState[] = [
  {
    index: 0,
    bonded: true,
    connected: true,
    detected: Os.OS_MACOS,
    override: Os.OS_UNSPECIFIED,
    effective: Os.OS_MACOS,
  },
  {
    index: 1,
    bonded: true,
    connected: false,
    detected: Os.OS_WINDOWS,
    override: Os.OS_WINDOWS,
    effective: Os.OS_WINDOWS,
  },
  {
    index: 2,
    bonded: false,
    connected: false,
    detected: Os.OS_UNSPECIFIED,
    override: Os.OS_UNSPECIFIED,
    effective: Os.OS_UNSPECIFIED,
  },
  {
    index: 3,
    bonded: false,
    connected: false,
    detected: Os.OS_UNSPECIFIED,
    override: Os.OS_UNSPECIFIED,
    effective: Os.OS_UNSPECIFIED,
  },
  {
    index: 4,
    bonded: false,
    connected: false,
    detected: Os.OS_UNSPECIFIED,
    override: Os.OS_UNSPECIFIED,
    effective: Os.OS_UNSPECIFIED,
  },
];

export class OsDetectionHandler {
  private bleProfiles: BleProfileState[] = JSON.parse(
    JSON.stringify(MOCK_BLE_PROFILES),
  );
  private usbConnected = true;
  private usbDetected: Os = Os.OS_MACOS;
  private activeProfileIndex = 0;

  process(request: Request): Response {
    if (request.getState !== undefined) {
      return { state: this.buildState() };
    }

    if (request.setBleOverride !== undefined) {
      const { profileIndex, os } = request.setBleOverride;
      const profile = this.bleProfiles.find((p) => p.index === profileIndex);
      if (!profile) {
        return { error: { message: `Profile not found: ${profileIndex}` } };
      }
      // OS_UNSPECIFIED or OS_UNKNOWN resets to AUTO (i.e. use detected).
      const resetsToAuto = os === Os.OS_UNSPECIFIED || os === Os.OS_UNKNOWN;
      profile.override = resetsToAuto ? Os.OS_UNSPECIFIED : os;
      profile.effective = resetsToAuto ? profile.detected : os;
      return { setBleOverride: { profile } };
    }

    return { error: { message: "Not implemented" } };
  }

  private buildState(): NonNullable<Response["state"]> {
    return {
      usb: { connected: this.usbConnected, detected: this.usbDetected },
      bleProfiles: this.bleProfiles,
      activeProfileIndex: this.activeProfileIndex,
      currentEffective: this.usbConnected
        ? this.usbDetected
        : (this.bleProfiles.find((p) => p.index === this.activeProfileIndex)
            ?.effective ?? Os.OS_UNSPECIFIED),
    };
  }
}
