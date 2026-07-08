import { useCallback, useEffect, useState } from "react";
import { useCustomSubsystem } from "@cormoran/zmk-studio-react-hook";
import {
  Request,
  Response,
  type DeviceInfoResponse,
} from "../proto/zmk/device_info/device_info";

export const DEVICE_INFO_SUBSYSTEM_IDENTIFIER = "zmk__device_info";

const CODEC = {
  encode: (request: Request) => Request.encode(request).finish(),
  decode: (payload: Uint8Array) => Response.decode(payload),
};

export interface UseDeviceInfoReturn {
  isAvailable: boolean;
  info: DeviceInfoResponse | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useDeviceInfo(): UseDeviceInfoReturn {
  const { subsystem, ready, call } = useCustomSubsystem(
    DEVICE_INFO_SUBSYSTEM_IDENTIFIER,
    CODEC,
  );
  const [info, setInfo] = useState<DeviceInfoResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!ready) {
      setError("Not connected to device or subsystem not found");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const resp = await call(Request.create({ getDeviceInfo: {} }));
      if (!resp) {
        throw new Error("No response from device");
      }
      if (resp.error) {
        throw new Error(resp.error.message);
      }
      setInfo(resp.deviceInfo ?? null);
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

  return {
    isAvailable: subsystem !== null,
    info,
    isLoading,
    error,
    refresh,
  };
}
