/**
 * useKeymap Hook
 *
 * This hook provides access to keymap functionality via the ZMK Studio protocol.
 * It handles loading physical layouts, keymaps, behaviors, and modifying bindings.
 */
import {
  useState,
  useEffect,
  useCallback,
  useContext,
  useMemo,
  useRef,
} from "react";
import {
  ZMKAppContext,
  isUnlockRequiredError,
} from "@cormoran/zmk-studio-react-hook";
import type { call_rpc } from "@zmkfirmware/zmk-studio-ts-client";
import { loggedCallRpc } from "../lib/rpcLogging";
import type {
  Keymap,
  Layer,
  BehaviorBinding,
  PhysicalLayouts,
  PhysicalLayout,
  KeyPhysicalAttrs,
} from "@zmkfirmware/zmk-studio-ts-client/keymap";
import { ErrorConditions } from "@zmkfirmware/zmk-studio-ts-client/meta";
import {
  useKeymapSource,
  getKeymapLoadingLabel,
  isKeymapUnlockRequired,
  type BehaviorDefinition,
  type KeymapLoadPhase,
  type KeymapLoadProgress,
} from "./useKeymapSource";
import { assertOfficialKeymapRpcAllowed } from "../lib/officialKeymapRpcGuard";

// Error response constants for better readability
const SetLayerBindingResp = {
  OK: 0,
  INVALID_LAYER_ID: 1,
  INVALID_KEY_POSITION: 2,
  INVALID_BEHAVIOR_ID: 3,
} as const;

// Re-export types for convenience
export type {
  Keymap,
  Layer,
  BehaviorBinding,
  PhysicalLayouts,
  PhysicalLayout,
  KeyPhysicalAttrs,
};

// Loading (fast-vs-official) and its progress model now live in
// useKeymapSource; re-export the parts existing importers of "./useKeymap"
// still reference so their imports keep working.
export {
  getKeymapLoadingLabel,
  type BehaviorDefinition,
  type KeymapLoadPhase,
  type KeymapLoadProgress,
};

/**
 * Original binding stored for comparison and reset
 */
export interface OriginalBinding {
  layerId: number;
  keyPosition: number;
  binding: BehaviorBinding;
}

/**
 * State of the keymap
 */
export interface KeymapState {
  /** Physical layouts available on the keyboard */
  physicalLayouts: PhysicalLayouts | null;
  /** Current keymap data */
  keymap: Keymap | null;
  /** Map of behavior IDs to their definitions */
  behaviors: Map<number, BehaviorDefinition>;
  /** Original bindings (before any modifications) */
  originalBindings: Map<string, BehaviorBinding>;
  /** Whether there are unsaved changes */
  hasUnsavedChanges: boolean;
  /** Whether loading data */
  isLoading: boolean;
  /** True once the keymap tab has fully finished loading -- the foreground
   * preview AND any background incremental load (deferred behaviors + remaining
   * layers) have all settled. `isLoading` goes false as soon as the preview is
   * painted; this stays false until nothing keymap-related is still fetching,
   * so callers can defer non-preview work (e.g. runtime-macro loading) to the
   * very end. */
  isFullyLoaded: boolean;
  /** Progress of the in-flight load (what/how-far), or null when idle */
  loadingProgress: KeymapLoadProgress | null;
  /** Error message if any */
  error: string | null;
  /** Whether unlock is required */
  unlockRequired: boolean;
}

/**
 * Return type for useKeymap hook
 */
