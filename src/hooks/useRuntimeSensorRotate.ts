/**
 * useRuntimeSensorRotate Hook
 *
 * This hook provides access to runtime sensor rotation configuration via a custom ZMK subsystem.
 * It allows configuring rotary encoder bindings per layer at runtime without reflashing.
 */
import { useState, useEffect, useCallback, useContext, useMemo } from "react";
import {
  ZMKCustomSubsystem,
  ZMKAppContext,
} from "@cormoran/zmk-studio-react-hook";
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
const SUBSYSTEM_IDENTIFIER = "cormoran_rsr";

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
  const zmkApp = useContext(ZMKAppContext);
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Memoize subsystem to avoid unnecessary re-renders
  const subsystem = useMemo(
    () => zmkApp?.findSubsystem(SUBSYSTEM_IDENTIFIER),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [zmkApp?.state.customSubsystems],
  );

  // Extract subsystem index as a stable primitive value for dependencies
  const subsystemIndex = subsystem?.index;

  const loadSensors = useCallback(async () => {
    if (!zmkApp?.state.connection || subsystemIndex === undefined) {
      setError("Not connected to device or subsystem not found");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const service = new ZMKCustomSubsystem(
        zmkApp.state.connection,
        subsystemIndex,
      );

      const request = Request.create({
        getSensors: {},
      });

      const payload = Request.encode(request).finish();
      const responsePayload = await service.callRPC(payload);

      if (responsePayload) {
        const resp = Response.decode(responsePayload);
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
  }, [zmkApp, subsystemIndex]);

  const getAllLayerBindings = useCallback(
    async (sensorIndex: number): Promise<LayerBindings[]> => {
      if (!zmkApp?.state.connection || subsystemIndex === undefined) {
        setError("Not connected to device or subsystem not found");
        return [];
      }

      setIsLoading(true);
      setError(null);

      try {
        const service = new ZMKCustomSubsystem(
          zmkApp.state.connection,
          subsystemIndex,
        );

        const request = Request.create({
          getAllLayerBindings: {
            sensorIndex,
          },
        });

        const payload = Request.encode(request).finish();
        const responsePayload = await service.callRPC(payload);

        if (responsePayload) {
          const resp = Response.decode(responsePayload);
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
    [zmkApp, subsystemIndex],
  );

  const setLayerCwBindings = useCallback(
    async (
      sensorIndex: number,
      layer: number,
      cwBinding: Binding,
    ): Promise<boolean> => {
      if (!zmkApp?.state.connection || subsystemIndex === undefined) {
        setError("Not connected to device or subsystem not found");
        return false;
      }

      setIsLoading(true);
      setError(null);

      try {
        const service = new ZMKCustomSubsystem(
          zmkApp.state.connection,
          subsystemIndex,
        );

        const request = Request.create({
          setLayerCwBinding: {
            sensorIndex,
            layer,
            binding: cwBinding,
          },
        });

        const payload = Request.encode(request).finish();
        const responsePayload = await service.callRPC(payload);

        if (responsePayload) {
          const resp = Response.decode(responsePayload);
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
    [zmkApp, subsystemIndex],
  );

  const setLayerCcwBindings = useCallback(
    async (
      sensorIndex: number,
      layer: number,
      ccwBinding: Binding,
    ): Promise<boolean> => {
      if (!zmkApp?.state.connection || subsystemIndex === undefined) {
        setError("Not connected to device or subsystem not found");
        return false;
      }

      setIsLoading(true);
      setError(null);

      try {
        const service = new ZMKCustomSubsystem(
          zmkApp.state.connection,
          subsystemIndex,
        );

        const request = Request.create({
          setLayerCcwBinding: {
            sensorIndex,
            layer,
            binding: ccwBinding,
          },
        });

        const payload = Request.encode(request).finish();
        const responsePayload = await service.callRPC(payload);

        if (responsePayload) {
          const resp = Response.decode(responsePayload);
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
    [zmkApp, subsystemIndex],
  );

  // Load sensors when connection or subsystem changes
  useEffect(() => {
    if (subsystemIndex !== undefined && zmkApp?.state.connection) {
      loadSensors();
    } else {
      setSensors([]);
      setError(null);
    }
  }, [subsystemIndex, zmkApp?.state.connection, loadSensors]);

  return {
    isAvailable: subsystemIndex !== undefined,
    sensors,
    isLoading,
    error,
    loadSensors,
    getAllLayerBindings,
    setLayerCwBindings,
    setLayerCcwBindings,
  };
}
