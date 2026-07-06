import { useState, useEffect, useCallback, useContext, useMemo } from "react";
import {
  ZMKCustomSubsystem,
  ZMKAppContext,
} from "@cormoran/zmk-studio-react-hook";
import {
  Request,
  Response,
  StateResponse,
} from "../proto/cormoran/default_layer/default_layer";

// Subsystem identifier for the ZMK default-layer custom protocol.
// This matches the identifier registered in the zmk-feature-default-layer module.
const SUBSYSTEM_IDENTIFIER = "cormoran__default_layer";

export interface UseDefaultLayerReturn {
  isAvailable: boolean;
  state: StateResponse | null;
  isLoading: boolean;
  error: string | null;
  load: () => Promise<void>;
  setEndpointLayer: (endpointIndex: number, value: number) => Promise<void>;
  setOsLayer: (os: number, value: number) => Promise<void>;
}

export function useDefaultLayer(): UseDefaultLayerReturn {
  const zmkApp = useContext(ZMKAppContext);
  const [state, setState] = useState<StateResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      console.error("Failed to load default layer state:", err);
      setError(
        `Failed to load default layer state: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
    } finally {
      setIsLoading(false);
    }
  }, [connection, subsystemIndex]);

  const setEndpointLayer = useCallback(
    async (endpointIndex: number, value: number) => {
      if (!connection || subsystemIndex === undefined) return;

      setIsLoading(true);
      setError(null);

      try {
        const service = new ZMKCustomSubsystem(connection, subsystemIndex);
        const request = Request.create({
          setEndpointLayer: { endpointIndex, value },
        });
        const payload = Request.encode(request).finish();
        const responsePayload = await service.callRPC(payload);

        if (responsePayload) {
          const resp = Response.decode(responsePayload);
          if (resp.state) {
            // Response contains the full refreshed state - use it directly.
            setState(resp.state);
          } else if (resp.error) {
            setError(resp.error.message);
          }
        }
      } catch (err) {
        console.error("Failed to set endpoint default layer:", err);
        setError(
          `Failed to set endpoint default layer: ${err instanceof Error ? err.message : "Unknown error"}`,
        );
      } finally {
        setIsLoading(false);
      }
    },
    [connection, subsystemIndex],
  );

  const setOsLayer = useCallback(
    async (os: number, value: number) => {
      if (!connection || subsystemIndex === undefined) return;

      setIsLoading(true);
      setError(null);

      try {
        const service = new ZMKCustomSubsystem(connection, subsystemIndex);
        const request = Request.create({ setOsLayer: { os, value } });
        const payload = Request.encode(request).finish();
        const responsePayload = await service.callRPC(payload);

        if (responsePayload) {
          const resp = Response.decode(responsePayload);
          if (resp.state) {
            // Response contains the full refreshed state - use it directly.
            setState(resp.state);
          } else if (resp.error) {
            setError(resp.error.message);
          }
        }
      } catch (err) {
        console.error("Failed to set per-OS default layer:", err);
        setError(
          `Failed to set per-OS default layer: ${err instanceof Error ? err.message : "Unknown error"}`,
        );
      } finally {
        setIsLoading(false);
      }
    },
    [connection, subsystemIndex],
  );

  // Load state when connection or subsystem changes.
  useEffect(() => {
    if (subsystemIndex !== undefined && connection) {
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subsystemIndex, connection]);

  return {
    isAvailable: subsystemIndex !== undefined,
    state,
    isLoading,
    error,
    load,
    setEndpointLayer,
    setOsLayer,
  };
}
