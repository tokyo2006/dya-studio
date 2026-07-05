import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  ZMKCustomSubsystem,
  ZMKAppContext,
} from "@cormoran/zmk-studio-react-hook";
import { MetaError } from "@zmkfirmware/zmk-studio-ts-client";
import { ErrorConditions } from "@zmkfirmware/zmk-studio-ts-client/meta";
import {
  Request,
  Response,
  type DeviceInfo,
  type ReadDiagnosticsResponse,
} from "../proto/cormoran/pmw3610/pmw3610";

export const PMW3610_SUBSYSTEM_IDENTIFIER = "cormoran__pmw3610";

export interface UsePmw3610Return {
  isAvailable: boolean;
  devices: DeviceInfo[];
  diagnostics: ReadDiagnosticsResponse | null;
  isLoading: boolean;
  error: string | null;
  /** The subsystem is SECURED: true when ZMK Studio is locked. */
  unlockRequired: boolean;
  clearUnlockRequired: () => void;
  refresh: () => Promise<void>;
  readDiagnostics: (deviceIndex: number) => Promise<void>;
}

export function usePmw3610(): UsePmw3610Return {
  const zmkApp = useContext(ZMKAppContext);
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [diagnostics, setDiagnostics] =
    useState<ReadDiagnosticsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unlockRequired, setUnlockRequired] = useState(false);

  const subsystem = useMemo(
    () => zmkApp?.findSubsystem(PMW3610_SUBSYSTEM_IDENTIFIER),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [zmkApp?.state.customSubsystems],
  );
  const subsystemIndex = subsystem?.index;
  const connection = zmkApp?.state.connection;

  const callRpc = useCallback(
    async (request: Request): Promise<Response | null> => {
      if (!connection || subsystemIndex === undefined) return null;
      const service = new ZMKCustomSubsystem(connection, subsystemIndex);
      const payload = Request.encode(request).finish();
      try {
        const responsePayload = await service.callRPC(payload);
        if (!responsePayload) return null;
        setUnlockRequired(false);
        return Response.decode(responsePayload);
      } catch (err) {
        // The pmw3610 subsystem is SECURED: RPC fails with UNLOCK_REQUIRED
        // while ZMK Studio is locked.
        if (
          err instanceof MetaError &&
          err.condition === ErrorConditions.UNLOCK_REQUIRED
        ) {
          setUnlockRequired(true);
          return null;
        }
        throw err;
      }
    },
    [connection, subsystemIndex],
  );

  const refresh = useCallback(async () => {
    if (!connection || subsystemIndex === undefined) return;
    setIsLoading(true);
    setError(null);
    try {
      const resp = await callRpc(Request.create({ getInfo: {} }));
      if (!resp) return;
      if (resp.error) {
        throw new Error(resp.error.message);
      }
      setDevices(resp.getInfo?.devices ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, [connection, subsystemIndex, callRpc]);

  const readDiagnostics = useCallback(
    async (deviceIndex: number) => {
      setError(null);
      try {
        const resp = await callRpc(
          Request.create({ readDiagnostics: { deviceIndex } }),
        );
        if (!resp) return;
        if (resp.error) {
          throw new Error(resp.error.message);
        }
        setDiagnostics(resp.readDiagnostics ?? null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      }
    },
    [callRpc],
  );

  // Auto-fetch sensor info when the subsystem becomes available.
  useEffect(() => {
    if (connection && subsystemIndex !== undefined) {
      void refresh();
    }
  }, [connection, subsystemIndex, refresh]);

  // Retry automatically once the keyboard reports it was unlocked.
  useEffect(() => {
    if (!zmkApp) return;
    return zmkApp.onNotification({
      type: "core",
      callback: (notification) => {
        // LockState.ZMK_STUDIO_CORE_LOCK_STATE_UNLOCKED = 1
        if (notification.lockStateChanged === 1 && unlockRequired) {
          setUnlockRequired(false);
          void refresh();
        }
      },
    });
  }, [zmkApp, unlockRequired, refresh]);

  const clearUnlockRequired = useCallback(() => setUnlockRequired(false), []);

  return {
    isAvailable: subsystemIndex !== undefined,
    devices,
    diagnostics,
    isLoading,
    error,
    unlockRequired,
    clearUnlockRequired,
    refresh,
    readDiagnostics,
  };
}
