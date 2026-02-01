/**
 * Demo BLE Management Custom Subsystem Handler
 *
 * Provides mock BLE profile management for demo mode.
 */

export const BLE_MANAGEMENT_IDENTIFIER = "zmk__ble_management";

/**
 * Mock BLE profiles
 */
const MOCK_BLE_PROFILES = [
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
  private profiles = JSON.parse(JSON.stringify(MOCK_BLE_PROFILES));
  private maxProfiles = 5;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  process(request: any): any {
    if (request.getProfiles !== undefined) {
      return {
        getProfiles: {
          profiles: this.profiles,
          maxProfiles: this.maxProfiles,
        },
      };
    }

    if (request.setActiveProfile !== undefined) {
      const { index } = request.setActiveProfile;
      if (index >= 0 && index < this.profiles.length && this.profiles[index].isOpen) {
        // Deactivate all profiles
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.profiles.forEach((p: any) => { p.isActive = false; });
        // Activate selected profile
        this.profiles[index].isActive = true;
        this.profiles[index].isConnected = true;
        return { setActiveProfile: { ok: {} } };
      }
      return { setActiveProfile: { err: {} } };
    }

    if (request.unpairProfile !== undefined) {
      const { index } = request.unpairProfile;
      if (index >= 0 && index < this.profiles.length) {
        this.profiles[index] = {
          index,
          name: "",
          address: "00:00:00:00:00:00",
          isConnected: false,
          isOpen: false,
          isActive: false,
        };
        return { unpairProfile: { ok: {} } };
      }
      return { unpairProfile: { err: {} } };
    }

    if (request.setProfileName !== undefined) {
      const { index, name } = request.setProfileName;
      if (index >= 0 && index < this.profiles.length && this.profiles[index].isOpen) {
        this.profiles[index].name = name;
        return { setProfileName: { ok: {} } };
      }
      return { setProfileName: { err: {} } };
    }

    return null;
  }
}
