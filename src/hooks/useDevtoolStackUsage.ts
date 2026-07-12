import { useCallback, useEffect, useRef, useState } from "react";
import { useDevtool } from "./useDevtool";
import { Request, type StackInfo } from "../proto/cormoran/devtool/devtool";

// Safety cap against a misbehaving cursor looping forever.
const MAX_PAGES = 64;

export interface UseDevtoolStackUsageReturn {
  isAvailable: boolean;
  stacks: StackInfo[];
  isLoading: boolean;
  error: string | null;
  isPolling: boolean;
  pollIntervalMs: number;
  refresh: () => Promise<void>;
  setPolling: (enabled: boolean) => void;
  setPollIntervalMs: (ms: number) => void;
}

export function useDevtoolStackUsage(): UseDevtoolStackUsageReturn {
  const { isAvailable, ready, call } = useDevtool();
  const [stacks, setStacks] = useState<StackInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [pollIntervalMs, setPollIntervalMs] = useState(5000);

  // Refs so the interval callback always sees the latest values.
  const readyRef = useRef(ready);
  const callRef = useRef(call);
  useEffect(() => {
    readyRef.current = ready;
    callRef.current = call;
  }, [ready, call]);

  const fetchAllPages = useCallback(async (): Promise<StackInfo[]> => {
    const collected: StackInfo[] = [];
    let cursor = 0;
    for (let page = 0; page < MAX_PAGES; page++) {
      const resp = await callRef.current(
        Request.create({ getStackUsage: { cursor } }),
      );
      if (!resp) throw new Error("No response from device");
      if (!resp.getStackUsage) {
        throw new Error("Unexpected response type");
      }
      const usage = resp.getStackUsage;
      collected.push(...usage.stacks);
      if (usage.nextCursor === 0) break;
      cursor = usage.nextCursor;
    }
    return collected.sort((a, b) => usageFraction(b) - usageFraction(a));
  }, []);

  const refresh = useCallback(async () => {
    if (!readyRef.current) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchAllPages();
      setStacks(result);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch stack usage",
      );
    } finally {
      setIsLoading(false);
    }
  }, [fetchAllPages]);

  // Auto-fetch once when the subsystem first becomes available.
  useEffect(() => {
    if (ready) {
      void refresh();
    }
  }, [ready, refresh]);

  // Periodic polling.
  useEffect(() => {
    if (!isPolling || !ready) return;
    const id = setInterval(() => {
      if (readyRef.current) {
        void refresh();
      }
    }, pollIntervalMs);
    return () => clearInterval(id);
  }, [isPolling, ready, pollIntervalMs, refresh]);

  const setPolling = useCallback((enabled: boolean) => {
    setIsPolling(enabled);
  }, []);

  return {
    isAvailable,
    stacks,
    isLoading,
    error,
    isPolling,
    pollIntervalMs,
    refresh,
    setPolling,
    setPollIntervalMs,
  };
}

export function usageFraction(s: StackInfo): number {
  return s.size > 0 ? s.used / s.size : 0;
}

export function formatUsagePercent(s: StackInfo): string {
  if (s.size === 0 || s.used === 0) return "n/a";
  return `${((s.used / s.size) * 100).toFixed(1)}%`;
}
