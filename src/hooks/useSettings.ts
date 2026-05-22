import { useState, useEffect, useCallback, useContext, useMemo } from "react";
import {
  ZMKCustomSubsystem,
  ZMKAppContext,
} from "@cormoran/zmk-studio-react-hook";
import {
  Request,
  Response,
  Notification,
  ActivitySettings,
} from "../proto/zmk/settings/core";

// Subsystem identifier for ZMK settings RPC
const SUBSYSTEM_IDENTIFIER = "zmk__settings";

// Time to wait for all notifications to arrive after requesting settings
const NOTIFICATION_COLLECTION_TIMEOUT_MS = 500;

export interface DeviceActivitySettings {
  sourceId: number;
  deviceName: string;
  idleMs: number;
  sleepMs: number;
}

export interface UseSettingsReturn {
  isAvailable: boolean;
  devices: DeviceActivitySettings[];
  isLoading: boolean;
  error: string | null;
  loadAllSettings: () => Promise<void>;
  setActivitySettings: (idleMs: number, sleepMs: number) => Promise<void>;
  resetToDefaults: () => Promise<void>;
}

export function useSettings(): UseSettingsReturn {
  const zmkApp = useContext(ZMKAppContext);
  const [devices, setDevices] = useState<DeviceActivitySettings[]>([]);
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

  const loadAllSettings = useCallback(async () => {
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

      // Map to store settings by source ID
      const deviceMap = new Map<number, DeviceActivitySettings>();

      // Set up notification listener for activity settings
      const notificationHandler = (settings: ActivitySettings) => {
        try {
          const sourceId = settings.source;
          const deviceName =
            sourceId === 0 ? "Central" : `Peripheral ${sourceId}`;

          deviceMap.set(sourceId, {
            sourceId,
            deviceName,
            idleMs: settings.idleMs,
            sleepMs: settings.sleepMs,
          });

          // Update state with all collected devices
          setDevices(Array.from(deviceMap.values()));
        } catch (err) {
          console.error(
            "Failed to process activity settings notification:",
            err,
          );
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
            if (notification.activitySettings?.settings) {
              notificationHandler(notification.activitySettings.settings);
            }
          } catch (err) {
            console.error("Failed to decode settings notification:", err);
          }
        },
      });

      try {
        // Send request to get all activity settings
        const request = Request.create({
          getAllActivitySettings: {},
        });

        const payload = Request.encode(request).finish();
        const responsePayload = await service.callRPC(payload);

        if (responsePayload) {
          const resp = Response.decode(responsePayload);
          if (resp.error) {
            setError(resp.error.message);
          }
          // Note: The actual data comes via notifications, not the response
        }
      } finally {
        // Wait for all notifications to arrive from devices
        await new Promise((resolve) =>
          setTimeout(resolve, NOTIFICATION_COLLECTION_TIMEOUT_MS),
        );
        unsubscribe();
      }
    } catch (err) {
      console.error("Failed to load settings:", err);
      setError(
        `Failed to load settings: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
    } finally {
      setIsLoading(false);
    }
  }, [zmkApp, subsystemIndex]);

  const setActivitySettings = useCallback(
    async (idleMs: number, sleepMs: number) => {
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
          setActivitySettings: {
            settings: {
              idleMs,
              sleepMs,
              source: 0, // Not used for set operation
            },
          },
        });

        const payload = Request.encode(request).finish();
        const responsePayload = await service.callRPC(payload);

        if (responsePayload) {
          const resp = Response.decode(responsePayload);
          if (resp.error) {
            setError(resp.error.message);
          } else if (resp.setActivitySettings?.success) {
            // Successfully set, reload settings
            await loadAllSettings();
          }
        }
      } catch (err) {
        console.error("Failed to set activity settings:", err);
        setError(
          `Failed to set activity settings: ${err instanceof Error ? err.message : "Unknown error"}`,
        );
      } finally {
        setIsLoading(false);
      }
    },
    [zmkApp, subsystemIndex, loadAllSettings],
  );

  const resetToDefaults = useCallback(async () => {
    // Reset to ZMK default values:
    // Idle timeout: 30 seconds (30000 ms)
    // Sleep timeout: 15 minutes (900000 ms)
    await setActivitySettings(30000, 900000);
  }, [setActivitySettings]);

  // Load settings when connection or subsystem changes
  useEffect(() => {
    if (subsystemIndex !== undefined && zmkApp?.state.connection) {
      queueMicrotask(() => loadAllSettings());
    }
  }, [subsystemIndex, zmkApp?.state.connection, loadAllSettings]);

  return {
    isAvailable: subsystemIndex !== undefined,
    devices,
    isLoading,
    error,
    loadAllSettings,
    setActivitySettings,
    resetToDefaults,
  };
}
