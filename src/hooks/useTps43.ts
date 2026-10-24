import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ZMKAppContext } from "@cormoran/zmk-studio-react-hook";
import { useCustomSubsystem, useLockAwareCall } from "./useCustomSubsystem";
import {
  useDebouncedMemoryWrite,
  type MemoryWriteState,
} from "./useDebouncedMemoryWrite";
import {
  Notification,
  Request,
  Response,
  type PeripheralResponse,
  type TrackpadInfo,
  type Tps43State,
} from "../proto/tokyo2006/tps43/tps43";
import { TPS43_SOURCE_ALL, Tps43RelayCorrelator } from "../lib/tps43Relay";

// Registered by tokyo2006/tps43-input-module.
export const TPS43_SUBSYSTEM_IDENTIFIER = "tokyo2006__tps43";

/** How long to collect peripheral answers to `GetInfo{source: ALL}`. */
export const TPS43_DISCOVERY_WINDOW_MS = 2_000;

/** How long a source-addressed request waits for its relayed answer. */
export const TPS43_RELAY_TIMEOUT_MS = 6_000;

const CODEC = {
  encode: (request: Request) => Request.encode(request).finish(),
  decode: (payload: Uint8Array) => Response.decode(payload),
};

export interface UseTps43Return {
  isAvailable: boolean;
  /**
   * Trackpads that answered `GetInfo{source: ALL}`, local (source 0) first.
   * Empty means the connected keyboard reported no trackpad at all.
   */
  sources: TrackpadInfo[];
  /** Source being edited; 0 is the Studio central itself. */
  selectedSource: number;
  /** Edit another discovered source. Unknown sources are ignored. */
  selectSource: (source: number) => void;
  /**
   * True once a discovery round finished. `false` while the first discovery is
   * still running; `true` with `sources: []` means "no trackpad at all", which
   * is different from "not discovered yet".
   */
  hasDiscovered: boolean;
  /** Re-discover sources and reload the selected one. */
  refresh: () => Promise<void>;
  /** Last state confirmed by the device. */
  state: Tps43State | null;
  /** Device state with not-yet-written edits applied, for display. */
  values: Tps43State | null;
  isLoading: boolean;
  isResetting: boolean;
  error: string | null;
  writeState: MemoryWriteState;
  /** Reload the selected source (rediscovering if none is known yet). */
  load: () => Promise<void>;
  /** Queue a debounced, persisted write of the given fields. */
  update: (patch: Tps43State) => void;
  /** Restore firmware defaults (also clears saved settings). */
  reset: () => Promise<boolean>;
}

function errorText(prefix: string, err: unknown): string {
  return `${prefix}: ${err instanceof Error ? err.message : "Unknown error"}`;
}

/** Keep one entry per source, local first. */
function mergeSources(discovered: TrackpadInfo[]): TrackpadInfo[] {
  const bySource = new Map<number, TrackpadInfo>();
  for (const info of discovered) {
    if (!bySource.has(info.source)) bySource.set(info.source, info);
  }
  return [...bySource.values()].sort((a, b) => a.source - b.source);
}

/** Keep the current selection when it still exists; otherwise pick one. */
function chooseSource(sources: TrackpadInfo[], current: number): number {
  if (sources.length === 0) return 0;
  if (sources.some((info) => info.source === current)) return current;
  return sources[0].source;
}

