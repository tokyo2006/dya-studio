import { useState, useEffect, useCallback, useContext } from "react";
import { ZMKAppContext } from "@cormoran/zmk-studio-react-hook";
import { useKeymapSource } from "./useKeymapSource";

/**
 * Lightweight hook returning layer names in keymap order (index === layer
 * index used by the default-layer proto's `value` field, NOT the layer id).
 *
 * Intentionally does not reuse `useKeymap` - that hook is heavy/stateful
 * (tracks dirty state, editing, etc.). It loads names through the shared
 * {@link useKeymapSource} (fast-keymap subsystem when available, official
 * protocol otherwise) so it stays consistent with the keymap editor.
 */
export interface UseLayerNamesReturn {
  layerNames: string[];
  isLoading: boolean;
  load: () => Promise<void>;
}

export function useLayerNames(): UseLayerNamesReturn {
  const zmkApp = useContext(ZMKAppContext);
  const connection = zmkApp?.state.connection;
  const { loadLayerNames } = useKeymapSource();
  const [layerNames, setLayerNames] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(async () => {
    if (!connection) return;

    setIsLoading(true);
    try {
      setLayerNames(await loadLayerNames());
    } catch (err) {
      console.error("Failed to load layer names:", err);
    } finally {
      setIsLoading(false);
    }
  }, [connection, loadLayerNames]);

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
