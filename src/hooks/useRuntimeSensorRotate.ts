/**
 * useRuntimeSensorRotate Hook
 *
 * This hook provides access to runtime sensor rotation configuration via a custom ZMK subsystem.
 * It allows configuring rotary encoder bindings per layer at runtime without reflashing.
 */
import { useState, useEffect, useCallback } from "react";
import { useCustomSubsystem, useLockAwareCall } from "./useCustomSubsystem";
import {
  Request,
  Response,
  SensorInfo,
  LayerBindings,
  Binding,
} from "../proto/zmk/runtime_sensor_rotate/runtime_sensor_rotate";

// Re-export types for convenience
export type { SensorInfo, LayerBindings, Binding };

// Subsystem identifier for ZMK runtime sensor rotate custom protocol
// This should match the identifier registered in the ZMK firmware module
export const RUNTIME_SENSOR_ROTATE_SUBSYSTEM_IDENTIFIER = "cormoran_rsr";
const SUBSYSTEM_IDENTIFIER = RUNTIME_SENSOR_ROTATE_SUBSYSTEM_IDENTIFIER;

const CODEC = {
  encode: (request: Request) => Request.encode(request).finish(),
  decode: (payload: Uint8Array) => Response.decode(payload),
};

/**
 * Sensor information
 */
export interface Sensor {
  index: number;
  name: string;
}

/**
 * Return type for useRuntimeSensorRotate hook
 */
export interface UseRuntimeSensorRotateReturn {
  /** Whether the subsystem is available */
  isAvailable: boolean;
  /** List of available sensors */
  sensors: Sensor[];
  /** Whether data is being loaded */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** Load all sensors */
  loadSensors: () => Promise<void>;
  /** Get all layer bindings for a sensor */
  getAllLayerBindings: (sensorIndex: number) => Promise<LayerBindings[]>;
  /** Set bindings for a sensor on a specific layer */
  setLayerCwBindings: (
    sensorIndex: number,
    layer: number,
    cwBinding: Binding,
  ) => Promise<boolean>;
  setLayerCcwBindings: (
    sensorIndex: number,
    layer: number,
    ccwBinding: Binding,
  ) => Promise<boolean>;
}

export function useRuntimeSensorRotate(): UseRuntimeSensorRotateReturn {
  const {
    subsystem,
    ready,
    call: gatedCall,
  } = useCustomSubsystem(SUBSYSTEM_IDENTIFIER, CODEC);
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Map a lock/cancel rejection from the gate to the shared "device is locked"
  // message (rendered via t()); other outcomes pass through unchanged.
  const call = useLockAwareCall(gatedCall, setError);

  const loadSensors = useCallback(async () => {
    if (!ready) {
      setError("Not connected to device or subsystem not found");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const resp = await call(Request.create({ getSensors: {} }));

      if (resp) {
        if (resp.error) {
          setError(resp.error.message);
          return;
        }
        if (resp.getSensors?.sensors) {
          const sensorInfos: Sensor[] = resp.getSensors.sensors.map(
            (s: SensorInfo) => ({
              index: s.index,
              name: s.name,
            }),
          );
          setSensors(sensorInfos);
        }
      }
    } catch (err) {
      console.error("Failed to load sensors:", err);
      setError(
        `Failed to load sensors: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
    } finally {
      setIsLoading(false);
    }
  }, [ready, call]);

  const getAllLayerBindings = useCallback(
    async (sensorIndex: number): Promise<LayerBindings[]> => {
      if (!ready) {
        setError("Not connected to device or subsystem not found");
        return [];
      }

      setIsLoading(true);
      setError(null);

      try {
        const resp = await call(
          Request.create({ getAllLayerBindings: { sensorIndex } }),
        );

        if (resp) {
          if (resp.error) {
            setError(resp.error.message);
            return [];
          }
          if (resp.getAllLayerBindings?.bindings) {
            return resp.getAllLayerBindings.bindings;
          }
        }
        return [];
      } catch (err) {
        console.error("Failed to get all layer bindings:", err);
        setError(
          `Failed to get all layer bindings: ${err instanceof Error ? err.message : "Unknown error"}`,
        );
        return [];
      } finally {
        setIsLoading(false);
      }
    },
    [ready, call],
  );

  const setLayerCwBindings = useCallback(
    async (
      sensorIndex: number,
      layer: number,
      cwBinding: Binding,
    ): Promise<boolean> => {
      if (!ready) {
        setError("Not connected to device or subsystem not found");
        return false;
      }

      setIsLoading(true);
      setError(null);

      try {
        const resp = await call(
          Request.create({
            setLayerCwBinding: { sensorIndex, layer, binding: cwBinding },
          }),
        );

        if (resp) {
          if (resp.error) {
            setError(resp.error.message);
            return false;
          }
          if (resp.setLayerCwBinding) {
            return resp.setLayerCwBinding.success;
          }
        }
        return false;
      } catch (err) {
        console.error("Failed to set layer bindings:", err);
        setError(
          `Failed to set layer cw bindings: ${err instanceof Error ? err.message : "Unknown error"}`,
        );
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [ready, call],
  );

  const setLayerCcwBindings = useCallback(
    async (
      sensorIndex: number,
      layer: number,
      ccwBinding: Binding,
    ): Promise<boolean> => {
      if (!ready) {
        setError("Not connected to device or subsystem not found");
        return false;
      }

      setIsLoading(true);
      setError(null);

      try {
        const resp = await call(
          Request.create({
            setLayerCcwBinding: { sensorIndex, layer, binding: ccwBinding },
          }),
        );

        if (resp) {
          if (resp.error) {
            setError(resp.error.message);
            return false;
          }
          if (resp.setLayerCcwBinding) {
            return resp.setLayerCcwBinding.success;
          }
        }
        return false;
      } catch (err) {
        console.error("Failed to set layer bindings:", err);
        setError(
          `Failed to set layer ccw bindings: ${err instanceof Error ? err.message : "Unknown error"}`,
        );
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [ready, call],
  );

  // Load sensors when connection or subsystem changes
  useEffect(() => {
    if (ready) {
      loadSensors();
    } else {
      setSensors([]);
      setError(null);
    }
  }, [ready, loadSensors]);

  return {
    isAvailable: subsystem !== null,
    sensors,
    isLoading,
    error,
    loadSensors,
    getAllLayerBindings,
    setLayerCwBindings,
    setLayerCcwBindings,
  };
}
