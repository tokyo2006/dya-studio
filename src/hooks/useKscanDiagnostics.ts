import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  ZMKCustomSubsystem,
  ZMKAppContext,
} from "@cormoran/zmk-studio-react-hook";
import {
  Request,
  Response,
  type Device,
  type Info,
  type PositionStats,
} from "../proto/cormoran/kscan_diagnostics/kscan_diagnostics";

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

  return {
    isAvailable: subsystemIndex !== undefined,
    info,
    devices,
    stats,
    isLoading,
    error,
    refresh,
    resetStats,
  };
}
