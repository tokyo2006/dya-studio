import { useState, useEffect, useCallback, useContext } from "react";
import { ZMKAppContext } from "@cormoran/zmk-studio-react-hook";
import { call_rpc } from "@zmkfirmware/zmk-studio-ts-client";

/**
 * Lightweight hook returning layer names in keymap order (index === layer
 * index used by the default-layer proto's `value` field, NOT the layer id).
 *
 * Intentionally does not reuse `useKeymap` - that hook is heavy/stateful
 * (tracks dirty state, editing, etc.) and this is only used to render
 * human-readable labels for layer-index selects.
 */
export interface UseLayerNamesReturn {
  layerNames: string[];
  isLoading: boolean;
  load: () => Promise<void>;
}

export function useLayerNames(): UseLayerNamesReturn {
  const zmkApp = useContext(ZMKAppContext);
  const connection = zmkApp?.state.connection;
  const [layerNames, setLayerNames] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(async () => {
    if (!connection) return;

    setIsLoading(true);
    try {
      const response = await call_rpc(connection, {
        keymap: { getKeymap: true },
      });
      const keymap = response.keymap?.getKeymap;
      if (keymap) {
        setLayerNames(keymap.layers.map((layer) => layer.name));
      }
    } catch (err) {
      console.error("Failed to load layer names:", err);
    } finally {
      setIsLoading(false);
    }
  }, [connection]);

  useEffect(() => {
    if (connection) {
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection]);

  return { layerNames, isLoading, load };
}

/** Fallback label for a layer index that has no known name yet. */
export function layerLabel(layerNames: string[], index: number): string {
  return layerNames[index] ?? `Layer ${index}`;
}
