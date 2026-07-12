import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { ZMKAppContext } from "@cormoran/zmk-studio-react-hook";
import { useCustomSubsystem } from "./useCustomSubsystem";
import type { CustomNotification } from "@zmkfirmware/zmk-studio-ts-client/custom";
import {
  Notification,
  Request,
  Response,
} from "../proto/zmk/input_stream/input_stream";

export const INPUT_STREAM_IDENTIFIER = "zmk__input_stream";

const CODEC = {
  encode: (request: Request) => Request.encode(request).finish(),
  decode: (payload: Uint8Array) => Response.decode(payload),
};

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
  const { subsystem, ready, call } = useCustomSubsystem(
    INPUT_STREAM_IDENTIFIER,
    CODEC,
  );
  const [isEnabled, setIsEnabled] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [highlightedKeys, setHighlightedKeys] = useState<Set<number>>(
    () => new Set(),
  );
  const [activeLayerIndex, setActiveLayerIndex] = useState<number | null>(null);

  const isEnabledRef = useRef(false);
  const readyRef = useRef(ready);
  const callRef = useRef(call);

  const subsystemIndex = subsystem?.index;

  useEffect(() => {
    isEnabledRef.current = isEnabled;
  }, [isEnabled]);

  useEffect(() => {
    readyRef.current = ready;
  }, [ready]);

  useEffect(() => {
    callRef.current = call;
  }, [call]);

  const callStreamRpc = useCallback(
    async (enabled: boolean) => {
      if (!ready) return false;

      const response = await call(
        Request.create(enabled ? { enableStream: {} } : { disableStream: {} }),
      );

      if (response?.error) {
        setError(response.error.message);
        return false;
      }

      return true;
    },
    [ready, call],
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
    if (ready) return;

    setIsEnabled(false);
    setIsToggling(false);
    setError(null);
    setHighlightedKeys(new Set());
    setActiveLayerIndex(null);
  }, [ready]);

  useEffect(() => {
    return () => {
      if (!isEnabledRef.current || !readyRef.current) {
        return;
      }

      void callRef.current(Request.create({ disableStream: {} }));
    };
  }, []);

  return {
    isAvailable: subsystem !== null,
    isEnabled,
    isToggling,
    error,
    highlightedKeys,
    activeLayerIndex,
    toggleStream,
    clearError: () => setError(null),
  };
}
