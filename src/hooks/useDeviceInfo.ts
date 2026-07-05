import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  ZMKCustomSubsystem,
  ZMKAppContext,
} from "@cormoran/zmk-studio-react-hook";
import {
  Request,
  Response,
  type DeviceInfoResponse,
} from "../proto/zmk/device_info/device_info";

export const DEVICE_INFO_SUBSYSTEM_IDENTIFIER = "zmk__device_info";

export interface UseDeviceInfoReturn {
  isAvailable: boolean;
  info: DeviceInfoResponse | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useDeviceInfo(): UseDeviceInfoReturn {
  const zmkApp = useContext(ZMKAppContext);
  const [info, setInfo] = useState<DeviceInfoResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subsystem = useMemo(
    () => zmkApp?.findSubsystem(DEVICE_INFO_SUBSYSTEM_IDENTIFIER),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [zmkApp?.state.customSubsystems],
  );
  const subsystemIndex = subsystem?.index;
  const connection = zmkApp?.state.connection;

  const refresh = useCallback(async () => {
    if (!connection || subsystemIndex === undefined) {
      setError("Not connected to device or subsystem not found");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const service = new ZMKCustomSubsystem(connection, subsystemIndex);
      const payload = Request.encode(
        Request.create({ getDeviceInfo: {} }),
      ).finish();
      const responsePayload = await service.callRPC(payload);
      if (!responsePayload) {
        throw new Error("No response from device");
      }
      const resp = Response.decode(responsePayload);
      if (resp.error) {
        throw new Error(resp.error.message);
      }
      setInfo(resp.deviceInfo ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, [connection, subsystemIndex]);

  // Auto-fetch when the subsystem becomes available.
  useEffect(() => {
    if (connection && subsystemIndex !== undefined) {
      void refresh();
    }
  }, [connection, subsystemIndex, refresh]);

  return {
    isAvailable: subsystemIndex !== undefined,
    info,
    isLoading,
    error,
    refresh,
  };
}
