import { useState, useEffect, useCallback, useRef } from "react";
import { useCustomSubsystem } from "./useCustomSubsystem";
import {
  Request,
  Response,
  StateResponse,
  Os,
} from "../proto/cormoran/os_detection/os_detection";

// Subsystem identifier for the ZMK OS detection custom protocol.
// This matches the identifier registered in the zmk-feature-os-detection module.
export const OS_DETECTION_SUBSYSTEM_IDENTIFIER = "cormoran__os_detection";
const SUBSYSTEM_IDENTIFIER = OS_DETECTION_SUBSYSTEM_IDENTIFIER;

const CODEC = {
  encode: (request: Request) => Request.encode(request).finish(),
  decode: (payload: Uint8Array) => Response.decode(payload),
};

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
  const { subsystem, ready, call } = useCustomSubsystem(
    SUBSYSTEM_IDENTIFIER,
    CODEC,
  );
  const [state, setState] = useState<StateResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlightRef = useRef(false);

  const load = useCallback(async () => {
    if (!ready) {
      return;
    }
    if (inFlightRef.current) {
      return;
    }
    inFlightRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      const resp = await call(Request.create({ getState: {} }));

      if (resp) {
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
  }, [ready, call]);

  const setBleOverride = useCallback(
    async (profileIndex: number, os: Os) => {
      if (!ready) return;

      setIsLoading(true);
      setError(null);

      try {
        const resp = await call(
          Request.create({ setBleOverride: { profileIndex, os } }),
        );

        if (resp) {
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
    [ready, call, load],
  );

  // Auto-load on connect / subsystem discovery.
  useEffect(() => {
    if (ready) {
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // Poll while mounted and connected, since there are no notifications.
  useEffect(() => {
    if (!ready) {
      return;
    }
    const interval = setInterval(() => {
      load();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [ready, load]);

  return {
    isAvailable: subsystem !== null,
    state,
    isLoading,
    error,
    load,
    setBleOverride,
  };
}