export interface UseKeymapReturn extends KeymapState {
  /** Load all keymap data from the keyboard */
  loadKeymapData: () => Promise<void>;
  /** Set a binding for a specific key */
  setBinding: (
    layerId: number,
    keyPosition: number,
    binding: BehaviorBinding,
  ) => Promise<boolean>;
  /** Reset a binding to its original value */
  resetBinding: (layerId: number, keyPosition: number) => Promise<boolean>;
  /** Move a layer from one position to another */
  moveLayer: (startIndex: number, destIndex: number) => Promise<boolean>;
  /** Add a new layer */
  addLayer: () => Promise<{ index: number; layer: Layer } | null>;
  /** Remove a layer at the specified index */
  removeLayer: (layerIndex: number) => Promise<boolean>;
  /** Restore a deleted layer */
  restoreLayer: (layerId: number, atIndex: number) => Promise<Layer | null>;
  /** Set layer name */
  setLayerName: (layerId: number, name: string) => Promise<boolean>;
  /** Get available layer count (can restore up to this many) */
  availableLayers: number;
  /** Maximum layer name length */
  maxLayerNameLength: number;
  /** Save all changes to the keyboard */
  saveChanges: () => Promise<boolean>;
  /** Discard all unsaved changes */
  discardChanges: () => Promise<boolean>;
  /** Reset the persistent keymap back to the hard-coded (devicetree-stock)
   * default: applies every default binding that differs from the current one,
   * then saves. Only meaningful when {@link isFastKeymapAvailable} is true (the
   * default keymap is read via the fast-keymap subsystem). Returns false when
   * unavailable or the save fails. */
  resetToDefault: () => Promise<boolean>;
  /** Set the active physical layout */
  setActiveLayout: (layoutIndex: number) => Promise<boolean>;
  /** Get the original binding for a key (before modification) */
  getOriginalBinding: (
    layerId: number,
    keyPosition: number,
  ) => BehaviorBinding | null;
  /** Check if a binding has been modified */
  isBindingModified: (layerId: number, keyPosition: number) => boolean;
  /** True when the connected keyboard exposes the fast-keymap subsystem, which
   * is what serves the hard-coded default keymap. Gates the "reset to default"
   * action and the "changed from default" highlight. */
  isFastKeymapAvailable: boolean;
  /** Check whether a binding's PERSISTED value differs from the hard-coded
   * default keymap (i.e. it was saved to flash and is no longer stock). Returns
   * false while the default keymap is still loading, when it isn't available
   * (no fast-keymap subsystem), or when the key is currently modified in memory
   * (that state is surfaced by {@link isBindingModified} instead). */
  isBindingChangedFromDefault: (
    layerId: number,
    keyPosition: number,
  ) => boolean;
  /** Get behavior definition by ID */
  getBehavior: (behaviorId: number) => BehaviorDefinition | undefined;
  /** Get display name for a binding */
  getBindingDisplayName: (binding: BehaviorBinding) => string;
  /** Clear unlock required state */
  clearUnlockRequired: () => void;
  /** Get removed layer IDs that can be restored */
  removedLayerIds: number[];
}

// Helper to create key for binding lookup
function bindingKey(layerId: number, keyPosition: number): string {
  return `${layerId}:${keyPosition}`;
}

// Helper to check if two bindings are equal
function bindingsEqual(a: BehaviorBinding, b: BehaviorBinding): boolean {
  return (
    a.behaviorId === b.behaviorId &&
    a.param1 === b.param1 &&
    a.param2 === b.param2
  );
}

/**
 * Hook for managing keymap state and operations
 */
