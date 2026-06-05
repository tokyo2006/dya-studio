import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ZMKAppContext,
  ZMKCustomSubsystem,
} from "@cormoran/zmk-studio-react-hook";
import type { CustomNotification } from "@zmkfirmware/zmk-studio-ts-client/custom";
import {
  Notification,
  Request,
  Response,
} from "../proto/zmk/input_stream/input_stream";

export const INPUT_STREAM_IDENTIFIER = "zmk__input_stream";

const BEEP_DURATION_SECONDS = 0.08;
const BEEP_START_GAIN = 0.2;

let audioContext: AudioContext | null = null;

export interface UseInputStreamReturn {
  isAvailable: boolean;
  isEnabled: boolean;
  isToggling: boolean;
  error: string | null;
  highlightedKeys: ReadonlySet<number>;
  activeLayerIndex: number | null;
  toggleStream: () => Promise<void>;
  clearError: () => void;
}

export function frequencyForKeyPosition(position: number): number {
  return 220 + ((position * 37) % 660);
}

function getAudioContext(): AudioContext | null {
  if (typeof AudioContext === "undefined") return null;
  audioContext ??= new AudioContext();
  return audioContext;
}

async function prepareAudio() {
  const context = getAudioContext();
  if (context?.state === "suspended") {
    await context.resume();
  }
}

export function playKeyBeep(position: number) {
  const context = getAudioContext();
  if (!context || context.state === "closed") return;

  try {
    if (context.state === "suspended") {
      void context.resume();
    }

    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = "sine";
    oscillator.frequency.value = frequencyForKeyPosition(position);
    oscillator.connect(gain);
    gain.connect(context.destination);
    gain.gain.setValueAtTime(BEEP_START_GAIN, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      context.currentTime + BEEP_DURATION_SECONDS,
    );

    oscillator.start(context.currentTime);
    oscillator.stop(context.currentTime + BEEP_DURATION_SECONDS);
  } catch {
    // Audio is best-effort; streaming/highlighting should keep working.
  }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Failed to update stream mode";
}

export function useInputStream(): UseInputStreamReturn {
  const zmkApp = useContext(ZMKAppContext);
  const [isEnabled, setIsEnabled] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [highlightedKeys, setHighlightedKeys] = useState<Set<number>>(
    () => new Set(),
  );
  const [activeLayerIndex, setActiveLayerIndex] = useState<number | null>(null);

  const isEnabledRef = useRef(false);
  const connectionRef = useRef(zmkApp?.state.connection);
  const subsystemIndexRef = useRef<number | undefined>(undefined);

  const subsystem = useMemo(
    () => zmkApp?.findSubsystem(INPUT_STREAM_IDENTIFIER) ?? undefined,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [zmkApp?.state.customSubsystems],
  );
  const subsystemIndex = subsystem?.index;
  const connection = zmkApp?.state.connection;

  useEffect(() => {
    isEnabledRef.current = isEnabled;
  }, [isEnabled]);

  useEffect(() => {
    connectionRef.current = connection;
  }, [connection]);

  useEffect(() => {
    subsystemIndexRef.current = subsystemIndex;
  }, [subsystemIndex]);

  const callStreamRpc = useCallback(
    async (enabled: boolean) => {
      if (!connection || subsystemIndex === undefined) return false;

      const service = new ZMKCustomSubsystem(connection, subsystemIndex);
      const request = Request.create(
        enabled ? { enableStream: {} } : { disableStream: {} },
      );
      const responsePayload = await service.callRPC(
        Request.encode(request).finish(),
      );

      if (responsePayload) {
        const response = Response.decode(responsePayload);
        if (response.error) {
          setError(response.error.message);
          return false;
        }
      }

      return true;
    },
    [connection, subsystemIndex],
  );

  const setStreamEnabled = useCallback(
    async (enabled: boolean) => {
      setIsToggling(true);
      setError(null);

      try {
        if (enabled) {
          void prepareAudio().catch(() => undefined);
        }

        const success = await callStreamRpc(enabled);
        if (success) {
          setIsEnabled(enabled);
          if (!enabled) {
            setHighlightedKeys(new Set());
            setActiveLayerIndex(null);
          }
        }
      } catch (err) {
        setError(errorMessage(err));
      } finally {
        setIsToggling(false);
      }
    },
    [callStreamRpc],
  );

  const toggleStream = useCallback(async () => {
    await setStreamEnabled(!isEnabled);
  }, [isEnabled, setStreamEnabled]);

  useEffect(() => {
    if (!zmkApp || subsystemIndex === undefined) return;

    return zmkApp.onNotification({
      type: "custom",
      subsystemIndex,
      callback: (customNotification: CustomNotification) => {
        if (!isEnabledRef.current) return;

        try {
          const notification = Notification.decode(customNotification.payload);

          if (notification.keyEvent) {
            const { position, pressed } = notification.keyEvent;
            setHighlightedKeys((current) => {
              const next = new Set(current);
              if (pressed) {
                next.add(position);
              } else {
                next.delete(position);
              }
              return next;
            });

            if (pressed) {
              playKeyBeep(position);
            }
          }

          if (notification.layerChange) {
            setActiveLayerIndex(notification.layerChange.layerIndex);
          }
        } catch (err) {
          console.error("Failed to decode input stream notification:", err);
        }
      },
    });
  }, [zmkApp, subsystemIndex]);

  useEffect(() => {
    if (connection && subsystemIndex !== undefined) return;

    queueMicrotask(() => {
      setIsEnabled(false);
      setIsToggling(false);
      setError(null);
      setHighlightedKeys(new Set());
      setActiveLayerIndex(null);
    });
  }, [connection, subsystemIndex]);

  useEffect(() => {
    return () => {
      const cleanupConnection = connectionRef.current;
      const cleanupSubsystemIndex = subsystemIndexRef.current;
      if (
        !isEnabledRef.current ||
        !cleanupConnection ||
        cleanupSubsystemIndex === undefined
      ) {
        return;
      }

      const service = new ZMKCustomSubsystem(
        cleanupConnection,
        cleanupSubsystemIndex,
      );
      const payload = Request.encode(
        Request.create({ disableStream: {} }),
      ).finish();
      void service.callRPC(payload);
    };
  }, []);

  return {
    isAvailable: subsystemIndex !== undefined,
    isEnabled,
    isToggling,
    error,
    highlightedKeys,
    activeLayerIndex,
    toggleStream,
    clearError: () => setError(null),
  };
}
