/**
 * useDebouncedSave Hook
 *
 * A reusable hook for managing debounced auto-save functionality with status indication.
 * Provides pending/saving/saved status and handles cleanup of timers.
 */
import { useState, useRef, useEffect, useCallback } from "react";

export type SaveStatus = "idle" | "pending" | "saving" | "saved";

export interface UseDebouncedSaveOptions {
  /** Delay in milliseconds before auto-save is triggered (default: 1000ms) */
  delay?: number;
  /** Duration in milliseconds to show "saved" status before returning to idle (default: 2000ms) */
  savedStatusDuration?: number;
}

export interface UseDebouncedSaveReturn<T> {
  /** Current save status */
  saveStatus: SaveStatus;
  /** Pending value before save, null if no pending changes */
  pendingValue: T | null;
  /** Set a pending value that will be auto-saved after delay */
  setPendingValue: (value: T, saveFn: (value: T) => Promise<void>) => void;
  /** Immediately save any pending value */
  saveNow: () => Promise<void>;
  /** Cancel any pending save and clear status */
  cancel: () => void;
  /** Reset the debounced save state */
  reset: () => void;
}

/**
 * Hook for managing debounced auto-save with status indication
 *
 * @example
 * ```tsx
 * const { saveStatus, pendingValue, setPendingValue } = useDebouncedSave<number>();
 *
 * const handleSpeedChange = (speed: number) => {
 *   setPendingValue(speed, async (value) => {
 *     await api.setSpeed(value);
 *   });
 * };
 * ```
 */
export function useDebouncedSave<T>(
  options: UseDebouncedSaveOptions = {},
): UseDebouncedSaveReturn<T> {
  const { delay = 1000, savedStatusDuration = 2000 } = options;

  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [pendingValue, setPendingValueState] = useState<T | null>(null);

  const saveTimerRef = useRef<number | null>(null);
  const statusTimerRef = useRef<number | null>(null);
  const saveFnRef = useRef<((value: T) => Promise<void>) | null>(null);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    };
  }, []);

  const cancel = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    if (statusTimerRef.current) {
      clearTimeout(statusTimerRef.current);
      statusTimerRef.current = null;
    }
    setPendingValueState(null);
    setSaveStatus("idle");
    saveFnRef.current = null;
  }, []);

  const saveNow = useCallback(async () => {
    if (pendingValue !== null && saveFnRef.current) {
      // Clear any pending timers
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }

      setSaveStatus("saving");
      try {
        await saveFnRef.current(pendingValue);
        setPendingValueState(null);
        setSaveStatus("saved");

        // Clear "saved" status after duration
        if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
        statusTimerRef.current = setTimeout(() => {
          setSaveStatus("idle");
          statusTimerRef.current = null;
        }, savedStatusDuration);
      } catch (error) {
        console.error("Failed to save:", error);
        setSaveStatus("idle");
      }
    }
  }, [pendingValue, savedStatusDuration]);

  const setPendingValue = useCallback(
    (value: T, saveFn: (value: T) => Promise<void>) => {
      setPendingValueState(value);
      saveFnRef.current = saveFn;
      setSaveStatus("pending");

      // Clear existing save timer
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }

      // Set new timer for auto-save
      saveTimerRef.current = setTimeout(async () => {
        setSaveStatus("saving");
        try {
          await saveFn(value);
          setPendingValueState(null);
          setSaveStatus("saved");

          // Clear "saved" status after duration
          if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
          statusTimerRef.current = setTimeout(() => {
            setSaveStatus("idle");
            statusTimerRef.current = null;
          }, savedStatusDuration);
        } catch (error) {
          console.error("Failed to save:", error);
          setSaveStatus("idle");
        }
        saveTimerRef.current = null;
      }, delay);
    },
    [delay, savedStatusDuration],
  );

  const reset = useCallback(() => {
    cancel();
  }, [cancel]);

  return {
    saveStatus,
    pendingValue,
    setPendingValue,
    saveNow,
    cancel,
    reset,
  };
}