export function useKeymap(): UseKeymapReturn {
  const zmkApp = useContext(ZMKAppContext);

  // State
  const [physicalLayouts, setPhysicalLayouts] =
    useState<PhysicalLayouts | null>(null);
  const [keymap, setKeymap] = useState<Keymap | null>(null);
  const [behaviors, setBehaviors] = useState<Map<number, BehaviorDefinition>>(
    new Map(),
  );
  const [originalBindings, setOriginalBindings] = useState<
    Map<string, BehaviorBinding>
  >(new Map());
  // Hard-coded (devicetree-stock) default bindings, keyed like originalBindings
  // (`layerId:position`). Loaded lazily as the final step of a keymap load (see
  // the effect below) and only when the fast-keymap subsystem is present.
  const [defaultBindings, setDefaultBindings] = useState<
    Map<string, BehaviorBinding>
  >(new Map());
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  // True only once the foreground preview AND the background incremental load
  // (deferred behaviors + remaining layers) have all settled. See the
  // UseKeymapReturn.isFullyLoaded doc.
  const [isFullyLoaded, setIsFullyLoaded] = useState(false);
  const [loadingProgress, setLoadingProgress] =
    useState<KeymapLoadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [unlockRequired, setUnlockRequired] = useState(false);
  const [removedLayerIds, setRemovedLayerIds] = useState<number[]>([]);

  // Ref to track if data has been loaded
  const dataLoadedRef = useRef(false);
  // Guards the final-step default-keymap load so it runs once per keymap load;
  // reset when a new load starts (see loadKeymapData) and on disconnect.
  const defaultKeymapRequestedRef = useRef(false);
  // Monotonic id per loadKeymapData call, so a background (incremental) layer
  // update from a superseded load is ignored.
  const loadIdRef = useRef(0);
  // Timer for auto-clearing errors
  const errorTimerRef = useRef<number | null>(null);

  // Get connection from ZMK app context
  const connection = useMemo(
    () => zmkApp?.state.connection,
    [zmkApp?.state.connection],
  );

  // Loading is delegated to useKeymapSource, which picks the fast-keymap
  // subsystem when the device exposes it and the official protocol otherwise.
  // (Editing below always uses the official protocol.)
  const {
    loadKeymapData: loadFromSource,
    loadLayoutGeometry,
    loadDefaultKeymap,
    isFastAvailable: isFastKeymapAvailable,
  } = useKeymapSource();

  // Helper to set error with auto-clear timer (5 seconds)
  const setErrorWithAutoClear = useCallback((message: string) => {
    setError(message);
    // Clear any existing timer
    if (errorTimerRef.current) {
      clearTimeout(errorTimerRef.current);
    }
    // Set new timer to clear error after 5 seconds
    errorTimerRef.current = setTimeout(() => {
      setError(null);
      errorTimerRef.current = null;
    }, 5000);
  }, []);

  // Helper to clear error and timer
  const clearError = useCallback(() => {
    setError(null);
    if (errorTimerRef.current) {
      clearTimeout(errorTimerRef.current);
      errorTimerRef.current = null;
    }
  }, []);

  // Helper to call RPC with error handling
  const callRpc = useCallback(
    async <T>(
      request: Parameters<typeof call_rpc>[1],
      extractor: (
        response: Awaited<ReturnType<typeof call_rpc>>,
      ) => T | undefined,
    ): Promise<T | null> => {
      if (!connection) {
        setErrorWithAutoClear("Not connected to keyboard");
        return null;
      }

      try {
        // Guard: when fast-keymap is available, an official keymap/behaviors
        // *read* here is a bug (must go through useKeymapSource) — throw
        // rather than silently pay for a slow official round-trip. Edits and
        // checkUnsavedChanges are not forbidden reads, so they pass through.
        assertOfficialKeymapRpcAllowed(request);
        const response = await loggedCallRpc(connection, request);

        // Check for meta errors
        if (response.meta?.simpleError !== undefined) {
          if (response.meta.simpleError === ErrorConditions.UNLOCK_REQUIRED) {
            setUnlockRequired(true);
            setError(
              "Keyboard needs to be unlocked. Please unlock your keyboard.",
            );
            return null;
          }
          setErrorWithAutoClear(`RPC error: ${response.meta.simpleError}`);
          return null;
        }

        const result = extractor(response);
        if (result === undefined) {
          return null;
        }
        // Clear error on successful RPC call
        clearError();
        return result;
      } catch (err) {
        if (isUnlockRequiredError(err)) {
          setUnlockRequired(true);
          setError(
            "Keyboard needs to be unlocked. Please unlock your keyboard.",
          );
          return null;
        }
        console.error("RPC call failed:", err);
        setErrorWithAutoClear(
          err instanceof Error ? err.message : "Unknown error",
        );
        return null;
      }
    },
    [connection, clearError, setErrorWithAutoClear],
  );

  // Store original bindings from keymap
  const storeOriginalBindings = useCallback((keymap: Keymap) => {
    const bindings = new Map<string, BehaviorBinding>();
    keymap.layers.forEach((layer) => {
      layer.bindings.forEach((binding, position) => {
        bindings.set(bindingKey(layer.id, position), { ...binding });
      });
    });
    setOriginalBindings(bindings);
  }, []);

  // Load all keymap data (layouts + keymap + behaviors) via useKeymapSource,
  // then check unsaved-changes state through the official keymap subsystem
  // (an edit-state concern the fast path doesn't own).
  const loadKeymapData = useCallback(async () => {
    if (!connection) {
      setErrorWithAutoClear("Not connected to keyboard");
      return;
    }

    setIsLoading(true);
    setIsFullyLoaded(false);
    setLoadingProgress({ phase: "layouts" });
    setError(null);
    setUnlockRequired(false);

    // Guard for the background (incremental) layer load: a load that has been
    // superseded (reconnect/reload) must not apply its late layer update.
    const loadId = ++loadIdRef.current;
    // A fresh load re-arms the final-step default-keymap fetch.
    defaultKeymapRequestedRef.current = false;
    const isFirstLoad = !dataLoadedRef.current;
    // Populated after the initial (phase-1) load returns; read by the
    // background callback, which fires later.
    let pendingLayerIds: number[] = [];

    // Called when the fast path finishes loading the layers it deferred (see
    // useKeymapSource's incremental load): fill their bindings into the keymap
    // and record their original bindings (first load only).
    const applyBackgroundLayers = (fullLayers: Layer[]) => {
      if (loadIdRef.current !== loadId) return;
      // This is the final callback of the background load (it runs after the
      // deferred behaviors are delivered), so the keymap tab is now fully
      // loaded -- even when there were no pending layers to fill in.
      setIsFullyLoaded(true);
      const pending = new Set(pendingLayerIds);
      if (pending.size === 0) return;
      const bindingsById = new Map(fullLayers.map((l) => [l.id, l.bindings]));

      setKeymap((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          layers: prev.layers.map((layer) =>
            pending.has(layer.id) && bindingsById.has(layer.id)
              ? { ...layer, bindings: bindingsById.get(layer.id)! }
              : layer,
          ),
        };
      });

      if (isFirstLoad) {
        setOriginalBindings((prev) => {
          const next = new Map(prev);
          for (const layer of fullLayers) {
            if (!pending.has(layer.id)) continue;
            layer.bindings.forEach((binding, position) => {
              const key = bindingKey(layer.id, position);
              if (!next.has(key)) next.set(key, { ...binding });
            });
          }
          return next;
        });
      }
    };

    // Called when the fast path finishes loading the behaviors it deferred (see
    // useKeymapSource's incremental load): swap in the resolved map so bindings
    // that were rendering with a placeholder label now show their real names.
    const applyBackgroundBehaviors = (
      behaviors: Map<number, BehaviorDefinition>,
    ) => {
      if (loadIdRef.current !== loadId) return;
      setBehaviors(behaviors);
    };

    try {
      // Load the keymap data. Only a failure HERE means unlock is actually
      // required: the fast-keymap subsystem is unsecured and loads while the
      // keyboard is locked, whereas the official protocol needs unlock even to
      // read — either way, this is the call whose unlock error should surface.
      let loaded = false;
      try {
        const data = await loadFromSource(
          (progress) => setLoadingProgress(progress),
          applyBackgroundLayers,
          applyBackgroundBehaviors,
        );
        pendingLayerIds = data.pendingLayerIds;

        setPhysicalLayouts(data.physicalLayouts);
        setKeymap(data.keymap);
        // Only store original bindings on first load
        if (isFirstLoad) {
          storeOriginalBindings(data.keymap);
          dataLoadedRef.current = true;
        }
        setBehaviors(data.behaviors);
        // If nothing was deferred to the background, the load is already
        // complete here; otherwise applyBackgroundLayers flips this when the
        // background (deferred behaviors + remaining layers) settles.
        if (data.pendingLayerIds.length === 0 && !data.behaviorsDeferred) {
          setIsFullyLoaded(true);
        }
        loaded = true;
      } catch (err) {
        if (isKeymapUnlockRequired(err)) {
          setUnlockRequired(true);
          setError(
            "Keyboard needs to be unlocked. Please unlock your keyboard.",
          );
        } else {
          console.error("Failed to load keymap data:", err);
          setErrorWithAutoClear(
            err instanceof Error ? err.message : "Failed to load keymap data",
          );
        }
      }

      if (loaded) {
        // checkUnsavedChanges uses the official (secured) keymap subsystem, so
        // it fails with unlock-required when the keymap was loaded read-only
        // via the unsecured fast path while locked. The keymap is already
        // viewable, so don't promote that to an unlock prompt — best-effort:
        // assume no unsaved changes when we can't read it. Editing a binding
        // still prompts for unlock at that point.
        setLoadingProgress({ phase: "finalizing" });
        try {
          if (connection) {
            const response = await loggedCallRpc(connection, {
              keymap: { checkUnsavedChanges: true },
            });
            setHasUnsavedChanges(response.keymap?.checkUnsavedChanges ?? false);
          }
        } catch {
          setHasUnsavedChanges(false);
        }
      }
    } finally {
      setIsLoading(false);
      setLoadingProgress(null);
    }
  }, [
    connection,
    loadFromSource,
    storeOriginalBindings,
    setErrorWithAutoClear,
  ]);

  // Set a key binding
  const setBinding = useCallback(
    async (
      layerId: number,
      keyPosition: number,
      binding: BehaviorBinding,
    ): Promise<boolean> => {
      const result = await callRpc(
        {
          keymap: {
            setLayerBinding: {
              layerId,
              keyPosition,
              binding,
            },
          },
        },
        (response) => response.keymap?.setLayerBinding,
      );

      if (result === SetLayerBindingResp.OK) {
        // Update local keymap state
        setKeymap((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            layers: prev.layers.map((layer) => {
              if (layer.id !== layerId) return layer;
              const newBindings = [...layer.bindings];
              newBindings[keyPosition] = binding;
              return { ...layer, bindings: newBindings };
            }),
          };
        });
        setHasUnsavedChanges(true);
        clearError();
        return true;
      } else if (result === SetLayerBindingResp.INVALID_LAYER_ID) {
        setErrorWithAutoClear(`Invalid layer ID: ${layerId}`);
      } else if (result === SetLayerBindingResp.INVALID_KEY_POSITION) {
        setErrorWithAutoClear(`Invalid key position: ${keyPosition}`);
      } else if (result === SetLayerBindingResp.INVALID_BEHAVIOR_ID) {
        setErrorWithAutoClear(`Invalid behavior ID: ${binding.behaviorId}`);
      } else {
        setErrorWithAutoClear(`Failed to set binding: unknown error`);
      }

      return false;
    },
    [callRpc, clearError, setErrorWithAutoClear],
  );

  // Reset a binding to its original value
  const resetBinding = useCallback(
    async (layerId: number, keyPosition: number): Promise<boolean> => {
      const original = originalBindings.get(bindingKey(layerId, keyPosition));
      if (!original) {
        return false;
      }
      return setBinding(layerId, keyPosition, original);
    },
    [originalBindings, setBinding],
  );

  // Move a layer
  const moveLayer = useCallback(
    async (startIndex: number, destIndex: number): Promise<boolean> => {
      const result = await callRpc(
        {
          keymap: {
            moveLayer: {
              startIndex,
              destIndex,
            },
          },
        },
        (response) => response.keymap?.moveLayer,
      );

      if (result?.ok) {
        setKeymap(result.ok);
        setHasUnsavedChanges(true);
        clearError();
        return true;
      }
      if (result?.err !== undefined) {
        setErrorWithAutoClear(`Failed to move layer: operation not allowed`);
      }

      return false;
    },
    [callRpc, clearError, setErrorWithAutoClear],
  );

  // Add a new layer
  const addLayer = useCallback(async (): Promise<{
    index: number;
    layer: Layer;
  } | null> => {
    const result = await callRpc(
      { keymap: { addLayer: {} } },
      (response) => response.keymap?.addLayer,
    );

    if (result?.ok && result.ok.layer) {
      const newLayerIndex = result.ok.index;
      const newLayer = result.ok.layer;

      // Update keymap with the new layer
      setKeymap((prev) => {
        if (!prev) return prev;
        const newLayers = [...prev.layers];
        newLayers.splice(newLayerIndex, 0, newLayer);
        return {
          ...prev,
          layers: newLayers,
        };
      });
      setHasUnsavedChanges(true);
      clearError();
      return { index: newLayerIndex, layer: newLayer };
    }

    if (result?.err !== undefined) {
      setErrorWithAutoClear(
        `Failed to add layer: maximum layer count reached or operation not allowed`,
      );
    }

    return null;
  }, [callRpc, clearError, setErrorWithAutoClear]);

  // Remove a layer
  const removeLayer = useCallback(
    async (layerIndex: number): Promise<boolean> => {
      // Get the layer ID before removing
      const layerId = keymap?.layers[layerIndex]?.id;

      const result = await callRpc(
        { keymap: { removeLayer: { layerIndex } } },
        (response) => response.keymap?.removeLayer,
      );

      if (result?.ok !== undefined) {
        // Update keymap by removing the layer
        setKeymap((prev) => {
          if (!prev) return prev;
          const newLayers = prev.layers.filter((_, i) => i !== layerIndex);
          return {
            ...prev,
            layers: newLayers,
          };
        });

        // Track removed layer ID for potential restoration
        if (layerId !== undefined) {
          setRemovedLayerIds((prev) => [...prev, layerId]);
        }

        setHasUnsavedChanges(true);
        clearError();
        return true;
      }

      if (result?.err !== undefined) {
        setErrorWithAutoClear(
          `Failed to remove layer: invalid layer index or operation not allowed`,
        );
      }

      return false;
    },
    [callRpc, keymap?.layers, clearError, setErrorWithAutoClear],
  );

  // Restore a deleted layer
  const restoreLayer = useCallback(
    async (layerId: number, atIndex: number): Promise<Layer | null> => {
      const result = await callRpc(
        { keymap: { restoreLayer: { layerId, atIndex } } },
        (response) => response.keymap?.restoreLayer,
      );

      if (result?.ok) {
        const restoredLayer = result.ok;

        // Update keymap with the restored layer
        setKeymap((prev) => {
          if (!prev) return prev;
          const newLayers = [...prev.layers];
          newLayers.splice(atIndex, 0, restoredLayer);
          return {
            ...prev,
            layers: newLayers,
          };
        });

        // Remove from tracked removed layer IDs
        setRemovedLayerIds((prev) => prev.filter((id) => id !== layerId));

        setHasUnsavedChanges(true);
        clearError();
        return restoredLayer;
      }

      if (result?.err !== undefined) {
        setErrorWithAutoClear(
          `Failed to restore layer: layer not found or invalid position`,
        );
      }

      return null;
    },
    [callRpc, clearError, setErrorWithAutoClear],
  );

  // Set layer name
  const setLayerName = useCallback(
    async (layerId: number, name: string): Promise<boolean> => {
      const result = await callRpc(
        { keymap: { setLayerProps: { layerId, name } } },
        (response) => response.keymap?.setLayerProps,
      );

      // SET_LAYER_PROPS_RESP_OK = 0
      if (result === 0) {
        setKeymap((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            layers: prev.layers.map((layer) =>
              layer.id === layerId ? { ...layer, name } : layer,
            ),
          };
        });
        setHasUnsavedChanges(true);
        clearError();
        return true;
      }

      // SET_LAYER_PROPS_RESP_ERR_INVALID_ID = 2
      if (result === 2) {
        setErrorWithAutoClear(`Failed to rename layer: invalid layer ID`);
      } else {
        setErrorWithAutoClear(`Failed to rename layer`);
      }

      return false;
    },
    [callRpc, clearError, setErrorWithAutoClear],
  );

  // Save changes
  const saveChanges = useCallback(async (): Promise<boolean> => {
    const result = await callRpc(
      { keymap: { saveChanges: true } },
      (response) => response.keymap?.saveChanges,
    );

    if (result?.ok) {
      setHasUnsavedChanges(false);
      // Update original bindings to current state after save
      if (keymap) {
        storeOriginalBindings(keymap);
      }
      clearError();
      return true;
    }

    if (result?.err !== undefined) {
      setErrorWithAutoClear(
        `Failed to save changes: operation not allowed or storage error`,
      );
    }

    return false;
  }, [
    callRpc,
    keymap,
    storeOriginalBindings,
    clearError,
    setErrorWithAutoClear,
  ]);

  // Discard changes
  const discardChanges = useCallback(async (): Promise<boolean> => {
    const result = await callRpc(
      { keymap: { discardChanges: true } },
      (response) => response.keymap?.discardChanges,
    );

    if (result) {
      // Reload keymap to get original values
      dataLoadedRef.current = false;
      await loadKeymapData();
      clearError();
      return true;
    }

    setErrorWithAutoClear("Failed to discard changes");
    return false;
  }, [callRpc, loadKeymapData, clearError, setErrorWithAutoClear]);

  // Reset the persistent keymap to the hard-coded default: set every binding
  // that differs from its default value, then save. Only works when the default
  // keymap has been loaded (fast-keymap subsystem present).
  const resetToDefault = useCallback(async (): Promise<boolean> => {
    if (!keymap) return false;
    if (defaultBindings.size === 0) {
      setErrorWithAutoClear("Default keymap is not available");
      return false;
    }

    // Apply only the positions whose current binding differs from the default,
    // to keep the number of RPCs (BLE round-trips) to what actually changed.
    for (const layer of keymap.layers) {
      for (let position = 0; position < layer.bindings.length; position++) {
        const def = defaultBindings.get(bindingKey(layer.id, position));
        if (!def) continue;
        const current = layer.bindings[position];
        if (current && bindingsEqual(current, def)) continue;
        const ok = await setBinding(layer.id, position, def);
        if (!ok) {
          // setBinding already surfaced the error (incl. unlock-required).
          return false;
        }
      }
    }

    // Persist the now-default keymap to flash.
    return saveChanges();
  }, [keymap, defaultBindings, setBinding, saveChanges, setErrorWithAutoClear]);

  // Set active physical layout
  const setActiveLayout = useCallback(
    async (layoutIndex: number): Promise<boolean> => {
      const result = await callRpc(
        {
          keymap: {
            setActivePhysicalLayout: layoutIndex,
          },
        },
        (response) => response.keymap?.setActivePhysicalLayout,
      );

      if (result?.ok) {
        setKeymap(result.ok);

        // On the fast path, non-active layout geometry is loaded lazily (not
        // at initial load — that kept "Finalizing" fast). Fetch the geometry
        // for the layout we're switching to if it hasn't been loaded yet.
        const target = physicalLayouts?.layouts[layoutIndex];
        let geometry: KeyPhysicalAttrs[] | null = null;
        if (target && target.keys.length === 0) {
          try {
            geometry = await loadLayoutGeometry(layoutIndex);
          } catch (err) {
            console.error("Failed to load layout geometry:", err);
          }
        }

        setPhysicalLayouts((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            activeLayoutIndex: layoutIndex,
            layouts: geometry
              ? prev.layouts.map((l, i) =>
                  i === layoutIndex ? { ...l, keys: geometry } : l,
                )
              : prev.layouts,
          };
        });
        clearError();
        return true;
      }
      if (result?.err !== undefined) {
        setErrorWithAutoClear(
          `Failed to set active layout: invalid layout index`,
        );
      }

      return false;
    },
    [
      callRpc,
      physicalLayouts,
      loadLayoutGeometry,
      clearError,
      setErrorWithAutoClear,
    ],
  );

  // Get original binding
  const getOriginalBinding = useCallback(
    (layerId: number, keyPosition: number): BehaviorBinding | null => {
      return originalBindings.get(bindingKey(layerId, keyPosition)) ?? null;
    },
    [originalBindings],
  );

  // Check if binding is modified
  const isBindingModified = useCallback(
    (layerId: number, keyPosition: number): boolean => {
      const original = originalBindings.get(bindingKey(layerId, keyPosition));
      if (!original) return false;

      const layer = keymap?.layers.find((l) => l.id === layerId);
      if (!layer) return false;

      const current = layer.bindings[keyPosition];
      if (!current) return false;

      return !bindingsEqual(original, current);
    },
    [originalBindings, keymap],
  );

  // Check if a binding's PERSISTED value differs from the hard-coded default.
  // Uses the original (persistent) binding, not the current in-memory one, so a
  // key the user is actively editing surfaces as "modified" (green) rather than
  // here — the two highlights are mutually exclusive by design.
  const isBindingChangedFromDefault = useCallback(
    (layerId: number, keyPosition: number): boolean => {
      const key = bindingKey(layerId, keyPosition);
      const def = defaultBindings.get(key);
      if (!def) return false;
      const original = originalBindings.get(key);
      if (!original) return false;
      // Suppress while the key is modified in memory — that takes precedence.
      if (isBindingModified(layerId, keyPosition)) return false;
      return !bindingsEqual(original, def);
    },
    [defaultBindings, originalBindings, isBindingModified],
  );

  // Get behavior by ID
  const getBehavior = useCallback(
    (behaviorId: number): BehaviorDefinition | undefined => {
      return behaviors.get(behaviorId);
    },
    [behaviors],
  );

  // Get display name for a binding
  const getBindingDisplayName = useCallback(
    (binding: BehaviorBinding): string => {
      const behavior = behaviors.get(binding.behaviorId);
      if (!behavior) {
        return `Behavior ${binding.behaviorId}`;
      }

      // For simple behaviors, just return the name
      if (binding.param1 === 0 && binding.param2 === 0) {
        return behavior.displayName;
      }

      // For behaviors with parameters, format them
      return `${behavior.displayName}`;
    },
    [behaviors],
  );

  // Clear unlock required state
  const clearUnlockRequired = useCallback(() => {
    setUnlockRequired(false);
    setError(null);
  }, []);

  // Subscribe to keymap notifications
  useEffect(() => {
    if (!zmkApp) return;

    const unsubscribe = zmkApp.onNotification({
      type: "keymap",
      callback: (notification) => {
        if (notification.unsavedChangesStatusChanged !== undefined) {
          setHasUnsavedChanges(notification.unsavedChangesStatusChanged);
        }
      },
    });

    return unsubscribe;
  }, [zmkApp]);

  // Subscribe to core notifications (for lock state changes)
  useEffect(() => {
    if (!zmkApp) return;

    const unsubscribe = zmkApp.onNotification({
      type: "core",
      callback: (notification) => {
        // LockState.ZMK_STUDIO_CORE_LOCK_STATE_UNLOCKED = 1
        if (notification.lockStateChanged === 1) {
          // Keyboard was unlocked, try loading again
          if (unlockRequired) {
            setUnlockRequired(false);
            setError(null);
            loadKeymapData();
          }
        }
      },
    });

    return unsubscribe;
  }, [zmkApp, unlockRequired, loadKeymapData]);

  // Auto-load keymap data when connected
  useEffect(() => {
    if (connection && !dataLoadedRef.current) {
      loadKeymapData();
    }
  }, [connection, loadKeymapData]);

  // Load the hard-coded default keymap as the FINAL step of the keymap tab
  // load — only once the preview + background behaviors/layers have all settled
  // (isFullyLoaded), so its one-round-trip-per-layer fetch never competes with
  // the preview. Fast-keymap only; skipped entirely on the official path. Fires
  // once per load (guarded by defaultKeymapRequestedRef, re-armed on reload).
  useEffect(() => {
    if (!isFullyLoaded || !isFastKeymapAvailable) return;
    if (defaultKeymapRequestedRef.current) return;
    const layers = keymap?.layers;
    if (!layers || layers.length === 0) return;

    defaultKeymapRequestedRef.current = true;
    const loadId = loadIdRef.current;
    const layerIds = layers.map((layer) => layer.id);
    void loadDefaultKeymap(layerIds)
      .then((defaultsByLayer) => {
        // Ignore a late result from a superseded load (reconnect/reload).
        if (loadIdRef.current !== loadId) return;
        const next = new Map<string, BehaviorBinding>();
        for (const [layerId, bindings] of defaultsByLayer) {
          bindings.forEach((binding, position) => {
            next.set(bindingKey(layerId, position), { ...binding });
          });
        }
        setDefaultBindings(next);
      })
      .catch((err) => {
        // Best-effort: the default keymap only drives an optional highlight and
        // the reset action, so a failure just leaves both unavailable.
        console.error("Failed to load default keymap:", err);
      });
  }, [isFullyLoaded, isFastKeymapAvailable, keymap?.layers, loadDefaultKeymap]);

  // Reset state when disconnected
  useEffect(() => {
    if (!connection) {
      setPhysicalLayouts(null);
      setKeymap(null);
      setBehaviors(new Map());
      setOriginalBindings(new Map());
      setDefaultBindings(new Map());
      setHasUnsavedChanges(false);
      setError(null);
      setUnlockRequired(false);
      setRemovedLayerIds([]);
      setLoadingProgress(null);
      dataLoadedRef.current = false;
      defaultKeymapRequestedRef.current = false;
      // Clear error timer
      if (errorTimerRef.current) {
        clearTimeout(errorTimerRef.current);
        errorTimerRef.current = null;
      }
    }
  }, [connection]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (errorTimerRef.current) {
        clearTimeout(errorTimerRef.current);
      }
    };
  }, []);

  return {
    physicalLayouts,
    keymap,
    behaviors,
    originalBindings,
    hasUnsavedChanges,
    isLoading,
    isFullyLoaded,
    loadingProgress,
    error,
    unlockRequired,
    loadKeymapData,
    setBinding,
    resetBinding,
    moveLayer,
    addLayer,
    removeLayer,
    restoreLayer,
    setLayerName,
    availableLayers: keymap?.availableLayers ?? 0,
    maxLayerNameLength: keymap?.maxLayerNameLength ?? 0,
    removedLayerIds,
    saveChanges,
    discardChanges,
    resetToDefault,
    setActiveLayout,
    getOriginalBinding,
    isBindingModified,
    isFastKeymapAvailable,
    isBindingChangedFromDefault,
    getBehavior,
    getBindingDisplayName,
    clearUnlockRequired,
  };
}
