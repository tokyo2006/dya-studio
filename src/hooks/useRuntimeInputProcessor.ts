import { useState, useEffect, useCallback, useContext, useMemo } from "react";
import {
  ZMKCustomSubsystem,
  ZMKAppContext,
} from "@cormoran/zmk-studio-react-hook";
import {
  Request,
  Response,
  Notification,
  LayerInfo,
  AxisSnapMode,
} from "../proto/zmk/runtime_input_processor/runtime_input_processor";

// Re-export AxisSnapMode for convenience
export { AxisSnapMode };

// Subsystem identifier for ZMK runtime input processor custom protocol
// This matches the identifier registered in the ZMK firmware module
const SUBSYSTEM_IDENTIFIER = "cormoran_rip";

// Time to wait for all notifications to arrive after requesting processors
const NOTIFICATION_COLLECTION_TIMEOUT_MS = 500;

// Helper function to find GCD (Greatest Common Divisor) using Euclidean algorithm
function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b !== 0) {
    const temp = b;
    b = a % b;
    a = temp;
  }
  return a;
}

// Helper function to simplify a fraction to lowest terms
function simplifyFraction(
  multiplier: number,
  divisor: number,
): { multiplier: number; divisor: number } {
  if (divisor === 0) return { multiplier, divisor };
  const divisorValue = gcd(multiplier, divisor);
  return {
    multiplier: multiplier / divisorValue,
    divisor: divisor / divisorValue,
  };
}

export interface InputProcessor {
  id: number;
  name: string;
  scaleMultiplier: number;
  scaleDivisor: number;
  rotationDegrees: number;
  tempLayerEnabled: boolean;
  tempLayerLayer: number;
  tempLayerActivationDelayMs: number;
  tempLayerDeactivationDelayMs: number;
  activeLayers: number; // Bitmask of active layers (0 = all layers)
  axisSnapMode: AxisSnapMode;
  axisSnapThreshold: number;
  axisSnapTimeoutMs: number;
  xInvert: boolean;
  yInvert: boolean;
  xyToScrollEnabled: boolean;
  xySwapEnabled: boolean;
}

export interface LayerInformation {
  id: number;
  name: string;
}

export interface UseRuntimeInputProcessorReturn {
  isAvailable: boolean;
  processors: InputProcessor[];
  layers: LayerInformation[];
  isLoading: boolean;
  error: string | null;
  loadProcessors: () => Promise<void>;
  loadLayers: () => Promise<void>;
  setScaling: (
    id: number,
    multiplier: number,
    divisor: number,
  ) => Promise<void>;
  setRotation: (id: number, degrees: number) => Promise<void>;
  setTempLayerEnabled: (id: number, enabled: boolean) => Promise<void>;
  setTempLayerLayer: (id: number, layer: number) => Promise<void>;
  setTempLayerActivationDelay: (id: number, delayMs: number) => Promise<void>;
  setTempLayerDeactivationDelay: (id: number, delayMs: number) => Promise<void>;
  setActiveLayers: (id: number, layersBitmask: number) => Promise<void>;
  setAxisSnapMode: (id: number, mode: AxisSnapMode) => Promise<void>;
  setAxisSnapThreshold: (id: number, threshold: number) => Promise<void>;
  setAxisSnapTimeout: (id: number, timeoutMs: number) => Promise<void>;
  setXInvert: (id: number, invert: boolean) => Promise<void>;
  setYInvert: (id: number, invert: boolean) => Promise<void>;
  setXyToScrollEnabled: (id: number, enabled: boolean) => Promise<void>;
  setXySwapEnabled: (id: number, enabled: boolean) => Promise<void>;
}

