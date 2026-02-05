/**
 * Demo BLE Management Custom Subsystem Handler
 *
 * Provides mock BLE profile management for demo mode.
 */

import {
  OutputPriority,
  type ProfileInfo,
  type Request,
  type Response,
} from "../../proto/zmk/ble_management/ble_management";

export const BLE_MANAGEMENT_IDENTIFIER = "cormoran_ble";

/**
 * Mock BLE profiles
 */
const MOCK_BLE_PROFILES: ProfileInfo[] = [
  {
    index: 0,
    name: "MacBook Pro",
    address: "AA:BB:CC:DD:EE:01",
    isConnected: true,
    isOpen: true,
    isActive: true,
  },
  {
    index: 1,
    name: "iPad",
    address: "AA:BB:CC:DD:EE:02",
    isConnected: false,
    isOpen: true,
    isActive: false,
  },
  {
    index: 2,
    name: "",
    address: "00:00:00:00:00:00",
    isConnected: false,
    isOpen: false,
    isActive: false,
  },
  {
    index: 3,
    name: "",
    address: "00:00:00:00:00:00",
    isConnected: false,
    isOpen: false,
    isActive: false,
  },
  {
    index: 4,
    name: "",
    address: "00:00:00:00:00:00",
    isConnected: false,
    isOpen: false,
    isActive: false,
  },
];

/**
 * BLE Management state
 */
export class BLEManagementHandler {
  private profiles: ProfileInfo[] = JSON.parse(
    JSON.stringify(MOCK_BLE_PROFILES),
  );
  private outputPriority: OutputPriority = OutputPriority.OUTPUT_PRIORITY_USB;
  private maxProfiles = 5;

  process(request: Request): Response {
    if (request.getProfiles !== undefined) {
      return {
        getProfiles: {
          profiles: this.profiles,
          maxProfiles: this.maxProfiles,
        },
      };
    }

    if (request.switchProfile !== undefined) {
      const { index } = request.switchProfile;
      if (index >= 0 && index < this.profiles.length) {
        // Deactivate all profiles
        this.profiles.forEach((p: ProfileInfo) => {
          p.isActive = false;
        });
        // Activate selected profile
        this.profiles[index].isActive = true;
        this.profiles[index].isConnected = !this.profiles[index].isOpen;
        return { switchProfile: { success: true } };
      }
      return { switchProfile: { success: false } };
    }

    if (request.unpairProfile !== undefined) {
      const { index } = request.unpairProfile;
      if (index >= 0 && index < this.profiles.length) {
        this.profiles[index] = {
          index,
          name: "",
          address: "00:00:00:00:00:00",
          isConnected: false,
          isOpen: true,
          isActive: false,
        };
        return { unpairProfile: { success: true } };
      }
      return { unpairProfile: { success: false } };
    }

    if (request.setProfileName !== undefined) {
      const { index, name } = request.setProfileName;
      if (index >= 0 && index < this.profiles.length) {
        this.profiles[index].name = name;
        return { setProfileName: { success: true } };
      }
      return { setProfileName: { success: false } };
    }

    if (request.getOutputPriority !== undefined) {
      return {
        getOutputPriority: {
          priority: this.outputPriority,
        },
      };
    }

    if (request.setOutputPriority !== undefined) {
      const { priority } = request.setOutputPriority;
      this.outputPriority = priority;
      return {
        setOutputPriority: {
          success: true,
        },
      };
    }

    return {
      error: {
        message: "Not implemented",
      },
    };
  }
}
