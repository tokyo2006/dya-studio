/**
 * Demo Default Layer Custom Subsystem Handler
 *
 * Simulates the cormoran__default_layer subsystem for demo mode:
 * USB and BLE profile 0 resolve via OS detection, other endpoints unset,
 * a handful of per-OS mappings pre-populated.
 */

import {
  type Request,
  type Response,
  type EndpointState,
  type OsLayerState,
} from "../../proto/cormoran/default_layer/default_layer";

export const DEFAULT_LAYER_IDENTIFIER = "cormoran__default_layer";

const LAYER_UNSET = -1;
const LAYER_OS_DETECTION = -2;

// Endpoint indices: firmware skips index 0 ("no endpoint selected"), so USB
// starts at 1, followed by BLE profiles 0-4 at indices 2-6.
const MOCK_ENDPOINTS: EndpointState[] = [
  { index: 1, isUsb: true, bleProfileIndex: 0, value: LAYER_OS_DETECTION },
  { index: 2, isUsb: false, bleProfileIndex: 0, value: LAYER_OS_DETECTION },
  { index: 3, isUsb: false, bleProfileIndex: 1, value: LAYER_UNSET },
  { index: 4, isUsb: false, bleProfileIndex: 2, value: LAYER_UNSET },
  { index: 5, isUsb: false, bleProfileIndex: 3, value: LAYER_UNSET },
  { index: 6, isUsb: false, bleProfileIndex: 4, value: LAYER_UNSET },
];

// zmk_os: 0=unknown, 1=windows, 2=macos, 3=linux, 4=ios, 5=android
const MOCK_OS_LAYERS: OsLayerState[] = [
  { os: 0, value: LAYER_UNSET },
  { os: 1, value: 1 },
  { os: 2, value: 0 },
  { os: 3, value: LAYER_UNSET },
  { os: 4, value: LAYER_UNSET },
  { os: 5, value: LAYER_UNSET },
];

export class DefaultLayerHandler {
  private endpoints: EndpointState[] = JSON.parse(
    JSON.stringify(MOCK_ENDPOINTS),
  );
  private osLayers: OsLayerState[] = JSON.parse(JSON.stringify(MOCK_OS_LAYERS));
  private activeEndpointIndex = 1;
  private currentOs = 2; // macOS, matches demo-os-detection USB fixture
  private layerCount: number;

  constructor(layerCount: number) {
    this.layerCount = layerCount;
  }

  process(request: Request): Response {
    if (request.getState !== undefined) {
      return { state: this.buildState() };
    }

    if (request.setEndpointLayer !== undefined) {
      const { endpointIndex, value } = request.setEndpointLayer;
      const endpoint = this.endpoints.find((e) => e.index === endpointIndex);
      if (!endpoint) {
        return { error: { message: `Endpoint not found: ${endpointIndex}` } };
      }
      endpoint.value = value;
      return { state: this.buildState() };
    }

    if (request.setOsLayer !== undefined) {
      const { os, value } = request.setOsLayer;
      const entry = this.osLayers.find((o) => o.os === os);
      if (!entry) {
        return { error: { message: `OS not found: ${os}` } };
      }
      entry.value = value;
      return { state: this.buildState() };
    }

    return { error: { message: "Not implemented" } };
  }

  private resolvedLayer(): number {
    const active = this.endpoints.find(
      (e) => e.index === this.activeEndpointIndex,
    );
    if (!active) return LAYER_UNSET;
    if (active.value !== LAYER_OS_DETECTION) return active.value;
    const osEntry = this.osLayers.find((o) => o.os === this.currentOs);
    return osEntry?.value ?? LAYER_UNSET;
  }

  private buildState(): NonNullable<Response["state"]> {
    return {
      endpoints: this.endpoints,
      osLayers: this.osLayers,
      activeEndpointIndex: this.activeEndpointIndex,
      currentOs: this.currentOs,
      resolvedLayer: this.resolvedLayer(),
      layerCount: this.layerCount,
      osDetectionAvailable: true,
    };
  }
}
