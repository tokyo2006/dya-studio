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
  Notification,
  SensorInfo,
  LayerSensorConfig,
  SensorBinding,
} from "../proto/zmk/runtime_sensor_rotate/runtime_sensor_rotate";

// Re-export types for convenience
export type { SensorInfo, LayerSensorConfig, SensorBinding };

// Subsystem identifier for ZMK runtime sensor rotate custom protocol
// This should match the identifier registered in the ZMK firmware module
const SUBSYSTEM_IDENTIFIER = "cormoran_rsr";

// Time to wait for all notifications to arrive
const NOTIFICATION_COLLECTION_TIMEOUT_MS = 500;

/**
 * Sensor configuration for a specific layer
 */
export interface SensorLayerConfig {
  layerId: number;
  sensorIndex: number;
  clockwise: SensorBinding;
  counterClockwise: SensorBinding;
  tapMs: number;
}

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
  /** Whether there are unsaved changes */
  hasUnsavedChanges: boolean;
  /** Load all sensors */
  loadSensors: () => Promise<void>;
  /** Get configuration for a sensor on a specific layer */
  getLayerSensorConfig: (
    layerId: number,
    sensorIndex: number,
  ) => Promise<SensorLayerConfig | null>;
  /** Set configuration for a sensor on a specific layer */
  setLayerSensorConfig: (config: SensorLayerConfig) => Promise<boolean>;
  /** Save all changes to persistent storage */
  saveChanges: () => Promise<boolean>;
  /** Discard all unsaved changes */
  discardChanges: () => Promise<boolean>;
  /** Check if there are unsaved changes */
  checkUnsavedChanges: () => Promise<void>;
}

