/**
 * Shared helpers for OS detection / default-layer integration.
 *
 * Centralizes:
 * - OS label lookup (used by both os-detection and default-layer sections)
 * - conversion between the os-detection proto `Os` enum and the raw
 *   `zmk_os` integer used by the default-layer proto (protoOs = zmkOs + 1)
 * - default-layer `value` sentinels
 * - a pure merge helper that builds the connection card list from whichever
 *   subsystems (ble-management / default-layer / os-detection) are available
 */
import { Os } from "../proto/cormoran/os_detection/os_detection";

/** default-layer `value` sentinel: endpoint/OS mapping intentionally unset. */
export const LAYER_UNSET = -1;
/** default-layer endpoint `value` sentinel: resolve via per-OS mapping. */
export const LAYER_OS_DETECTION = -2;

/** Human readable labels for the os-detection proto `Os` enum, indexed by value. */
export const OS_LABELS: Record<number, string> = {
  [Os.OS_UNSPECIFIED]: "Auto",
  [Os.OS_UNKNOWN]: "Unknown",
  [Os.OS_WINDOWS]: "Windows",
  [Os.OS_MACOS]: "macOS",
  [Os.OS_LINUX]: "Linux",
  [Os.OS_IOS]: "iOS",
  [Os.OS_ANDROID]: "Android",
};

/**
 * English literal to pass to `t()` for a given os-detection proto `Os` value.
 * Use this (never inline a lookup) so labels stay in sync with the
 * translations added for {@link OS_LABELS}.
 */
export function osLabel(os: number): string {
  return OS_LABELS[os] ?? "Unknown";
}

/**
 * Convert a raw `zmk_os` integer (used by the default-layer proto's
 * `os_layers[].os` / `set_os_layer.os` fields: 0=unknown..5=android) to the
 * os-detection proto `Os` enum value (0=unspecified, 1=unknown..6=android).
 *
 * Firmware conversion: `proto = zmk_os + 1`. Always go through this helper —
 * never inline the `+1`/`-1` offset.
 */
export function zmkOsToProtoOs(zmkOs: number): Os {
  return (zmkOs + 1) as Os;
}

/** Inverse of {@link zmkOsToProtoOs}. */
export function protoOsToZmkOs(protoOs: Os): number {
  return protoOs - 1;
}

/** The raw zmk_os values enumerated by the default-layer per-OS section (0..5). */
export const ZMK_OS_VALUES = [0, 1, 2, 3, 4, 5];

export interface ConnectionCard {
  /** default-layer endpoint index (1-based; USB then BLE profiles), if known. */
  endpointIndex?: number;
  /** True when this card represents the USB endpoint. */
  isUsb: boolean;
  /** BLE profile index, when this card represents a BLE connection. */
  bleProfileIndex?: number;
  /** Human readable label, e.g. device name or "BLE profile N". */
  label: string;
}

export interface MergeCardsInput {
  bleProfiles?: { index: number; name: string }[];
  defaultLayerEndpoints?: {
    index: number;
    isUsb: boolean;
    bleProfileIndex: number;
  }[];
  osDetectionBleProfiles?: { index: number }[];
}

/**
 * Build the list of connection cards to render, merging whichever of the
 * three subsystems are available. Priority for BLE profile identity/labels:
 * ble-management > default-layer endpoints > os-detection ble_profiles.
 *
 * Always returns a USB card first when any BLE/USB-aware subsystem
 * (default-layer or os-detection) is available, since ble-management itself
 * has no notion of USB.
 */
export function mergeConnectionCards(input: MergeCardsInput): ConnectionCard[] {
  const {
    bleProfiles = [],
    defaultLayerEndpoints = [],
    osDetectionBleProfiles = [],
  } = input;

  const cards: ConnectionCard[] = [];

  const usbEndpoint = defaultLayerEndpoints.find((e) => e.isUsb);
  if (
    usbEndpoint ||
    defaultLayerEndpoints.length > 0 ||
    osDetectionBleProfiles.length > 0
  ) {
    cards.push({
      endpointIndex: usbEndpoint?.index,
      isUsb: true,
      label: "USB",
    });
  }

  // Collect the union of known BLE profile indices across all sources.
  const bleIndices = new Set<number>();
  bleProfiles.forEach((p) => bleIndices.add(p.index));
  defaultLayerEndpoints
    .filter((e) => !e.isUsb)
    .forEach((e) => bleIndices.add(e.bleProfileIndex));
  osDetectionBleProfiles.forEach((p) => bleIndices.add(p.index));

  const sortedIndices = Array.from(bleIndices).sort((a, b) => a - b);

  for (const index of sortedIndices) {
    const bleProfile = bleProfiles.find((p) => p.index === index);
    const endpoint = defaultLayerEndpoints.find(
      (e) => !e.isUsb && e.bleProfileIndex === index,
    );

    const label = bleProfile?.name || `BLE profile ${index}`;

    cards.push({
      endpointIndex: endpoint?.index,
      isUsb: false,
      bleProfileIndex: index,
      label,
    });
  }

  return cards;
}
