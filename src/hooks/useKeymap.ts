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
import { call_rpc } from "@zmkfirmware/zmk-studio-ts-client";
import type {
  Keymap,
  Layer,
  BehaviorBinding,
  PhysicalLayouts,
  PhysicalLayout,
  KeyPhysicalAttrs,
} from "@zmkfirmware/zmk-studio-ts-client/keymap";
import type { BehaviorBindingParametersSet } from "@zmkfirmware/zmk-studio-ts-client/behaviors";
import { ErrorConditions } from "@zmkfirmware/zmk-studio-ts-client/meta";

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

/**
 * Behavior definition loaded from the keyboard
 */
export interface BehaviorDefinition {
  id: number;
  displayName: string;
  metadata: BehaviorBindingParametersSet[];
}

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
  /** Get available layer count (can restore up to this many) */
  availableLayers: number;
  /** Save all changes to the keyboard */
  saveChanges: () => Promise<boolean>;
  /** Discard all unsaved changes */
  discardChanges: () => Promise<boolean>;
  /** Set the active physical layout */
  setActiveLayout: (layoutIndex: number) => Promise<boolean>;
  /** Get the original binding for a key (before modification) */
  getOriginalBinding: (
    layerId: number,
    keyPosition: number,
  ) => BehaviorBinding | null;
  /** Check if a binding has been modified */
  isBindingModified: (layerId: number, keyPosition: number) => boolean;
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
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unlockRequired, setUnlockRequired] = useState(false);
  const [removedLayerIds, setRemovedLayerIds] = useState<number[]>([]);

  // Ref to track if data has been loaded
  const dataLoadedRef = useRef(false);
  // Timer for auto-clearing errors
  const errorTimerRef = useRef<number | null>(null);

  // Get connection from ZMK app context
  const connection = useMemo(
    () => zmkApp?.state.connection,
    [zmkApp?.state.connection],
  );

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
        const response = await call_rpc(connection, request);

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

  // Load physical layouts
  const loadPhysicalLayouts =
    useCallback(async (): Promise<PhysicalLayouts | null> => {
      return callRpc(
        { keymap: { getPhysicalLayouts: true } },
        (response) => response.keymap?.getPhysicalLayouts,
      );
    }, [callRpc]);

  // Load keymap
  const loadKeymap = useCallback(async (): Promise<Keymap | null> => {
    return callRpc(
      { keymap: { getKeymap: true } },
      (response) => response.keymap?.getKeymap,
    );
  }, [callRpc]);

  // Load all behaviors
  const loadBehaviors = useCallback(async (): Promise<
    Map<number, BehaviorDefinition>
  > => {
    const behaviorsMap = new Map<number, BehaviorDefinition>();

    // First get list of all behavior IDs
    const behaviorIds = await callRpc(
      { behaviors: { listAllBehaviors: true } },
      (response) => response.behaviors?.listAllBehaviors?.behaviors,
    );

    if (!behaviorIds) {
      return behaviorsMap;
    }

    // Then get details for each behavior
    for (const behaviorId of behaviorIds) {
      const details = await callRpc(
        { behaviors: { getBehaviorDetails: { behaviorId } } },
        (response) => response.behaviors?.getBehaviorDetails,
      );

      if (details) {
        behaviorsMap.set(behaviorId, {
          id: details.id,
          displayName: details.displayName,
          metadata: details.metadata,
        });
      }
    }

    return behaviorsMap;
  }, [callRpc]);

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

  // Load all keymap data
  const loadKeymapData = useCallback(async () => {
    if (!connection) {
      setErrorWithAutoClear("Not connected to keyboard");
      return;
    }

    setIsLoading(true);
    setError(null);
    setUnlockRequired(false);

    try {
      // Load physical layouts
      const layouts = await loadPhysicalLayouts();
      if (layouts) {
        setPhysicalLayouts(layouts);
      }

      // Load keymap
      const km = await loadKeymap();
      if (km) {
        setKeymap(km);
        // Only store original bindings on first load
        if (!dataLoadedRef.current) {
          storeOriginalBindings(km);
          dataLoadedRef.current = true;
        }
      }

      // Load behaviors
      const behaviorMap = await loadBehaviors();
      setBehaviors(behaviorMap);

      // Check unsaved changes
      const unsaved = await callRpc(
        { keymap: { checkUnsavedChanges: true } },
        (response) => response.keymap?.checkUnsavedChanges,
      );
      setHasUnsavedChanges(unsaved ?? false);
    } catch (err) {
      console.error("Failed to load keymap data:", err);
      setErrorWithAutoClear(
        err instanceof Error ? err.message : "Failed to load keymap data",
      );
    } finally {
      setIsLoading(false);
    }
  }, [
    connection,
    loadPhysicalLayouts,
    loadKeymap,
    loadBehaviors,
    storeOriginalBindings,
    callRpc,
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
        setPhysicalLayouts((prev) =>
          prev ? { ...prev, activeLayoutIndex: layoutIndex } : prev,
        );
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
    [callRpc, clearError, setErrorWithAutoClear],
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

  // Reset state when disconnected
  useEffect(() => {
    if (!connection) {
      setPhysicalLayouts(null);
      setKeymap(null);
      setBehaviors(new Map());
      setOriginalBindings(new Map());
      setHasUnsavedChanges(false);
      setError(null);
      setUnlockRequired(false);
      setRemovedLayerIds([]);
      dataLoadedRef.current = false;
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
    error,
    unlockRequired,
    loadKeymapData,
    setBinding,
    resetBinding,
    moveLayer,
    addLayer,
    removeLayer,
    restoreLayer,
    availableLayers: keymap?.availableLayers ?? 0,
    removedLayerIds,
    saveChanges,
    discardChanges,
    setActiveLayout,
    getOriginalBinding,
    isBindingModified,
    getBehavior,
    getBindingDisplayName,
    clearUnlockRequired,
  };
}
