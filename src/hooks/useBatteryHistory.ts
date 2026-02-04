import { useState, useEffect, useCallback, useContext, useMemo } from "react";
import {
  ZMKCustomSubsystem,
  ZMKAppContext,
} from "@cormoran/zmk-studio-react-hook";
import {
  Request,
  Response,
  Notification,
  BatteryHistoryNotification,
} from "../proto/zmk/battery_history/battery_history";

// Subsystem identifier for ZMK battery history custom protocol
const SUBSYSTEM_IDENTIFIER = "zmk__battery_history";

export interface BatteryHistoryEntryData {
  timestamp: number;
  batteryLevel: number;
}

export interface DeviceBatteryHistory {
  sourceId: number;
  deviceName: string;
  entries: BatteryHistoryEntryData[];
}

export interface UseBatteryHistoryReturn {
  devices: DeviceBatteryHistory[];
  isLoading: boolean;
  error: string | null;
  loadBatteryHistory: () => Promise<void>;
  clearBatteryHistory: () => Promise<void>;
}

export function useBatteryHistory(): UseBatteryHistoryReturn {
  const zmkApp = useContext(ZMKAppContext);
  const [devices, setDevices] = useState<DeviceBatteryHistory[]>([]);
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

  const loadBatteryHistory = useCallback(async () => {
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

      // Map to store entries by source ID
      const deviceMap = new Map<number, DeviceBatteryHistory>();

      // Set up notification listener for battery history entries
      const notificationHandler = (
        notification: BatteryHistoryNotification,
      ) => {
        try {
          const { sourceId, entry } = notification;

          // Initialize device if not exists
          if (!deviceMap.has(sourceId)) {
            const deviceName =
              sourceId === 0 ? "Central" : `Peripheral ${sourceId}`;
            deviceMap.set(sourceId, {
              sourceId,
              deviceName,
              entries: [],
            });
          }

          const device = deviceMap.get(sourceId)!;
          if (entry) {
            device.entries.push({
              timestamp: entry.timestamp,
              batteryLevel: entry.batteryLevel,
            });
          }

          // Update state when it's the last entry
          if (notification.isLast) {
            setDevices(Array.from(deviceMap.values()));
          }
        } catch (err) {
          console.error("Failed to process battery history notification:", err);
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
            if (notification.batteryHistory) {
              notificationHandler(notification.batteryHistory);
            }
          } catch (err) {
            console.error(
              "Failed to decode battery history notification:",
              err,
            );
          }
        },
      });

      try {
        // Send request to get battery history
        const request = Request.create({
          getHistory: {},
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
        // Wait a bit for all notifications to arrive
        await new Promise((resolve) => setTimeout(resolve, 500));
        unsubscribe();
      }
    } catch (err) {
      console.error("Failed to load battery history:", err);
      setError(
        `Failed to load battery history: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
    } finally {
      setIsLoading(false);
    }
  }, [zmkApp, subsystemIndex]);

  const clearBatteryHistory = useCallback(async () => {
    if (!zmkApp?.state.connection || subsystemIndex === undefined) return;

    setIsLoading(true);
    setError(null);

    try {
      const service = new ZMKCustomSubsystem(
        zmkApp.state.connection,
        subsystemIndex,
      );

      const request = Request.create({
        clearHistory: {},
      });

      const payload = Request.encode(request).finish();
      const responsePayload = await service.callRPC(payload);

      if (responsePayload) {
        const resp = Response.decode(responsePayload);
        if (resp.clearHistory?.entriesCleared !== undefined) {
          // Successfully cleared
          setDevices([]);
          await loadBatteryHistory();
        } else if (resp.error) {
          setError(resp.error.message);
        }
      }
    } catch (err) {
      console.error("Failed to clear battery history:", err);
      setError(
        `Failed to clear battery history: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
    } finally {
      setIsLoading(false);
    }
  }, [zmkApp?.state.connection, subsystemIndex, loadBatteryHistory]);

  // Load battery history when connection or subsystem changes
  useEffect(() => {
    if (subsystemIndex !== undefined && zmkApp?.state.connection) {
      loadBatteryHistory();
    }
  }, [subsystemIndex, zmkApp?.state.connection, loadBatteryHistory]);

  return {
    devices,
    isLoading,
    error,
    loadBatteryHistory,
    clearBatteryHistory,
  };
}
