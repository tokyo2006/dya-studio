import { useState, useEffect, useCallback } from "react";
import { useCustomSubsystem } from "@cormoran/zmk-studio-react-hook";
import {
  Request,
  Response,
  StateResponse,
} from "../proto/cormoran/default_layer/default_layer";

// Subsystem identifier for the ZMK default-layer custom protocol.
// This matches the identifier registered in the zmk-feature-default-layer module.
export const DEFAULT_LAYER_SUBSYSTEM_IDENTIFIER = "cormoran__default_layer";
const SUBSYSTEM_IDENTIFIER = DEFAULT_LAYER_SUBSYSTEM_IDENTIFIER;

const CODEC = {
  encode: (request: Request) => Request.encode(request).finish(),
  decode: (payload: Uint8Array) => Response.decode(payload),
};

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
  const { subsystem, ready, call } = useCustomSubsystem(
    SUBSYSTEM_IDENTIFIER,
    CODEC,
  );
  const [state, setState] = useState<StateResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!ready) {
      return;
    }

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
      console.error("Failed to load default layer state:", err);
      setError(
        `Failed to load default layer state: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
    } finally {
      setIsLoading(false);
    }
  }, [ready, call]);

  const setEndpointLayer = useCallback(
    async (endpointIndex: number, value: number) => {
      if (!ready) return;

      setIsLoading(true);
      setError(null);

      try {
        const resp = await call(
          Request.create({ setEndpointLayer: { endpointIndex, value } }),
        );

        if (resp) {
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
    [ready, call],
  );

  const setOsLayer = useCallback(
    async (os: number, value: number) => {
      if (!ready) return;

      setIsLoading(true);
      setError(null);

      try {
        const resp = await call(Request.create({ setOsLayer: { os, value } }));

        if (resp) {
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
    [ready, call],
  );

  // Load state when connection or subsystem changes.
  useEffect(() => {
    if (ready) {
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  return {
    isAvailable: subsystem !== null,
    state,
    isLoading,
    error,
    load,
    setEndpointLayer,
    setOsLayer,
  };
}