export function useRuntimeSensorRotate(): UseRuntimeSensorRotateReturn {
  const zmkApp = useContext(ZMKAppContext);
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Memoize subsystem to avoid unnecessary re-renders
  const subsystem = useMemo(
    () => zmkApp?.findSubsystem(SUBSYSTEM_IDENTIFIER),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [zmkApp?.state.customSubsystems],
  );

  // Extract subsystem index as a stable primitive value for dependencies
  const subsystemIndex = subsystem?.index;

  // Set up persistent notification listener for updates
  useEffect(() => {
    if (!zmkApp || subsystemIndex === undefined) {
      return;
    }

    const unsubscribe = zmkApp.onNotification({
      type: "custom",
      subsystemIndex,
      callback: (customNotification) => {
        try {
          const notification = Notification.decode(customNotification.payload);

          // Handle unsaved changes status notification
          if (notification.unsavedChangesStatusChanged !== undefined) {
            setHasUnsavedChanges(
              notification.unsavedChangesStatusChanged.hasUnsavedChanges,
            );
          }
        } catch (err) {
          console.error("Failed to decode sensor rotation notification:", err);
        }
      },
    });

    return () => {
      unsubscribe();
    };
  }, [zmkApp, subsystemIndex]);

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
        listSensors: {},
      });

      const payload = Request.encode(request).finish();
      const responsePayload = await service.callRPC(payload);

      if (responsePayload) {
        const resp = Response.decode(responsePayload);
        if (resp.error) {
          setError(resp.error.message);
          return;
        }
        if (resp.listSensors?.sensors) {
          const sensorInfos: Sensor[] = resp.listSensors.sensors.map(
            (s: SensorInfo) => ({
              index: s.index,
              name: s.name,
            }),
          );
          setSensors(sensorInfos);
        }
      }

      // Wait for notifications to arrive
      await new Promise((resolve) =>
        setTimeout(resolve, NOTIFICATION_COLLECTION_TIMEOUT_MS),
      );
    } catch (err) {
      console.error("Failed to load sensors:", err);
      setError(
        `Failed to load sensors: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
    } finally {
      setIsLoading(false);
    }
  }, [zmkApp, subsystemIndex]);

  const getLayerSensorConfig = useCallback(
    async (
      layerId: number,
      sensorIndex: number,
    ): Promise<SensorLayerConfig | null> => {
      if (!zmkApp?.state.connection || subsystemIndex === undefined) {
        setError("Not connected to device or subsystem not found");
        return null;
      }

      setIsLoading(true);
      setError(null);

      try {
        const service = new ZMKCustomSubsystem(
          zmkApp.state.connection,
          subsystemIndex,
        );

        const request = Request.create({
          getLayerSensorConfig: {
            layerId,
            sensorIndex,
          },
        });

        const payload = Request.encode(request).finish();
        const responsePayload = await service.callRPC(payload);

        if (responsePayload) {
          const resp = Response.decode(responsePayload);
          if (resp.error) {
            setError(resp.error.message);
            return null;
          }
          if (resp.getLayerSensorConfig?.config) {
            const config = resp.getLayerSensorConfig.config;
            return {
              layerId: config.layerId,
              sensorIndex: config.sensorIndex,
              clockwise: config.clockwise ?? {
                behaviorId: 0,
                param1: 0,
                param2: 0,
              },
              counterClockwise: config.counterClockwise ?? {
                behaviorId: 0,
                param1: 0,
                param2: 0,
              },
              tapMs: config.tapMs,
            };
          }
        }
        return null;
      } catch (err) {
        console.error("Failed to get layer sensor config:", err);
        setError(
          `Failed to get layer sensor config: ${err instanceof Error ? err.message : "Unknown error"}`,
        );
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [zmkApp, subsystemIndex],
  );

  const setLayerSensorConfig = useCallback(
    async (config: SensorLayerConfig): Promise<boolean> => {
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
          setLayerSensorConfig: {
            config: {
              layerId: config.layerId,
              sensorIndex: config.sensorIndex,
              clockwise: config.clockwise,
              counterClockwise: config.counterClockwise,
              tapMs: config.tapMs,
            },
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
          // Configuration set successfully
          return true;
        }
        return false;
      } catch (err) {
        console.error("Failed to set layer sensor config:", err);
        setError(
          `Failed to set layer sensor config: ${err instanceof Error ? err.message : "Unknown error"}`,
        );
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [zmkApp, subsystemIndex],
  );

  const saveChanges = useCallback(async (): Promise<boolean> => {
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
        saveChanges: {},
      });

      const payload = Request.encode(request).finish();
      const responsePayload = await service.callRPC(payload);

      if (responsePayload) {
        const resp = Response.decode(responsePayload);
        if (resp.error) {
          setError(resp.error.message);
          return false;
        }
        setHasUnsavedChanges(false);
        return true;
      }
      return false;
    } catch (err) {
      console.error("Failed to save changes:", err);
      setError(
        `Failed to save changes: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [zmkApp, subsystemIndex]);

  const discardChanges = useCallback(async (): Promise<boolean> => {
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
        discardChanges: {},
      });

      const payload = Request.encode(request).finish();
      const responsePayload = await service.callRPC(payload);

      if (responsePayload) {
        const resp = Response.decode(responsePayload);
        if (resp.error) {
          setError(resp.error.message);
          return false;
        }
        setHasUnsavedChanges(false);
        return true;
      }
      return false;
    } catch (err) {
      console.error("Failed to discard changes:", err);
      setError(
        `Failed to discard changes: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [zmkApp, subsystemIndex]);

  const checkUnsavedChanges = useCallback(async () => {
    if (!zmkApp?.state.connection || subsystemIndex === undefined) {
      return;
    }

    try {
      const service = new ZMKCustomSubsystem(
        zmkApp.state.connection,
        subsystemIndex,
      );

      const request = Request.create({
        checkUnsavedChanges: {},
      });

      const payload = Request.encode(request).finish();
      const responsePayload = await service.callRPC(payload);

      if (responsePayload) {
        const resp = Response.decode(responsePayload);
        if (resp.error) {
          setError(resp.error.message);
          return;
        }
        if (resp.checkUnsavedChanges) {
          setHasUnsavedChanges(resp.checkUnsavedChanges.hasUnsavedChanges);
        }
      }
    } catch (err) {
      console.error("Failed to check unsaved changes:", err);
    }
  }, [zmkApp, subsystemIndex]);

  // Load sensors when connection or subsystem changes
  useEffect(() => {
    if (subsystemIndex !== undefined && zmkApp?.state.connection) {
      loadSensors();
      checkUnsavedChanges();
    }
  }, [
    subsystemIndex,
    zmkApp?.state.connection,
    loadSensors,
    checkUnsavedChanges,
  ]);

  // Reset state when disconnected
  useEffect(() => {
    if (!zmkApp?.state.connection) {
      setSensors([]);
      setHasUnsavedChanges(false);
      setError(null);
    }
  }, [zmkApp?.state.connection]);

  return {
    isAvailable: subsystemIndex !== undefined,
    sensors,
    isLoading,
    error,
    hasUnsavedChanges,
    loadSensors,
    getLayerSensorConfig,
    setLayerSensorConfig,
    saveChanges,
    discardChanges,
    checkUnsavedChanges,
  };
}
