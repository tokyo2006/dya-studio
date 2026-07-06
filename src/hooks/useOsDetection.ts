import {
  useState,
  useEffect,
  useCallback,
  useContext,
  useMemo,
  useRef,
} from "react";
import {
  ZMKCustomSubsystem,
  ZMKAppContext,
} from "@cormoran/zmk-studio-react-hook";
import {
  Request,
  Response,
  StateResponse,
  Os,
} from "../proto/cormoran/os_detection/os_detection";

// Subsystem identifier for the ZMK OS detection custom protocol.
// This matches the identifier registered in the zmk-feature-os-detection module.
const SUBSYSTEM_IDENTIFIER = "cormoran__os_detection";

// Poll interval while connected: OS detection has no notifications, so we
// have to poll to reflect state changes made on the device itself.
const POLL_INTERVAL_MS = 5000;

export interface UseOsDetectionReturn {
  isAvailable: boolean;
  state: StateResponse | null;
  isLoading: boolean;
  error: string | null;
  load: () => Promise<void>;
  setBleOverride: (profileIndex: number, os: Os) => Promise<void>;
}

export function useOsDetection(): UseOsDetectionReturn {
  const zmkApp = useContext(ZMKAppContext);
  const [state, setState] = useState<StateResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlightRef = useRef(false);

  const subsystem = useMemo(
    () => zmkApp?.findSubsystem(SUBSYSTEM_IDENTIFIER),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [zmkApp?.state.customSubsystems],
  );

  const subsystemIndex = subsystem?.index;
  const connection = zmkApp?.state.connection;

  const load = useCallback(async () => {
    if (!connection || subsystemIndex === undefined) {
      return;
    }
    if (inFlightRef.current) {
      return;
    }
    inFlightRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      const service = new ZMKCustomSubsystem(connection, subsystemIndex);
      const request = Request.create({ getState: {} });
      const payload = Request.encode(request).finish();
      const responsePayload = await service.callRPC(payload);

      if (responsePayload) {
        const resp = Response.decode(responsePayload);
        if (resp.state) {
          setState(resp.state);
        } else if (resp.error) {
          setError(resp.error.message);
        }
      }
    } catch (err) {
      console.error("Failed to load OS detection state:", err);
      setError(
        `Failed to load OS detection state: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
    } finally {
      inFlightRef.current = false;
      setIsLoading(false);
    }
  }, [connection, subsystemIndex]);

  const setBleOverride = useCallback(
    async (profileIndex: number, os: Os) => {
      if (!connection || subsystemIndex === undefined) return;

      setIsLoading(true);
      setError(null);

      try {
        const service = new ZMKCustomSubsystem(connection, subsystemIndex);
        const request = Request.create({
          setBleOverride: { profileIndex, os },
        });
        const payload = Request.encode(request).finish();
        const responsePayload = await service.callRPC(payload);

        if (responsePayload) {
          const resp = Response.decode(responsePayload);
          if (resp.setBleOverride) {
            // Response only contains the single updated profile; refetch
            // the full state so the rest of the UI stays consistent.
            await load();
          } else if (resp.error) {
            setError(resp.error.message);
          }
        }
      } catch (err) {
        console.error("Failed to set BLE OS override:", err);
        setError(
          `Failed to set BLE OS override: ${err instanceof Error ? err.message : "Unknown error"}`,
        );
      } finally {
        setIsLoading(false);
      }
    },
    [connection, subsystemIndex, load],
  );

  // Auto-load on connect / subsystem discovery.
  useEffect(() => {
    if (subsystemIndex !== undefined && connection) {
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subsystemIndex, connection]);

  // Poll while mounted and connected, since there are no notifications.
  useEffect(() => {
    if (subsystemIndex === undefined || !connection) {
      return;
    }
    const interval = setInterval(() => {
      load();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [subsystemIndex, connection, load]);

  return {
    isAvailable: subsystemIndex !== undefined,
    state,
    isLoading,
    error,
    load,
    setBleOverride,
  };
}