export function useTps43(): UseTps43Return {
  const zmkApp = useContext(ZMKAppContext);
  const {
    subsystem,
    ready,
    call: gatedCall,
  } = useCustomSubsystem(TPS43_SUBSYSTEM_IDENTIFIER, CODEC);
  const [state, setState] = useState<Tps43State | null>(null);
  const [pending, setPending] = useState<Tps43State>({});
  const pendingRef = useRef<Tps43State>({});
  const [sources, setSources] = useState<TrackpadInfo[]>([]);
  const [hasDiscovered, setHasDiscovered] = useState(false);
  const [selectedSource, setSelectedSourceValue] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const call = useLockAwareCall(gatedCall, setError);

  const subsystemIndex = subsystem?.index;
  const correlatorRef = useRef(
    new Tps43RelayCorrelator(TPS43_RELAY_TIMEOUT_MS),
  );
  // Every async flow captures the generation. Switching source or losing the
  // connection bumps it, so a late answer for the previous source is dropped
  // instead of being applied to the new one.
  const generationRef = useRef(0);
  // The selection is also a ref: relay requests read it at send time, and the
  // notification handler needs it without re-subscribing.
  const selectedSourceRef = useRef(0);
  // Discovery answers legitimately come from every source, so they bypass the
  // source filter below.
  const discoveryIdsRef = useRef(new Set<number>());
  const discoveryCountRef = useRef(0);

  const setPendingBoth = useCallback((next: Tps43State) => {
    pendingRef.current = next;
    setPending(next);
  }, []);

  // Drop sent fields unless the user changed them again while in flight.
  const clearSent = useCallback(
    (sent: Tps43State) => {
      const next = { ...pendingRef.current };
      for (const key of Object.keys(sent) as (keyof Tps43State)[]) {
        if (next[key] === sent[key]) delete next[key];
      }
      setPendingBoth(next);
    },
    [setPendingBoth],
  );

  // Relayed requests return immediately with DeferredResponse and the actual
  // answer arrives as a custom notification. The correlator buffers an answer
  // that races ahead of `waitFor`, so subscribing before any request matters.
  useEffect(() => {
    if (!zmkApp || subsystemIndex === undefined) return;
    const correlator = correlatorRef.current;
    const generations = generationRef;
    const unsubscribe = zmkApp.onNotification({
      type: "custom",
      subsystemIndex,
      callback: (notification) => {
        // Only a request addressed to the selected source may settle it. Decode
        // here (the correlator decodes again) because it otherwise resolves the
        // first answer for the id, whichever half sent it.
        let peripheral: PeripheralResponse | undefined;
        try {
          peripheral = Notification.decode(
            notification.payload,
          ).peripheralResponse;
        } catch {
          return;
        }
        if (!peripheral?.response) return;
        const fromDiscovery =
          discoveryCountRef.current > 0 ||
          discoveryIdsRef.current.has(peripheral.requestId);
        if (!fromDiscovery && peripheral.source !== selectedSourceRef.current) {
          return;
        }
        correlator.handleNotificationPayload(notification.payload);
      },
    });
    return () => {
      unsubscribe();
      // Drop in-flight waits and mark their flows stale: nothing may publish
      // into a view that no longer has a connection.
      generations.current++;
      correlator.clear("TPS43 connection closed");
    };
  }, [zmkApp, subsystemIndex]);

  /**
   * Issue one request, waiting for the relayed answer when the firmware
   * defers it. Never substitutes source 0: the caller's source is the address.
   */
  const callSource = useCallback(
    async (request: Request, source: number): Promise<Response | null> => {
      const response = await call(request);
      if (!response?.deferred) return response ?? null;
      try {
        return await correlatorRef.current.waitFor(response.deferred.requestId);
      } catch (err) {
        if (
          err instanceof Error &&
          err.message.startsWith("Timed out waiting for TPS43")
        ) {
          throw new Error(
            `Trackpad on source ${source} did not respond (timed out after ${TPS43_RELAY_TIMEOUT_MS} ms). It may be disconnected.`,
          );
        }
        throw err;
      }
    },
    [call],
  );

  /** Read one source, applying the result only if it is still current. */
  const loadSource = useCallback(
    async (source: number, generation: number) => {
      const isCurrent = () => generationRef.current === generation;
      setIsLoading(true);
      try {
        const response = await callSource(
          Request.create({ getState: { source } }),
          source,
        );
        if (!isCurrent()) return;
        if (!response) return;
        if (response.error) throw new Error(response.error.message);
        if (response.getState?.state) setState(response.getState.state);
      } catch (err) {
        if (!isCurrent()) return;
        console.error("Failed to load trackpad state:", err);
        setError(errorText("Failed to load trackpad state", err));
      } finally {
        if (isCurrent()) setIsLoading(false);
      }
    },
    [callSource],
  );

  const write = useCallback(
    async (patch: Tps43State) => {
      if (!ready) return;
      const source = selectedSourceRef.current;
      const generation = generationRef.current;
      const isCurrent = () => generationRef.current === generation;
      setError(null);
      let rejected = false;
      try {
        const response = await callSource(
          Request.create({
            setState: { state: patch, persist: true, source },
          }),
          source,
        );
        if (!isCurrent()) return;
        if (response?.setState?.state) {
          setState(response.setState.state);
        } else if (response?.error) {
          setError(response.error.message);
          rejected = true;
        }
      } catch (err) {
        if (isCurrent()) {
          console.error("Failed to save trackpad settings:", err);
          setError(errorText("Failed to save trackpad settings", err));
        }
        rejected = true;
      } finally {
        if (isCurrent()) clearSent(patch);
      }
      // Firmware applies valid fields even when one fails; resync to show truth.
      if (rejected && isCurrent()) {
        try {
          const response = await callSource(
            Request.create({ getState: { source } }),
            source,
          );
          if (isCurrent() && response?.getState?.state) {
            setState(response.getState.state);
          }
        } catch (err) {
          console.error("Failed to reload trackpad state:", err);
        }
      }
    },
    [ready, callSource, clearSent],
  );

  const writer = useDebouncedMemoryWrite<Tps43State>(write);

  const update = useCallback(
    (patch: Tps43State) => {
      const next = { ...pendingRef.current, ...patch };
      setPendingBoth(next);
      writer.queue(next);
    },
    [setPendingBoth, writer],
  );

  const refresh = useCallback(async () => {
    if (!ready) return;
    const generation = ++generationRef.current;
    const isCurrent = () => generationRef.current === generation;
    writer.cancel();
    setPendingBoth({});
    setState(null);
    setIsLoading(true);
    setHasDiscovered(false);
    setError(null);

    let discovered: TrackpadInfo[] = [];
    let selected = selectedSourceRef.current;
    let relayRequestId = 0;
    discoveryCountRef.current++;
    try {
      const response = await call(
        Request.create({ getInfo: { source: TPS43_SOURCE_ALL } }),
      );
      if (!isCurrent()) return;
      if (response?.error) throw new Error(response.error.message);
      // A null response means the unlock gate dropped the call; the gate has
      // already published a message.
      if (!response) {
        setIsLoading(false);
        return;
      }

      // The local answer describes this device (source 0). Each peripheral that
      // hosts a trackpad answers separately through a relay notification.
      discovered = (response.getInfo?.trackpads ?? []).map((info) => ({
        ...info,
        source: 0,
      }));
      relayRequestId = response.getInfo?.relayRequestId ?? 0;
      if (relayRequestId !== 0) {
        discoveryIdsRef.current.add(relayRequestId);
        const answers = await correlatorRef.current.collectBroadcast(
          relayRequestId,
          TPS43_DISCOVERY_WINDOW_MS,
        );
        if (!isCurrent()) return;
        for (const { source, response: answer } of answers) {
          // A half without a trackpad may still answer with an error; it
          // simply contributes no source instead of failing discovery.
          for (const info of answer.getInfo?.trackpads ?? []) {
            discovered.push({ ...info, source });
          }
        }
      }
      discovered = mergeSources(discovered);
      selected = chooseSource(discovered, selectedSourceRef.current);
      selectedSourceRef.current = selected;
      setSources(discovered);
      setSelectedSourceValue(selected);
      // A completed discovery is meaningful even when it found nothing: the
      // page must render "no trackpad" instead of waiting or guessing a source.
      setHasDiscovered(true);
    } catch (err) {
      if (!isCurrent()) return;
      console.error("Failed to discover trackpads:", err);
      setSources([]);
      setHasDiscovered(false);
      selectedSourceRef.current = 0;
      setSelectedSourceValue(0);
      setError(errorText("Failed to discover trackpads", err));
    } finally {
      if (relayRequestId !== 0) {
        discoveryIdsRef.current.delete(relayRequestId);
      }
      discoveryCountRef.current--;
    }

    if (!isCurrent()) return;
    if (discovered.length === 0) {
      // "No trackpad" is a valid answer, not an error: sources stays empty and
      // the page renders its empty state.
      setIsLoading(false);
      return;
    }
    await loadSource(selected, generation);
  }, [ready, call, writer, setPendingBoth, loadSource]);

  const load = useCallback(async () => {
    if (!ready) return;
    // Nothing discovered (yet): retry discovery so a failed or stale mount can
    // recover instead of reading a guessed source.
    if (sources.length === 0) {
      await refresh();
      return;
    }
    const generation = ++generationRef.current;
    setError(null);
    await loadSource(selectedSourceRef.current, generation);
  }, [ready, sources.length, refresh, loadSource]);

  const selectSource = useCallback(
    (source: number) => {
      if (source === selectedSourceRef.current) return;
      if (!sources.some((info) => info.source === source)) return;
      const generation = ++generationRef.current;
      selectedSourceRef.current = source;
      setSelectedSourceValue(source);
      writer.cancel();
      setPendingBoth({});
      setState(null);
      setIsResetting(false);
      setError(null);
      void loadSource(source, generation);
    },
    [sources, writer, setPendingBoth, loadSource],
  );

  const reset = useCallback(async () => {
    if (!ready) return false;
    const source = selectedSourceRef.current;
    const generation = generationRef.current;
    const isCurrent = () => generationRef.current === generation;
    writer.cancel();
    setPendingBoth({});
    setIsResetting(true);
    setError(null);
    try {
      const response = await callSource(
        Request.create({ reset: { factoryDefaults: true, source } }),
        source,
      );
      if (!isCurrent()) return false;
      if (response?.reset?.state) {
        setState(response.reset.state);
        return true;
      }
      if (response?.error) setError(response.error.message);
      return false;
    } catch (err) {
      if (isCurrent()) {
        console.error("Failed to reset trackpad settings:", err);
        setError(errorText("Failed to reset trackpad settings", err));
      }
      return false;
    } finally {
      setIsResetting(false);
    }
  }, [ready, callSource, writer, setPendingBoth]);

  useEffect(() => {
    if (ready) {
      void refresh();
    } else {
      generationRef.current++;
      writer.cancel();
      setPendingBoth({});
      setState(null);
      setSources([]);
      setHasDiscovered(false);
      selectedSourceRef.current = 0;
      setSelectedSourceValue(0);
      setIsLoading(false);
      setIsResetting(false);
      setError(null);
    }
    // Only react to availability; `refresh` changes identity on every render
    // (the debounced writer is a fresh object), which would loop here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const values = useMemo(
    () => (state ? { ...state, ...pending } : null),
    [state, pending],
  );

  return {
    isAvailable: subsystem !== null,
    sources,
    selectedSource,
    selectSource,
    hasDiscovered,
    refresh,
    state,
    values,
    isLoading,
    isResetting,
    error,
    writeState: writer.state,
    load,
    update,
    reset,
  };
}
