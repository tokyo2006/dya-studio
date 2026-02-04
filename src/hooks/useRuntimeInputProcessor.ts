import { useState, useEffect, useCallback, useContext, useMemo } from "react";
import {
  ZMKCustomSubsystem,
  ZMKAppContext,
} from "@cormoran/zmk-studio-react-hook";
import {
  Request,
  Response,
  Notification,
  ProcessorInfo,
} from "../proto/zmk/runtime_input_processor/runtime_input_processor";

// Subsystem identifier for ZMK runtime input processor custom protocol
// This matches the identifier registered in the ZMK firmware module
const SUBSYSTEM_IDENTIFIER = "zmk__runtime_input_processor";

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
  name: string;
  scaleMultiplier: number;
  scaleDivisor: number;
  rotationDegrees: number;
}

export interface UseRuntimeInputProcessorReturn {
  processors: InputProcessor[];
  isLoading: boolean;
  error: string | null;
  loadProcessors: () => Promise<void>;
  setScaling: (
    name: string,
    multiplier: number,
    divisor: number,
  ) => Promise<void>;
  setRotation: (name: string, degrees: number) => Promise<void>;
}

export function useRuntimeInputProcessor(): UseRuntimeInputProcessorReturn {
  const zmkApp = useContext(ZMKAppContext);
  const [processors, setProcessors] = useState<InputProcessor[]>([]);
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

      // Map to store processors by name
      const processorMap = new Map<string, InputProcessor>();

      // Set up notification listener for processor settings
      const notificationHandler = (processorInfo: ProcessorInfo) => {
        try {
          processorMap.set(processorInfo.name, {
            name: processorInfo.name,
            scaleMultiplier: processorInfo.scaleMultiplier,
            scaleDivisor: processorInfo.scaleDivisor,
            rotationDegrees: processorInfo.rotationDegrees,
          });

          // Update state with all collected processors
          setProcessors(Array.from(processorMap.values()));
        } catch (err) {
          console.error("Failed to process processor notification:", err);
        }
      };

      // Subscribe to notifications using zmkApp's onNotification
      const unsubscribe = zmkApp.onNotification({
        type: "custom",
        subsystemIndex,
        callback: (customNotification) => {
          // Decode the payload
          try {
            const notification = Notification.decode(
              customNotification.payload,
            );
            if (notification.processorSettings?.processor) {
              notificationHandler(notification.processorSettings.processor);
            }
          } catch (err) {
            console.error("Failed to decode processor notification:", err);
          }
        },
      });

      try {
        // Send request to list processors
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
          // Note: The actual processor data comes via notifications, not the response
        }
      } finally {
        // Wait for all notifications to arrive from devices
        await new Promise((resolve) =>
          setTimeout(resolve, NOTIFICATION_COLLECTION_TIMEOUT_MS),
        );
        unsubscribe();
      }
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
    async (name: string, multiplier: number, divisor: number) => {
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

        const request = Request.create({
          setScaling: {
            name,
            scaleMultiplier: simplified.multiplier,
            scaleDivisor: simplified.divisor,
          },
        });

        const payload = Request.encode(request).finish();
        const responsePayload = await service.callRPC(payload);

        if (responsePayload) {
          const resp = Response.decode(responsePayload);
          if (resp.setScaling?.success) {
            await loadProcessors();
          } else if (resp.error) {
            setError(resp.error.message);
          } else {
            setError("Failed to set scaling");
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
    [zmkApp?.state.connection, subsystemIndex, loadProcessors],
  );

  const setRotation = useCallback(
    async (name: string, degrees: number) => {
      if (!zmkApp?.state.connection || subsystemIndex === undefined) return;

      setIsLoading(true);
      setError(null);

      try {
        const service = new ZMKCustomSubsystem(
          zmkApp.state.connection,
          subsystemIndex,
        );

        const request = Request.create({
          setRotation: {
            name,
            rotationDegrees: degrees,
          },
        });

        const payload = Request.encode(request).finish();
        const responsePayload = await service.callRPC(payload);

        if (responsePayload) {
          const resp = Response.decode(responsePayload);
          if (resp.setRotation?.success) {
            await loadProcessors();
          } else if (resp.error) {
            setError(resp.error.message);
          } else {
            setError("Failed to set rotation");
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
    [zmkApp?.state.connection, subsystemIndex, loadProcessors],
  );

  // Load processors when connection or subsystem changes
  useEffect(() => {
    if (subsystemIndex !== undefined && zmkApp?.state.connection) {
      loadProcessors();
    }
  }, [subsystemIndex, zmkApp?.state.connection, loadProcessors]);

  return {
    processors,
    isLoading,
    error,
    loadProcessors,
    setScaling,
    setRotation,
  };
}
