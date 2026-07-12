import {
  type Context,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { ZMKAppContext } from "@cormoran/zmk-studio-react-hook";
import { useCustomSubsystem } from "./useCustomSubsystem";
import type { UseCustomSubsystemTypedReturn } from "@cormoran/zmk-studio-react-hook";
import type { CustomNotification } from "@zmkfirmware/zmk-studio-ts-client/custom";
import {
  GpioLineKind,
  PeripheralEvent,
  Request,
  Response,
  type Device,
  type GpioPin,
  type Info,
  type PositionStats,
} from "../proto/cormoran/kscan_diagnostics/kscan_diagnostics";
import type { KscanDevice, KscanLayout, Topology } from "../lib/kscanTopology";

export const KSCAN_DIAGNOSTICS_SUBSYSTEM_IDENTIFIER =
  "cormoran__kscan_diagnostics";

const CODEC = {
  encode: (request: Request) => Request.encode(request).finish(),
  decode: (payload: Uint8Array) => Response.decode(payload),
};

type Caller = UseCustomSubsystemTypedReturn<Request, Response>["call"];

// Safety valve against a misbehaving firmware paginating forever.
const MAX_PAGES = 2000;

// After QueryPeripheral returns Ok, wait this long for PeripheralEvent
// notifications before giving up on additional peripheral responses.
const PERIPHERAL_DISCOVERY_TIMEOUT_MS = 3000;

// When fetching topology for a known source, stop waiting once that source's
// response arrives (or after this fallback timeout).
const PERIPHERAL_RESPONSE_TIMEOUT_MS = 3000;

// Monotonic counter for QueryPeripheral req_id — correlates PeripheralEvent
// notifications to the request that triggered them.
let _nextPeripheralReqId = 1;
function nextPeripheralReqId(): number {
  return _nextPeripheralReqId++;
}

export interface UseKscanDiagnosticsReturn {
  isAvailable: boolean;
  info: Info | null;
  devices: Device[];
  stats: PositionStats[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  resetStats: () => Promise<void>;
  /** Full wiring topology (layouts + devices + GPIO lines), used by
   * KscanKeyboardView. Lazily fetched — call `loadTopology()` on first
   * expand of the KScan section rather than eagerly on mount, since it is
   * heavier than the info/devices/stats auto-fetch above. */
  topology: Topology | null;
  isLoadingTopology: boolean;
  topologyError: string | null;
  loadTopology: () => Promise<void>;
  /** Topology for each split peripheral (source 1, 2, …). Keyed by source
   * index. Populated by `loadPeripheralTopologies()`. */
  peripheralTopologies: Map<number, Topology>;
  isLoadingPeripheralTopologies: boolean;
  peripheralTopologyErrors: Map<number, string>;
  /** Set when QueryPeripheral was supported but no peripheral responded within
   * the discovery timeout. Null when not yet loaded or when the feature is
   * unsupported (firmware without QueryPeripheral). */
  peripheralDiscoveryError: string | null;
  /** Discover peripherals and fetch their topologies via QueryPeripheral. */
  loadPeripheralTopologies: () => Promise<void>;
}

async function callRpc(call: Caller, request: Request): Promise<Response> {
  const resp = await call(request);
  if (!resp) {
    throw new Error("No response from device");
  }
  if (resp.error) {
    throw new Error(resp.error.message);
  }
  return resp;
}

async function fetchStats(call: Caller): Promise<PositionStats[]> {
  const entries: PositionStats[] = [];
  let offset = 0;
  for (let page = 0; page < MAX_PAGES; page++) {
    const resp = await callRpc(call, Request.create({ getStats: { offset } }));
    const chunk = resp.stats;
    if (!chunk) {
      throw new Error("Unexpected response to GetStats");
    }
    entries.push(...chunk.entries);
    offset = chunk.offset + chunk.entries.length;
    if (chunk.entries.length === 0 || offset >= chunk.total) break;
  }
  return entries;
}

async function fetchGpioPinsOfKind(
  call: Caller,
  deviceIndex: number,
  kind: GpioLineKind,
): Promise<GpioPin[]> {
  const pins: GpioPin[] = [];
  let offset = 0;
  for (let page = 0; page < MAX_PAGES; page++) {
    const resp = await callRpc(
      call,
      Request.create({ getGpioPins: { deviceIndex, kind, offset } }),
    );
    const chunk = resp.gpioPins;
    if (!chunk) {
      throw new Error("Unexpected response to GetGpioPins");
    }
    pins.push(...chunk.pins);
    offset = chunk.offset + chunk.pins.length;
    if (chunk.pins.length === 0 || offset >= chunk.total) break;
  }
  return pins;
}

/**
 * GpioPin (the response message) carries no kind field — kind is only a
 * GetGpioPins request-side filter — so fetch one paged sequence per kind to
 * keep them separated for resolveRowColLines. KIND_UNKNOWN is skipped: it
 * means "unfiltered" on the wire, which would duplicate lines already
 * fetched per-kind.
 */
async function fetchGpioLinesByKind(
  call: Caller,
  deviceIndex: number,
): Promise<Record<GpioLineKind, GpioPin[]>> {
  const kinds: GpioLineKind[] = [
    GpioLineKind.ROW,
    GpioLineKind.COL,
    GpioLineKind.INPUT,
    GpioLineKind.OUTPUT,
    GpioLineKind.CHARLIE,
  ];
  const result = {} as Record<GpioLineKind, GpioPin[]>;
  result[GpioLineKind.KIND_UNKNOWN] = [];
  for (const kind of kinds) {
    result[kind] = await fetchGpioPinsOfKind(call, deviceIndex, kind);
  }
  return result;
}

async function fetchPositionMap(
  call: Caller,
  layoutIndex: number,
): Promise<(number | null)[]> {
  const cells: (number | null)[] = [];
  let offset = 0;
  for (let page = 0; page < MAX_PAGES; page++) {
    const resp = await callRpc(
      call,
      Request.create({ getPositionMap: { layoutIndex, offset } }),
    );
    const chunk = resp.positionMap;
    if (!chunk) {
      throw new Error("Unexpected response to GetPositionMap");
    }
    for (const cell of chunk.cells) {
      // 0 = unmapped, otherwise position+1.
      cells.push(cell === 0 ? null : cell - 1);
    }
    offset = chunk.offset + chunk.cells.length;
    if (chunk.cells.length === 0 || offset >= chunk.total) break;
  }
  return cells;
}

async function fetchDevice(
  call: Caller,
  deviceIndex: number,
): Promise<KscanDevice> {
  const resp = await callRpc(
    call,
    Request.create({ getDevice: { deviceIndex } }),
  );
  const d = resp.device;
  if (!d) {
    throw new Error("Unexpected response to GetDevice");
  }
  const gpioLinesByKind = await fetchGpioLinesByKind(call, deviceIndex);
  return {
    deviceIndex: d.deviceIndex,
    nodeName: d.nodeName,
    type: d.type,
    rows: d.rows,
    columns: d.columns,
    inputs: d.inputs,
    debouncePressMs: d.debouncePressMs,
    debounceReleaseMs: d.debounceReleaseMs,
    debounceScanPeriodMs: d.debounceScanPeriodMs,
    pollPeriodMs: d.pollPeriodMs,
    diodeRow2col: d.diodeRow2col,
    toggleMode: d.toggleMode,
    gpioLinesByKind,
  };
}

async function fetchLayout(
  call: Caller,
  layoutIndex: number,
): Promise<KscanLayout> {
  const resp = await callRpc(
    call,
    Request.create({ getLayout: { layoutIndex } }),
  );
  const l = resp.layout;
  if (!l) {
    throw new Error("Unexpected response to GetLayout");
  }
  const positionMap = await fetchPositionMap(call, layoutIndex);
  return {
    layoutIndex: l.layoutIndex,
    displayName: l.displayName,
    rows: l.rows,
    columns: l.columns,
    keyCount: l.keyCount,
    deviceIndices: l.deviceIndices.map((d) => ({
      leafIndex: d.leafIndex,
      rowOffset: d.rowOffset,
      colOffset: d.colOffset,
    })),
    positionMap,
  };
}

async function fetchTopology(call: Caller): Promise<Topology> {
  const infoResp = await callRpc(call, Request.create({ getInfo: {} }));
  const info = infoResp.info;
  if (!info) {
    throw new Error("Unexpected response to GetInfo");
  }

  const layouts: KscanLayout[] = [];
  for (let i = 0; i < info.layoutCount; i++) {
    layouts.push(await fetchLayout(call, i));
  }

  // Every device in device_count is fetched so the wiring overlay works even
  // for devices not attached to the active layout (multi-layout keyboards).
  const devices: KscanDevice[] = [];
  for (let i = 0; i < info.deviceCount; i++) {
    devices.push(await fetchDevice(call, i));
  }

  return {
    protoVersion: info.protoVersion,
    selectedLayout: info.selectedLayout,
    statsEnabled: info.statsEnabled,
    maxPositions: info.maxPositions,
    uptimeMs: info.uptimeMs,
    devices,
    layouts,
  };
}

// Extract the value type from the context (what useContext(ZMKAppContext) returns),
// then strip null so helpers can assert they receive a connected app instance.
type ZmkApp = NonNullable<
  typeof ZMKAppContext extends Context<infer V> ? V : never
>;

/**
 * Send a QueryPeripheral request wrapping `innerRequest` and collect
 * PeripheralEvent notification responses. When `filterSource` is provided the
 * promise resolves as soon as that source's response arrives; otherwise it
 * waits for `timeout` ms after the RPC returns Ok, collecting all responses.
 */
async function queryPeripheral(
  call: Caller,
  zmkApp: ZmkApp,
  subsystemIndex: number,
  innerRequest: Request,
  filterSource?: number,
  timeout: number = PERIPHERAL_DISCOVERY_TIMEOUT_MS,
): Promise<{ responses: Map<number, Response>; supported: boolean }> {
  const reqId = nextPeripheralReqId();
  const responses = new Map<number, Response>();

  // Resolves as soon as filterSource's response arrives (used by Promise.race
  // below). In discovery mode (filterSource undefined) it never resolves and
  // the timeout side of the race always wins.
  let resolveTarget!: () => void;
  const targetArrived = new Promise<void>((r) => {
    resolveTarget = r;
  });

  const unsubscribe = zmkApp!.onNotification({
    type: "custom",
    subsystemIndex,
    callback: (customNotification: CustomNotification) => {
      try {
        const event = PeripheralEvent.decode(customNotification.payload);
        if (event.reqId !== reqId) return;
        const innerResponse = Response.decode(event.payload);
        responses.set(event.source, innerResponse);
        if (filterSource !== undefined && event.source === filterSource) {
          resolveTarget();
        }
      } catch {
        // ignore decode errors from unrelated notifications
      }
    },
  });

  let supported = false;
  try {
    const result = await call(
      Request.create({
        queryPeripheral: {
          reqId,
          payload: Request.encode(innerRequest).finish(),
        },
      }),
    );

    if (result && !result.error) {
      supported = true;
      await Promise.race([
        targetArrived,
        new Promise<void>((r) => setTimeout(r, timeout)),
      ]);
    }
  } finally {
    unsubscribe();
  }

  return { responses, supported };
}

/**
 * Fetch full topology for one split peripheral by relaying each inner request
 * via QueryPeripheral and awaiting the matching PeripheralEvent notification.
 */
async function fetchPeripheralTopology(
  call: Caller,
  zmkApp: ZmkApp,
  subsystemIndex: number,
  source: number,
): Promise<Topology> {
  const { responses: infoMap } = await queryPeripheral(
    call,
    zmkApp,
    subsystemIndex,
    Request.create({ getInfo: {} }),
    source,
    PERIPHERAL_RESPONSE_TIMEOUT_MS,
  );
  const infoResp = infoMap.get(source);
  if (!infoResp?.info) {
    throw new Error(`No response from peripheral ${source}`);
  }
  const info = infoResp.info;

  const layouts: KscanLayout[] = [];
  for (let i = 0; i < info.layoutCount; i++) {
    const { responses: layoutMap } = await queryPeripheral(
      call,
      zmkApp,
      subsystemIndex,
      Request.create({ getLayout: { layoutIndex: i } }),
      source,
      PERIPHERAL_RESPONSE_TIMEOUT_MS,
    );
    const layoutResp = layoutMap.get(source)?.layout;
    if (!layoutResp)
      throw new Error(`No Layout[${i}] from peripheral ${source}`);

    const posMap = await fetchPeripheralPositionMap(
      call,
      zmkApp,
      subsystemIndex,
      source,
      i,
    );
    layouts.push({
      layoutIndex: layoutResp.layoutIndex,
      displayName: layoutResp.displayName,
      rows: layoutResp.rows,
      columns: layoutResp.columns,
      keyCount: layoutResp.keyCount,
      deviceIndices: layoutResp.deviceIndices.map((d) => ({
        leafIndex: d.leafIndex,
        rowOffset: d.rowOffset,
        colOffset: d.colOffset,
      })),
      positionMap: posMap,
    });
  }

  const devices: KscanDevice[] = [];
  for (let i = 0; i < info.deviceCount; i++) {
    const { responses: devMap } = await queryPeripheral(
      call,
      zmkApp,
      subsystemIndex,
      Request.create({ getDevice: { deviceIndex: i } }),
      source,
      PERIPHERAL_RESPONSE_TIMEOUT_MS,
    );
    const d = devMap.get(source)?.device;
    if (!d) throw new Error(`No Device[${i}] from peripheral ${source}`);
    const gpioLinesByKind = await fetchPeripheralGpioLinesByKind(
      call,
      zmkApp,
      subsystemIndex,
      source,
      i,
    );
    devices.push({
      deviceIndex: d.deviceIndex,
      nodeName: d.nodeName,
      type: d.type,
      rows: d.rows,
      columns: d.columns,
      inputs: d.inputs,
      debouncePressMs: d.debouncePressMs,
      debounceReleaseMs: d.debounceReleaseMs,
      debounceScanPeriodMs: d.debounceScanPeriodMs,
      pollPeriodMs: d.pollPeriodMs,
      diodeRow2col: d.diodeRow2col,
      toggleMode: d.toggleMode,
      gpioLinesByKind,
    });
  }

  return {
    protoVersion: info.protoVersion,
    selectedLayout: info.selectedLayout,
    statsEnabled: info.statsEnabled,
    maxPositions: info.maxPositions,
    uptimeMs: info.uptimeMs,
    devices,
    layouts,
  };
}

async function fetchPeripheralPositionMap(
  call: Caller,
  zmkApp: ZmkApp,
  subsystemIndex: number,
  source: number,
  layoutIndex: number,
): Promise<(number | null)[]> {
  const cells: (number | null)[] = [];
  let offset = 0;
  for (let page = 0; page < MAX_PAGES; page++) {
    const { responses: map } = await queryPeripheral(
      call,
      zmkApp,
      subsystemIndex,
      Request.create({ getPositionMap: { layoutIndex, offset } }),
      source,
      PERIPHERAL_RESPONSE_TIMEOUT_MS,
    );
    const chunk = map.get(source)?.positionMap;
    if (!chunk) throw new Error(`No PositionMap from peripheral ${source}`);
    for (const cell of chunk.cells) {
      cells.push(cell === 0 ? null : cell - 1);
    }
    offset = chunk.offset + chunk.cells.length;
    if (chunk.cells.length === 0 || offset >= chunk.total) break;
  }
  return cells;
}

async function fetchPeripheralGpioPinsOfKind(
  call: Caller,
  zmkApp: ZmkApp,
  subsystemIndex: number,
  source: number,
  deviceIndex: number,
  kind: GpioLineKind,
): Promise<GpioPin[]> {
  const pins: GpioPin[] = [];
  let offset = 0;
  for (let page = 0; page < MAX_PAGES; page++) {
    const { responses: map } = await queryPeripheral(
      call,
      zmkApp,
      subsystemIndex,
      Request.create({ getGpioPins: { deviceIndex, kind, offset } }),
      source,
      PERIPHERAL_RESPONSE_TIMEOUT_MS,
    );
    const chunk = map.get(source)?.gpioPins;
    if (!chunk) throw new Error(`No GpioPins from peripheral ${source}`);
    pins.push(...chunk.pins);
    offset = chunk.offset + chunk.pins.length;
    if (chunk.pins.length === 0 || offset >= chunk.total) break;
  }
  return pins;
}

async function fetchPeripheralGpioLinesByKind(
  call: Caller,
  zmkApp: ZmkApp,
  subsystemIndex: number,
  source: number,
  deviceIndex: number,
): Promise<Record<GpioLineKind, GpioPin[]>> {
  const kinds: GpioLineKind[] = [
    GpioLineKind.ROW,
    GpioLineKind.COL,
    GpioLineKind.INPUT,
    GpioLineKind.OUTPUT,
    GpioLineKind.CHARLIE,
  ];
  const result = {} as Record<GpioLineKind, GpioPin[]>;
  result[GpioLineKind.KIND_UNKNOWN] = [];
  for (const kind of kinds) {
    result[kind] = await fetchPeripheralGpioPinsOfKind(
      call,
      zmkApp,
      subsystemIndex,
      source,
      deviceIndex,
      kind,
    );
  }
  return result;
}

export function useKscanDiagnostics(): UseKscanDiagnosticsReturn {
  const zmkApp = useContext(ZMKAppContext);
  const { subsystem, ready, call } = useCustomSubsystem(
    KSCAN_DIAGNOSTICS_SUBSYSTEM_IDENTIFIER,
    CODEC,
  );
  const [info, setInfo] = useState<Info | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [stats, setStats] = useState<PositionStats[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!ready) return;
    setIsLoading(true);
    setError(null);
    try {
      const infoResp = await callRpc(call, Request.create({ getInfo: {} }));
      const nextInfo = infoResp.info;
      if (!nextInfo) {
        throw new Error("Unexpected response to GetInfo");
      }
      const nextDevices: Device[] = [];
      for (let i = 0; i < nextInfo.deviceCount; i++) {
        const resp = await callRpc(
          call,
          Request.create({ getDevice: { deviceIndex: i } }),
        );
        if (resp.device) {
          nextDevices.push(resp.device);
        }
      }
      const nextStats = nextInfo.statsEnabled ? await fetchStats(call) : [];
      setInfo(nextInfo);
      setDevices(nextDevices);
      setStats(nextStats);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, [ready, call]);

  const resetStats = useCallback(async () => {
    if (!ready) return;
    setIsLoading(true);
    setError(null);
    try {
      await callRpc(call, Request.create({ resetStats: {} }));
      setStats(await fetchStats(call));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, [ready, call]);

  // Auto-fetch when the subsystem becomes available.
  useEffect(() => {
    if (ready) {
      void refresh();
    }
  }, [ready, refresh]);

  const [topology, setTopology] = useState<Topology | null>(null);
  const [isLoadingTopology, setIsLoadingTopology] = useState(false);
  const [topologyError, setTopologyError] = useState<string | null>(null);

  const loadTopology = useCallback(async () => {
    if (!ready) return;
    setIsLoadingTopology(true);
    setTopologyError(null);
    try {
      const t = await fetchTopology(call);
      setTopology(t);
    } catch (err) {
      setTopologyError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoadingTopology(false);
    }
  }, [ready, call]);

  const [peripheralTopologies, setPeripheralTopologies] = useState<
    Map<number, Topology>
  >(() => new Map());
  const [isLoadingPeripheralTopologies, setIsLoadingPeripheralTopologies] =
    useState(false);
  const [peripheralTopologyErrors, setPeripheralTopologyErrors] = useState<
    Map<number, string>
  >(() => new Map());
  const [peripheralDiscoveryError, setPeripheralDiscoveryError] = useState<
    string | null
  >(null);

  const subsystemIndex = subsystem?.index;

  const loadPeripheralTopologies = useCallback(async () => {
    if (!ready || !zmkApp || subsystemIndex === undefined) return;
    setIsLoadingPeripheralTopologies(true);
    setPeripheralTopologies(new Map());
    setPeripheralTopologyErrors(new Map());
    setPeripheralDiscoveryError(null);

    // Discovery: send GetInfo to all peripherals, collect responses within timeout.
    let discoveredSources: number[];
    try {
      const { responses: infoMap, supported } = await queryPeripheral(
        call,
        zmkApp,
        subsystemIndex,
        Request.create({ getInfo: {} }),
      );
      if (!supported) {
        // Firmware doesn't support QueryPeripheral — silently skip.
        setIsLoadingPeripheralTopologies(false);
        return;
      }
      discoveredSources = [...infoMap.keys()];
      if (discoveredSources.length === 0) {
        setPeripheralDiscoveryError(
          "No peripheral responded within the discovery timeout.",
        );
      }
    } catch {
      setIsLoadingPeripheralTopologies(false);
      return;
    }

    // Fetch topology for each discovered peripheral.
    for (const source of discoveredSources) {
      try {
        const t = await fetchPeripheralTopology(
          call,
          zmkApp,
          subsystemIndex,
          source,
        );
        setPeripheralTopologies((prev) => new Map(prev).set(source, t));
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        setPeripheralTopologyErrors((prev) => new Map(prev).set(source, msg));
      }
    }

    setIsLoadingPeripheralTopologies(false);
  }, [ready, zmkApp, subsystemIndex, call]);

  return {
    isAvailable: subsystem !== null,
    info,
    devices,
    stats,
    isLoading,
    error,
    refresh,
    resetStats,
    topology,
    isLoadingTopology,
    topologyError,
    loadTopology,
    peripheralTopologies,
    isLoadingPeripheralTopologies,
    peripheralTopologyErrors,
    peripheralDiscoveryError,
    loadPeripheralTopologies,
  };
}
