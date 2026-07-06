import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  ZMKCustomSubsystem,
  ZMKAppContext,
} from "@cormoran/zmk-studio-react-hook";
import {
  GpioLineKind,
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

// Safety valve against a misbehaving firmware paginating forever.
const MAX_PAGES = 2000;

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
}

async function callRpc(
  service: ZMKCustomSubsystem,
  request: Request,
): Promise<Response> {
  const payload = Request.encode(request).finish();
  const responsePayload = await service.callRPC(payload);
  if (!responsePayload) {
    throw new Error("No response from device");
  }
  const resp = Response.decode(responsePayload);
  if (resp.error) {
    throw new Error(resp.error.message);
  }
  return resp;
}

async function fetchStats(
  service: ZMKCustomSubsystem,
): Promise<PositionStats[]> {
  const entries: PositionStats[] = [];
  let offset = 0;
  for (let page = 0; page < MAX_PAGES; page++) {
    const resp = await callRpc(
      service,
      Request.create({ getStats: { offset } }),
    );
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
  service: ZMKCustomSubsystem,
  deviceIndex: number,
  kind: GpioLineKind,
): Promise<GpioPin[]> {
  const pins: GpioPin[] = [];
  let offset = 0;
  for (let page = 0; page < MAX_PAGES; page++) {
    const resp = await callRpc(
      service,
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
  service: ZMKCustomSubsystem,
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
    result[kind] = await fetchGpioPinsOfKind(service, deviceIndex, kind);
  }
  return result;
}

async function fetchPositionMap(
  service: ZMKCustomSubsystem,
  layoutIndex: number,
): Promise<(number | null)[]> {
  const cells: (number | null)[] = [];
  let offset = 0;
  for (let page = 0; page < MAX_PAGES; page++) {
    const resp = await callRpc(
      service,
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
  service: ZMKCustomSubsystem,
  deviceIndex: number,
): Promise<KscanDevice> {
  const resp = await callRpc(
    service,
    Request.create({ getDevice: { deviceIndex } }),
  );
  const d = resp.device;
  if (!d) {
    throw new Error("Unexpected response to GetDevice");
  }
  const gpioLinesByKind = await fetchGpioLinesByKind(service, deviceIndex);
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
  service: ZMKCustomSubsystem,
  layoutIndex: number,
): Promise<KscanLayout> {
  const resp = await callRpc(
    service,
    Request.create({ getLayout: { layoutIndex } }),
  );
  const l = resp.layout;
  if (!l) {
    throw new Error("Unexpected response to GetLayout");
  }
  const positionMap = await fetchPositionMap(service, layoutIndex);
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

async function fetchTopology(service: ZMKCustomSubsystem): Promise<Topology> {
  const infoResp = await callRpc(service, Request.create({ getInfo: {} }));
  const info = infoResp.info;
  if (!info) {
    throw new Error("Unexpected response to GetInfo");
  }

  const layouts: KscanLayout[] = [];
  for (let i = 0; i < info.layoutCount; i++) {
    layouts.push(await fetchLayout(service, i));
  }

  // Every device in device_count is fetched so the wiring overlay works even
  // for devices not attached to the active layout (multi-layout keyboards).
  const devices: KscanDevice[] = [];
  for (let i = 0; i < info.deviceCount; i++) {
    devices.push(await fetchDevice(service, i));
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

export function useKscanDiagnostics(): UseKscanDiagnosticsReturn {
  const zmkApp = useContext(ZMKAppContext);
  const [info, setInfo] = useState<Info | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [stats, setStats] = useState<PositionStats[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subsystem = useMemo(
    () => zmkApp?.findSubsystem(KSCAN_DIAGNOSTICS_SUBSYSTEM_IDENTIFIER),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [zmkApp?.state.customSubsystems],
  );
  const subsystemIndex = subsystem?.index;
  const connection = zmkApp?.state.connection;

  const service = useMemo(() => {
    if (!connection || subsystemIndex === undefined) return null;
    return new ZMKCustomSubsystem(connection, subsystemIndex);
  }, [connection, subsystemIndex]);

  const refresh = useCallback(async () => {
    if (!service) return;
    setIsLoading(true);
    setError(null);
    try {
      const infoResp = await callRpc(service, Request.create({ getInfo: {} }));
      const nextInfo = infoResp.info;
      if (!nextInfo) {
        throw new Error("Unexpected response to GetInfo");
      }
      const nextDevices: Device[] = [];
      for (let i = 0; i < nextInfo.deviceCount; i++) {
        const resp = await callRpc(
          service,
          Request.create({ getDevice: { deviceIndex: i } }),
        );
        if (resp.device) {
          nextDevices.push(resp.device);
        }
      }
      const nextStats = nextInfo.statsEnabled ? await fetchStats(service) : [];
      setInfo(nextInfo);
      setDevices(nextDevices);
      setStats(nextStats);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, [service]);

  const resetStats = useCallback(async () => {
    if (!service) return;
    setIsLoading(true);
    setError(null);
    try {
      await callRpc(service, Request.create({ resetStats: {} }));
      setStats(await fetchStats(service));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, [service]);

  // Auto-fetch when the subsystem becomes available.
  useEffect(() => {
    if (service) {
      void refresh();
    }
  }, [service, refresh]);

  const [topology, setTopology] = useState<Topology | null>(null);
  const [isLoadingTopology, setIsLoadingTopology] = useState(false);
  const [topologyError, setTopologyError] = useState<string | null>(null);

  const loadTopology = useCallback(async () => {
    if (!service) return;
    setIsLoadingTopology(true);
    setTopologyError(null);
    try {
      const t = await fetchTopology(service);
      setTopology(t);
    } catch (err) {
      setTopologyError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoadingTopology(false);
    }
  }, [service]);

  return {
    isAvailable: subsystemIndex !== undefined,
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
  };
}