export function useRuntimeInputProcessor(): UseRuntimeInputProcessorReturn {
  const zmkApp = useContext(ZMKAppContext);
  const [processors, setProcessors] = useState<InputProcessor[]>([]);
  const [layers, setLayers] = useState<LayerInformation[]>([]);
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

  // Set up persistent notification listener for processor updates
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
          if (notification.processorChanged?.processor) {
            const processorInfo = notification.processorChanged.processor;
            const updatedProcessor: InputProcessor = {
              id: processorInfo.id,
              name: processorInfo.name,
              scaleMultiplier: processorInfo.scaleMultiplier,
              scaleDivisor: processorInfo.scaleDivisor,
              rotationDegrees: processorInfo.rotationDegrees,
              tempLayerEnabled: processorInfo.tempLayerEnabled,
              tempLayerLayer: processorInfo.tempLayerLayer,
              tempLayerActivationDelayMs:
                processorInfo.tempLayerActivationDelayMs,
              tempLayerDeactivationDelayMs:
                processorInfo.tempLayerDeactivationDelayMs,
              activeLayers: processorInfo.activeLayers || 0,
              axisSnapMode:
                processorInfo.axisSnapMode ?? AxisSnapMode.AXIS_SNAP_MODE_NONE,
              axisSnapThreshold: processorInfo.axisSnapThreshold ?? 0,
              axisSnapTimeoutMs: processorInfo.axisSnapTimeoutMs ?? 0,
              xInvert: processorInfo.xInvert ?? false,
              yInvert: processorInfo.yInvert ?? false,
              xyToScrollEnabled: processorInfo.xyToScrollEnabled ?? false,
              xySwapEnabled: processorInfo.xySwapEnabled ?? false,
            };

            // Update only the specific processor that changed
            setProcessors((prev) => {
              const index = prev.findIndex((p) => p.id === updatedProcessor.id);
              if (index >= 0) {
                const newProcessors = [...prev];
                newProcessors[index] = updatedProcessor;
                return newProcessors;
              } else {
                return [...prev, updatedProcessor];
              }
            });
          }
        } catch (err) {
          console.error("Failed to decode processor notification:", err);
        }
      },
    });

    return () => {
      unsubscribe();
    };
  }, [zmkApp, subsystemIndex]);

  const updateProcessorOptimistically = useCallback(
    (id: number, fields: Partial<InputProcessor>) => {
      setProcessors((prev) =>
        prev.map((processor) =>
          processor.id === id
            ? {
                ...processor,
                ...fields,
              }
            : processor,
        ),
      );
    },
    [],
  );

  const loadProcessors = useCallback(async () => {
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

      // Send request to list processors
      // The actual processor data will come via notifications handled by the useEffect above
      const request = Request.create({
        listProcessors: {},
      });

      const payload = Request.encode(request).finish();
      const responsePayload = await service.callRPC(payload);

      if (responsePayload) {
        const resp = Response.decode(responsePayload);
        if (resp.error) {
          setError(resp.error.message);
        }
      }

      // Wait for notifications to arrive
      await new Promise((resolve) =>
        setTimeout(resolve, NOTIFICATION_COLLECTION_TIMEOUT_MS),
      );
    } catch (err) {
      console.error("Failed to load processors:", err);
      setError(
        `Failed to load processors: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
    } finally {
      setIsLoading(false);
    }
  }, [zmkApp, subsystemIndex]);

  const setScaling = useCallback(
    async (id: number, multiplier: number, divisor: number) => {
      if (!zmkApp?.state.connection || subsystemIndex === undefined) return;

      setIsLoading(true);
      setError(null);

      try {
        const service = new ZMKCustomSubsystem(
          zmkApp.state.connection,
          subsystemIndex,
        );

        // Simplify the fraction to reduce risk of overflow
        const simplified = simplifyFraction(multiplier, divisor);

        // Set multiplier
        const multiplierRequest = Request.create({
          setScaleMultiplier: {
            id,
            value: simplified.multiplier,
          },
        });

        const multiplierPayload = Request.encode(multiplierRequest).finish();
        const multiplierResponse = await service.callRPC(multiplierPayload);

        if (multiplierResponse) {
          const resp = Response.decode(multiplierResponse);
          if (resp.error) {
            setError(resp.error.message);
            return;
          }
        }

        updateProcessorOptimistically(id, {
          scaleMultiplier: simplified.multiplier,
          scaleDivisor: simplified.divisor,
        });

        // Set divisor
        const divisorRequest = Request.create({
          setScaleDivisor: {
            id,
            value: simplified.divisor,
          },
        });

        const divisorPayload = Request.encode(divisorRequest).finish();
        const divisorResponse = await service.callRPC(divisorPayload);

        if (divisorResponse) {
          const resp = Response.decode(divisorResponse);
          if (resp.error) {
            setError(resp.error.message);
            return;
          }
        }
      } catch (err) {
        console.error("Failed to set scaling:", err);
        setError(
          `Failed to set scaling: ${err instanceof Error ? err.message : "Unknown error"}`,
        );
      } finally {
        setIsLoading(false);
      }
    },
    [zmkApp, subsystemIndex, updateProcessorOptimistically],
  );

  const setRotation = useCallback(
    async (id: number, degrees: number) => {
      if (!zmkApp?.state.connection || subsystemIndex === undefined) return;

      setIsLoading(true);
      setError(null);

      try {
        const service = new ZMKCustomSubsystem(
          zmkApp.state.connection,
          subsystemIndex,
        );

        updateProcessorOptimistically(id, { rotationDegrees: degrees });

        const request = Request.create({
          setRotation: {
            id,
            value: degrees,
          },
        });

        const payload = Request.encode(request).finish();
        const responsePayload = await service.callRPC(payload);

        if (responsePayload) {
          const resp = Response.decode(responsePayload);
          if (resp.error) {
            setError(resp.error.message);
            return;
          }
        }
      } catch (err) {
        console.error("Failed to set rotation:", err);
        setError(
          `Failed to set rotation: ${err instanceof Error ? err.message : "Unknown error"}`,
        );
      } finally {
        setIsLoading(false);
      }
    },
    [zmkApp, subsystemIndex, updateProcessorOptimistically],
  );

  const setTempLayerEnabled = useCallback(
    async (id: number, enabled: boolean) => {
      if (!zmkApp?.state.connection || subsystemIndex === undefined) return;

      setIsLoading(true);
      setError(null);

      try {
        const service = new ZMKCustomSubsystem(
          zmkApp.state.connection,
          subsystemIndex,
        );

        updateProcessorOptimistically(id, { tempLayerEnabled: enabled });

        const request = Request.create({
          setTempLayerEnabled: {
            id,
            enabled,
          },
        });

        const payload = Request.encode(request).finish();
        const responsePayload = await service.callRPC(payload);

        if (responsePayload) {
          const resp = Response.decode(responsePayload);
          if (resp.error) {
            setError(resp.error.message);
            return;
          }
        }
      } catch (err) {
        console.error("Failed to set temp layer enabled:", err);
        setError(
          `Failed to set temp layer enabled: ${err instanceof Error ? err.message : "Unknown error"}`,
        );
      } finally {
        setIsLoading(false);
      }
    },
    [zmkApp, subsystemIndex, updateProcessorOptimistically],
  );

  const setTempLayerLayer = useCallback(
    async (id: number, layer: number) => {
      if (!zmkApp?.state.connection || subsystemIndex === undefined) return;

      setIsLoading(true);
      setError(null);

      try {
        const service = new ZMKCustomSubsystem(
          zmkApp.state.connection,
          subsystemIndex,
        );

        updateProcessorOptimistically(id, { tempLayerLayer: layer });

        const request = Request.create({
          setTempLayerLayer: {
            id,
            layer,
          },
        });

        const payload = Request.encode(request).finish();
        const responsePayload = await service.callRPC(payload);

        if (responsePayload) {
          const resp = Response.decode(responsePayload);
          if (resp.error) {
            setError(resp.error.message);
            return;
          }
        }
      } catch (err) {
        console.error("Failed to set temp layer:", err);
        setError(
          `Failed to set temp layer: ${err instanceof Error ? err.message : "Unknown error"}`,
        );
      } finally {
        setIsLoading(false);
      }
    },
    [zmkApp, subsystemIndex, updateProcessorOptimistically],
  );

  const setTempLayerActivationDelay = useCallback(
    async (id: number, delayMs: number) => {
      if (!zmkApp?.state.connection || subsystemIndex === undefined) return;

      setIsLoading(true);
      setError(null);

      try {
        const service = new ZMKCustomSubsystem(
          zmkApp.state.connection,
          subsystemIndex,
        );

        updateProcessorOptimistically(id, {
          tempLayerActivationDelayMs: delayMs,
        });

        const request = Request.create({
          setTempLayerActivationDelay: {
            id,
            activationDelayMs: delayMs,
          },
        });

        const payload = Request.encode(request).finish();
        const responsePayload = await service.callRPC(payload);

        if (responsePayload) {
          const resp = Response.decode(responsePayload);
          if (resp.error) {
            setError(resp.error.message);
            return;
          }
        }
      } catch (err) {
        console.error("Failed to set temp layer activation delay:", err);
        setError(
          `Failed to set temp layer activation delay: ${err instanceof Error ? err.message : "Unknown error"}`,
        );
      } finally {
        setIsLoading(false);
      }
    },
    [zmkApp, subsystemIndex, updateProcessorOptimistically],
  );

  const setTempLayerDeactivationDelay = useCallback(
    async (id: number, delayMs: number) => {
      if (!zmkApp?.state.connection || subsystemIndex === undefined) return;

      setIsLoading(true);
      setError(null);

      try {
        const service = new ZMKCustomSubsystem(
          zmkApp.state.connection,
          subsystemIndex,
        );

        updateProcessorOptimistically(id, {
          tempLayerDeactivationDelayMs: delayMs,
        });

        const request = Request.create({
          setTempLayerDeactivationDelay: {
            id,
            deactivationDelayMs: delayMs,
          },
        });

        const payload = Request.encode(request).finish();
        const responsePayload = await service.callRPC(payload);

        if (responsePayload) {
          const resp = Response.decode(responsePayload);
          if (resp.error) {
            setError(resp.error.message);
            return;
          }
        }
      } catch (err) {
        console.error("Failed to set temp layer deactivation delay:", err);
        setError(
          `Failed to set temp layer deactivation delay: ${err instanceof Error ? err.message : "Unknown error"}`,
        );
      } finally {
        setIsLoading(false);
      }
    },
    [zmkApp, subsystemIndex, updateProcessorOptimistically],
  );

  const setActiveLayers = useCallback(
    async (id: number, layersBitmask: number) => {
      if (!zmkApp?.state.connection || subsystemIndex === undefined) return;

      setIsLoading(true);
      setError(null);

      try {
        const service = new ZMKCustomSubsystem(
          zmkApp.state.connection,
          subsystemIndex,
        );

        updateProcessorOptimistically(id, { activeLayers: layersBitmask });

        const request = Request.create({
          setActiveLayers: {
            id,
            layers: layersBitmask,
          },
        });

        const payload = Request.encode(request).finish();
        const responsePayload = await service.callRPC(payload);

        if (responsePayload) {
          const resp = Response.decode(responsePayload);
          if (resp.error) {
            setError(resp.error.message);
            return;
          }
        }
      } catch (err) {
        console.error("Failed to set active layers:", err);
        setError(
          `Failed to set active layers: ${err instanceof Error ? err.message : "Unknown error"}`,
        );
      } finally {
        setIsLoading(false);
      }
    },
    [zmkApp, subsystemIndex, updateProcessorOptimistically],
  );

  const setAxisSnapMode = useCallback(
    async (id: number, mode: AxisSnapMode) => {
      if (!zmkApp?.state.connection || subsystemIndex === undefined) return;

      setIsLoading(true);
      setError(null);

      try {
        const service = new ZMKCustomSubsystem(
          zmkApp.state.connection,
          subsystemIndex,
        );

        updateProcessorOptimistically(id, { axisSnapMode: mode });

        const request = Request.create({
          setAxisSnapMode: {
            id,
            mode,
          },
        });

        const payload = Request.encode(request).finish();
        const responsePayload = await service.callRPC(payload);

        if (responsePayload) {
          const resp = Response.decode(responsePayload);
          if (resp.error) {
            setError(resp.error.message);
            return;
          }
        }
      } catch (err) {
        console.error("Failed to set axis snap mode:", err);
        setError(
          `Failed to set axis snap mode: ${err instanceof Error ? err.message : "Unknown error"}`,
        );
      } finally {
        setIsLoading(false);
      }
    },
    [zmkApp, subsystemIndex, updateProcessorOptimistically],
  );

  const setAxisSnapThreshold = useCallback(
    async (id: number, threshold: number) => {
      if (!zmkApp?.state.connection || subsystemIndex === undefined) return;

      setIsLoading(true);
      setError(null);

      try {
        const service = new ZMKCustomSubsystem(
          zmkApp.state.connection,
          subsystemIndex,
        );

        updateProcessorOptimistically(id, { axisSnapThreshold: threshold });

        const request = Request.create({
          setAxisSnapThreshold: {
            id,
            threshold,
          },
        });

        const payload = Request.encode(request).finish();
        const responsePayload = await service.callRPC(payload);

        if (responsePayload) {
          const resp = Response.decode(responsePayload);
          if (resp.error) {
            setError(resp.error.message);
            return;
          }
        }
      } catch (err) {
        console.error("Failed to set axis snap threshold:", err);
        setError(
          `Failed to set axis snap threshold: ${err instanceof Error ? err.message : "Unknown error"}`,
        );
      } finally {
        setIsLoading(false);
      }
    },
    [zmkApp, subsystemIndex, updateProcessorOptimistically],
  );

  const setAxisSnapTimeout = useCallback(
    async (id: number, timeoutMs: number) => {
      if (!zmkApp?.state.connection || subsystemIndex === undefined) return;

      setIsLoading(true);
      setError(null);

      try {
        const service = new ZMKCustomSubsystem(
          zmkApp.state.connection,
          subsystemIndex,
        );

        updateProcessorOptimistically(id, { axisSnapTimeoutMs: timeoutMs });

        const request = Request.create({
          setAxisSnapTimeout: {
            id,
            timeoutMs,
          },
        });

        const payload = Request.encode(request).finish();
        const responsePayload = await service.callRPC(payload);

        if (responsePayload) {
          const resp = Response.decode(responsePayload);
          if (resp.error) {
            setError(resp.error.message);
            return;
          }
        }
      } catch (err) {
        console.error("Failed to set axis snap timeout:", err);
        setError(
          `Failed to set axis snap timeout: ${err instanceof Error ? err.message : "Unknown error"}`,
        );
      } finally {
        setIsLoading(false);
      }
    },
    [zmkApp, subsystemIndex, updateProcessorOptimistically],
  );

  const setXInvert = useCallback(
    async (id: number, invert: boolean) => {
      if (!zmkApp?.state.connection || subsystemIndex === undefined) return;

      setIsLoading(true);
      setError(null);

      try {
        const service = new ZMKCustomSubsystem(
          zmkApp.state.connection,
          subsystemIndex,
        );

        updateProcessorOptimistically(id, { xInvert: invert });

        const request = Request.create({
          setXInvert: {
            id,
            invert,
          },
        });

        const payload = Request.encode(request).finish();
        const responsePayload = await service.callRPC(payload);

        if (responsePayload) {
          const resp = Response.decode(responsePayload);
          if (resp.error) {
            setError(resp.error.message);
            return;
          }
        }
      } catch (err) {
        console.error("Failed to set X invert:", err);
        setError(
          `Failed to set X invert: ${err instanceof Error ? err.message : "Unknown error"}`,
        );
      } finally {
        setIsLoading(false);
      }
    },
    [zmkApp, subsystemIndex, updateProcessorOptimistically],
  );

  const setYInvert = useCallback(
    async (id: number, invert: boolean) => {
      if (!zmkApp?.state.connection || subsystemIndex === undefined) return;

      setIsLoading(true);
      setError(null);

      try {
        const service = new ZMKCustomSubsystem(
          zmkApp.state.connection,
          subsystemIndex,
        );

        updateProcessorOptimistically(id, { yInvert: invert });

        const request = Request.create({
          setYInvert: {
            id,
            invert,
          },
        });

        const payload = Request.encode(request).finish();
        const responsePayload = await service.callRPC(payload);

        if (responsePayload) {
          const resp = Response.decode(responsePayload);
          if (resp.error) {
            setError(resp.error.message);
            return;
          }
        }
      } catch (err) {
        console.error("Failed to set Y invert:", err);
        setError(
          `Failed to set Y invert: ${err instanceof Error ? err.message : "Unknown error"}`,
        );
      } finally {
        setIsLoading(false);
      }
    },
    [zmkApp, subsystemIndex, updateProcessorOptimistically],
  );

  const setXyToScrollEnabled = useCallback(
    async (id: number, enabled: boolean) => {
      if (!zmkApp?.state.connection || subsystemIndex === undefined) return;

      setIsLoading(true);
      setError(null);

      try {
        const service = new ZMKCustomSubsystem(
          zmkApp.state.connection,
          subsystemIndex,
        );

        updateProcessorOptimistically(id, { xyToScrollEnabled: enabled });

        const request = Request.create({
          setXyToScrollEnabled: {
            id,
            enabled,
          },
        });

        const payload = Request.encode(request).finish();
        const responsePayload = await service.callRPC(payload);

        if (responsePayload) {
          const resp = Response.decode(responsePayload);
          if (resp.error) {
            setError(resp.error.message);
            return;
          }
        }
      } catch (err) {
        console.error("Failed to set XY to scroll enabled:", err);
        setError(
          `Failed to set XY to scroll enabled: ${err instanceof Error ? err.message : "Unknown error"}`,
        );
      } finally {
        setIsLoading(false);
      }
    },
    [zmkApp, subsystemIndex, updateProcessorOptimistically],
  );

  const setXySwapEnabled = useCallback(
    async (id: number, enabled: boolean) => {
      if (!zmkApp?.state.connection || subsystemIndex === undefined) return;

      setIsLoading(true);
      setError(null);

      try {
        const service = new ZMKCustomSubsystem(
          zmkApp.state.connection,
          subsystemIndex,
        );

        updateProcessorOptimistically(id, { xySwapEnabled: enabled });

        const request = Request.create({
          setXySwapEnabled: {
            id,
            enabled,
          },
        });

        const payload = Request.encode(request).finish();
        const responsePayload = await service.callRPC(payload);

        if (responsePayload) {
          const resp = Response.decode(responsePayload);
          if (resp.error) {
            setError(resp.error.message);
            return;
          }
        }
      } catch (err) {
        console.error("Failed to set XY swap enabled:", err);
        setError(
          `Failed to set XY swap enabled: ${err instanceof Error ? err.message : "Unknown error"}`,
        );
      } finally {
        setIsLoading(false);
      }
    },
    [zmkApp, subsystemIndex, updateProcessorOptimistically],
  );

  const loadLayers = useCallback(async () => {
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
        getLayerInfo: {},
      });

      const payload = Request.encode(request).finish();
      const responsePayload = await service.callRPC(payload);

      if (responsePayload) {
        const resp = Response.decode(responsePayload);
        if (resp.error) {
          setError(resp.error.message);
          return;
        }
        if (resp.getLayerInfo?.layers) {
          const layerInfos: LayerInformation[] = resp.getLayerInfo.layers.map(
            (layer: LayerInfo) => ({
              id: layer.id,
              name: layer.name,
            }),
          );
          setLayers(layerInfos);
        }
      }
    } catch (err) {
      console.error("Failed to load layers:", err);
      setError(
        `Failed to load layers: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
    } finally {
      setIsLoading(false);
    }
  }, [zmkApp, subsystemIndex]);

  // Load processors and layers when connection or subsystem changes
  useEffect(() => {
    if (subsystemIndex !== undefined && zmkApp?.state.connection) {
      /* eslint-disable react-hooks/set-state-in-effect */
      loadProcessors();
      loadLayers();
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [subsystemIndex, zmkApp, loadProcessors, loadLayers]);

  return {
    isAvailable: subsystemIndex !== undefined,
    processors,
    layers,
    isLoading,
    error,
    loadProcessors,
    loadLayers,
    setScaling,
    setRotation,
    setTempLayerEnabled,
    setTempLayerLayer,
    setTempLayerActivationDelay,
    setTempLayerDeactivationDelay,
    setActiveLayers,
    setAxisSnapMode,
    setAxisSnapThreshold,
    setAxisSnapTimeout,
    setXInvert,
    setYInvert,
    setXyToScrollEnabled,
    setXySwapEnabled,
  };
}
