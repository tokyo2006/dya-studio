import {
  zmkOsToProtoOs,
  protoOsToZmkOs,
  osLabel,
  mergeConnectionCards,
  LAYER_UNSET,
  LAYER_OS_DETECTION,
} from "../osDetection";
import { Os } from "../../proto/cormoran/os_detection/os_detection";

describe("osDetection lib", () => {
  describe("zmk_os <-> proto Os conversion", () => {
    it("converts zmk_os to proto Os with a +1 offset", () => {
      expect(zmkOsToProtoOs(0)).toBe(Os.OS_UNKNOWN);
      expect(zmkOsToProtoOs(1)).toBe(Os.OS_WINDOWS);
      expect(zmkOsToProtoOs(2)).toBe(Os.OS_MACOS);
      expect(zmkOsToProtoOs(3)).toBe(Os.OS_LINUX);
      expect(zmkOsToProtoOs(4)).toBe(Os.OS_IOS);
      expect(zmkOsToProtoOs(5)).toBe(Os.OS_ANDROID);
    });

    it("is the inverse of protoOsToZmkOs", () => {
      for (let zmkOs = 0; zmkOs <= 5; zmkOs++) {
        expect(protoOsToZmkOs(zmkOsToProtoOs(zmkOs))).toBe(zmkOs);
      }
    });
  });

  describe("osLabel", () => {
    it("returns a label for every known enum value", () => {
      expect(osLabel(Os.OS_UNSPECIFIED)).toBe("Auto");
      expect(osLabel(Os.OS_WINDOWS)).toBe("Windows");
      expect(osLabel(Os.OS_MACOS)).toBe("macOS");
      expect(osLabel(Os.OS_LINUX)).toBe("Linux");
      expect(osLabel(Os.OS_IOS)).toBe("iOS");
      expect(osLabel(Os.OS_ANDROID)).toBe("Android");
    });

    it("falls back to Unknown for unrecognized values", () => {
      expect(osLabel(999)).toBe("Unknown");
    });
  });

  describe("sentinels", () => {
    it("exposes the shared value sentinels", () => {
      expect(LAYER_UNSET).toBe(-1);
      expect(LAYER_OS_DETECTION).toBe(-2);
    });
  });

  describe("mergeConnectionCards", () => {
    it("returns an empty list when no subsystem is available", () => {
      expect(mergeConnectionCards({})).toEqual([]);
    });

    it("builds cards from ble-management profiles only (no USB card)", () => {
      const cards = mergeConnectionCards({
        bleProfiles: [
          { index: 0, name: "MacBook" },
          { index: 1, name: "" },
        ],
      });
      expect(cards).toEqual([
        { isUsb: false, bleProfileIndex: 0, label: "MacBook" },
        { isUsb: false, bleProfileIndex: 1, label: "BLE profile 1" },
      ]);
    });

    it("adds a USB card when default-layer endpoints are available", () => {
      const cards = mergeConnectionCards({
        defaultLayerEndpoints: [
          { index: 1, isUsb: true, bleProfileIndex: 0 },
          { index: 2, isUsb: false, bleProfileIndex: 0 },
        ],
      });
      expect(cards[0]).toEqual({
        endpointIndex: 1,
        isUsb: true,
        label: "USB",
      });
      expect(cards[1]).toEqual({
        endpointIndex: 2,
        isUsb: false,
        bleProfileIndex: 0,
        label: "BLE profile 0",
      });
    });

    it("adds a USB card when only os-detection is available", () => {
      const cards = mergeConnectionCards({
        osDetectionBleProfiles: [{ index: 0 }],
      });
      expect(cards[0]).toEqual({ isUsb: true, label: "USB" });
      expect(cards[1]).toEqual({
        isUsb: false,
        bleProfileIndex: 0,
        label: "BLE profile 0",
      });
    });

    it("merges all three sources, preferring ble-management names", () => {
      const cards = mergeConnectionCards({
        bleProfiles: [{ index: 0, name: "MacBook" }],
        defaultLayerEndpoints: [
          { index: 1, isUsb: true, bleProfileIndex: 0 },
          { index: 2, isUsb: false, bleProfileIndex: 0 },
          { index: 3, isUsb: false, bleProfileIndex: 1 },
        ],
        osDetectionBleProfiles: [{ index: 0 }, { index: 1 }, { index: 2 }],
      });

      expect(cards).toEqual([
        { endpointIndex: 1, isUsb: true, label: "USB" },
        {
          endpointIndex: 2,
          isUsb: false,
          bleProfileIndex: 0,
          label: "MacBook",
        },
        {
          endpointIndex: 3,
          isUsb: false,
          bleProfileIndex: 1,
          label: "BLE profile 1",
        },
        { isUsb: false, bleProfileIndex: 2, label: "BLE profile 2" },
      ]);
    });
  });
});
