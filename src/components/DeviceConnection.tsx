import type { ReactNode } from "react";
import { createContext, useCallback, useEffect, useRef, useState } from "react";
import type { RpcTransport } from "@zmkfirmware/zmk-studio-ts-client/transport/index";
import {
  useZMKApp,
  ZMKAppContext,
  getPairedSerialPorts,
  connectToPairedSerial,
} from "@cormoran/zmk-studio-react-hook";
import { connect as connectBLE } from "@zmkfirmware/zmk-studio-ts-client/transport/gatt";
import { connect as connectUSB } from "../lib/transport/usb";
import { connect as connectDemo } from "../lib/transport/demo";

export type ConnectionMethod = "serial" | "ble" | "demo";

/**
 * Minimum time (ms) the "reconnecting" indicator stays visible once shown,
 * even if the underlying auto-reconnect attempt resolves near-instantly.
 * Without this, a fast reconnect would flash the indicator so briefly the
 * user couldn't tell what happened.
 */
export const AUTO_RECONNECT_MIN_DISPLAY_MS = 2500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Simple connection context for UI components
interface ConnectionContextValue {
  isConnected: boolean;
  deviceName: string | undefined;
  onConnect: (method: ConnectionMethod) => void;
  onDisconnect: () => void;
  isLoading: boolean;
  error: string | null;
  /** True while the page-load auto-reconnect attempt is in flight. */
  isReconnecting: boolean;
  /** Cancels an in-flight page-load auto-reconnect attempt. */
  onCancelReconnect: () => void;
}

const ConnectionContext = createContext<ConnectionContextValue>({
  isConnected: false,
  deviceName: undefined,
  onConnect: () => {},
  onDisconnect: () => {},
  isLoading: false,
  error: null,
  isReconnecting: false,
  onCancelReconnect: () => {},
});

interface DeviceConnectionProviderProps {
  children: ReactNode;
  /**
   * Minimum time (ms) to keep the reconnecting indicator visible once it's
   * shown. Defaults to {@link AUTO_RECONNECT_MIN_DISPLAY_MS}. Overridable
   * mainly so tests don't have to wait out the real-world default.
   */
  reconnectMinDisplayMs?: number;
}

export function DeviceConnectionProvider({
  children,
  reconnectMinDisplayMs = AUTO_RECONNECT_MIN_DISPLAY_MS,
}: DeviceConnectionProviderProps) {
  const zmkApp = useZMKApp();
  const [isReconnecting, setIsReconnecting] = useState(false);

  // Guards against React StrictMode's double-invoke of effects triggering
  // the auto-reconnect attempt twice.
  const autoReconnectAttemptedRef = useRef(false);
  // Bridges the cancel button (outside the effect) to the in-flight attempt.
  const cancelReconnectRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (autoReconnectAttemptedRef.current) return;
    autoReconnectAttemptedRef.current = true;

    // Plain mutable flag (not a ref hook) local to this one-shot attempt,
    // mirroring the library's own ZMKConnection auto-reconnect pattern.
    // Set on unmount (cleanup below) or when the user clicks "Cancel".
    const cancelledState = { current: false };
    cancelReconnectRef.current = () => {
      cancelledState.current = true;
      setIsReconnecting(false);
    };

    (async () => {
      const ports = await getPairedSerialPorts();
      if (ports.length === 0 || cancelledState.current) {
        // Nothing paired (or already cancelled): stay disconnected, show
        // the normal connect screen immediately.
        return;
      }

      setIsReconnecting(true);
      let transport: RpcTransport | null = null;
      try {
        // Run the reconnect attempt and the minimum-display timer in
        // parallel so the indicator never flashes shorter than intended,
        // but also never waits longer than necessary once both settle.
        [transport] = await Promise.all([
          connectToPairedSerial(),
          sleep(reconnectMinDisplayMs),
        ]);

        if (cancelledState.current) {
          // User cancelled or component unmounted while we were
          // reconnecting: release the transport instead of using it.
          transport?.abortController.abort();
          return;
        }

        if (!transport) {
          // No paired port after all (race with getPairedSerialPorts
          // above) -- fall back to the normal connect screen.
          return;
        }

        await zmkApp.connect(() => Promise.resolve(transport as RpcTransport));
      } catch (error) {
        if (!cancelledState.current) {
          console.warn("Auto-reconnect to paired serial port failed:", error);
        }
      } finally {
        if (!cancelledState.current) {
          setIsReconnecting(false);
        }
      }
    })();

    return () => {
      cancelledState.current = true;
    };
    // One-shot on mount by design; reconnectMinDisplayMs/zmkApp are read
    // from the closure captured at mount time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleConnect = useCallback(
    async (method: ConnectionMethod) => {
      let connectFn: () => Promise<RpcTransport>;
      if (method === "ble") {
        connectFn = connectBLE;
      } else if (method === "demo") {
        connectFn = connectDemo;
      } else {
        connectFn = connectUSB;
      }
      await zmkApp.connect(connectFn);
    },
    [zmkApp],
  );

  const handleDisconnect = useCallback(() => {
    zmkApp.disconnect();
  }, [zmkApp]);

  const handleCancelReconnect = useCallback(() => {
    cancelReconnectRef.current();
  }, []);

  const connectionValue: ConnectionContextValue = {
    isConnected: zmkApp.isConnected,
    deviceName: zmkApp.state.deviceInfo?.name,
    onConnect: handleConnect,
    onDisconnect: handleDisconnect,
    isLoading: zmkApp.state.isLoading,
    error: zmkApp.state.error,
    isReconnecting,
    onCancelReconnect: handleCancelReconnect,
  };

  return (
    <ZMKAppContext.Provider value={zmkApp}>
      <ConnectionContext.Provider value={connectionValue}>
        {children}
      </ConnectionContext.Provider>
    </ZMKAppContext.Provider>
  );
}

export { ConnectionContext };
