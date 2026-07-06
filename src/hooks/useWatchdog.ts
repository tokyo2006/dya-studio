import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  ZMKCustomSubsystem,
  ZMKAppContext,
} from "@cormoran/zmk-studio-react-hook";
import {
  Request,
  Response,
  Notification,
  type Incident,
  type StatusResponse,
} from "../proto/cormoran/watchdog/watchdog";

export const WATCHDOG_SUBSYSTEM_IDENTIFIER = "cormoran__watchdog";

// How long to wait for a split peripheral to answer a relayed request
// before giving up — there is no way to know which peripheral slots are
// connected, so a request to a missing peripheral would hang forever.
const RELAY_TIMEOUT_MS = 3000;

// Safety valve against a misbehaving firmware paginating forever.
const MAX_PAGES = 64;

export interface UseWatchdogReturn {
  isAvailable: boolean;
  /** 0 = central/local, N>0 = split peripheral slot N. */
  source: number;
  setSource: (source: number) => void;
  status: StatusResponse | null;
  incidents: Incident[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  deleteOne: (id: number) => Promise<void>;
  deleteAll: () => Promise<void>;
}

export function useWatchdog(): UseWatchdogReturn {
  const zmkApp = useContext(ZMKAppContext);
  const [source, setSource] = useState(0);
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subsystem = useMemo(
    () => zmkApp?.findSubsystem(WATCHDOG_SUBSYSTEM_IDENTIFIER),
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
      const responsePayload = await service.callRPC(payload);
      if (!responsePayload) return null;
      return Response.decode(responsePayload);
    },
    [connection, subsystemIndex],
  );

  // Awaits the real Response for a request that came back as a
  // DeferredResponse (source > 0): the answer arrives later as a
  // PeripheralResponse custom notification, or null after RELAY_TIMEOUT_MS.
  const awaitPeripheralResponse = useCallback(
    (requestId: number): Promise<Response | null> => {
      return new Promise((resolve) => {
        if (!zmkApp || subsystemIndex === undefined) {
          resolve(null);
          return;
        }
        let settled = false;
        const finish = (value: Response | null) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          unsubscribe();
          resolve(value);
        };
        const unsubscribe = zmkApp.onNotification({
          type: "custom",
          subsystemIndex,
          callback: (customNotification) => {
            let notification: Notification;
            try {
              notification = Notification.decode(customNotification.payload);
            } catch {
              return;
            }
            const pr = notification.peripheralResponse;
            if (pr && pr.requestId === requestId) {
              finish(pr.response ?? null);
            }
          },
        });
        const timer = setTimeout(() => finish(null), RELAY_TIMEOUT_MS);
      });
    },
    [zmkApp, subsystemIndex],
  );

  // Calls the RPC and, when the firmware relayed it to a split peripheral
  // (DeferredResponse), waits for the real answer instead.
  const callRpcAwaitingRelay = useCallback(
    async (request: Request): Promise<Response | null> => {
      const resp = await callRpc(request);
      if (!resp?.deferred) return resp;
      const relayed = await awaitPeripheralResponse(resp.deferred.requestId);
      if (!relayed) {
        setError(
          `Peripheral did not respond (timed out after ${RELAY_TIMEOUT_MS}ms). It may be disconnected.`,
        );
      }
      return relayed;
    },
    [callRpc, awaitPeripheralResponse],
  );

  const refreshStatus = useCallback(async () => {
    const resp = await callRpcAwaitingRelay(
      Request.create({ getStatus: { source } }),
    );
    if (resp?.status) {
      setStatus(resp.status);
    } else if (resp?.error) {
      setError(resp.error.message);
    }
  }, [callRpcAwaitingRelay, source]);

  const refreshIncidents = useCallback(async () => {
    const collected: Incident[] = [];
    let startIndex = 0;
    // Pages hold at most 4 incidents; loop until `total` collected.
    for (let guard = 0; guard < MAX_PAGES; guard++) {
      const resp = await callRpcAwaitingRelay(
        Request.create({ listIncidents: { startIndex, source } }),
      );
      if (!resp?.incidentPage) {
        if (resp?.error) {
          setError(resp.error.message);
        }
        break;
      }
      collected.push(...resp.incidentPage.incidents);
      startIndex += resp.incidentPage.incidents.length;
      if (
        resp.incidentPage.incidents.length === 0 ||
        startIndex >= resp.incidentPage.total
      ) {
        break;
      }
    }
    setIncidents(collected);
  }, [callRpcAwaitingRelay, source]);

  const refresh = useCallback(async () => {
    if (!connection || subsystemIndex === undefined) return;
    setIsLoading(true);
    setError(null);
    try {
      await refreshStatus();
      await refreshIncidents();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load incidents");
    } finally {
      setIsLoading(false);
    }
  }, [connection, subsystemIndex, refreshStatus, refreshIncidents]);

  // Auto-load when the subsystem becomes available or the source changes.
  useEffect(() => {
    if (connection && subsystemIndex !== undefined) {
      void refresh();
    }
  }, [connection, subsystemIndex, source, refresh]);

  // Live incident push: firmware notifies whenever a new incident is
  // persisted on the local (central) store.
  useEffect(() => {
    if (!zmkApp || subsystemIndex === undefined) return;
    return zmkApp.onNotification({
      type: "custom",
      subsystemIndex,
      callback: (customNotification) => {
        let notification: Notification;
        try {
          notification = Notification.decode(customNotification.payload);
        } catch {
          return;
        }
        const incident = notification.incidentRecorded?.incident;
        if (incident && source === 0) {
          setIncidents((prev) => [
            incident,
            ...prev.filter((i) => i.id !== incident.id),
          ]);
          void refreshStatus();
        }
      },
    });
  }, [zmkApp, subsystemIndex, source, refreshStatus]);

  const deleteIncidents = useCallback(
    async (ids: number[], all: boolean) => {
      setIsLoading(true);
      setError(null);
      try {
        const resp = await callRpcAwaitingRelay(
          Request.create({ deleteIncidents: { ids, all, source } }),
        );
        if (resp?.error) {
          setError(resp.error.message);
        }
        await refreshStatus();
        await refreshIncidents();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to delete incidents",
        );
      } finally {
        setIsLoading(false);
      }
    },
    [callRpcAwaitingRelay, source, refreshStatus, refreshIncidents],
  );

  const deleteOne = useCallback(
    (id: number) => deleteIncidents([id], false),
    [deleteIncidents],
  );
  const deleteAll = useCallback(
    () => deleteIncidents([], true),
    [deleteIncidents],
  );

  return {
    isAvailable: subsystemIndex !== undefined,
    source,
    setSource,
    status,
    incidents,
    isLoading,
    error,
    refresh,
    deleteOne,
    deleteAll,
  };
}
