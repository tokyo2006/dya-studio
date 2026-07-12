/**
 * Loads physical key geometry the same way the keymap editor does — through
 * {@link useKeymapSource}, so it uses the fast-keymap subsystem when the
 * device exposes it and the official `keymap.getPhysicalLayouts` call
 * otherwise. Lets KscanKeyboardView draw physical key geometry without
 * duplicating layout knowledge or depending on the heavy keymap-editing hook.
 *
 * Ported from cormoran/zmk-feature-kscan-diagnostics's
 * web/src/useOfficialKeymap.ts, trimmed to just physical layouts.
 */
import { useCallback, useContext, useState } from "react";
import type { PhysicalLayouts } from "@zmkfirmware/zmk-studio-ts-client/keymap";
import { ZMKAppContext } from "@cormoran/zmk-studio-react-hook";
import { useKeymapSource, isKeymapUnlockRequired } from "./useKeymapSource";

export interface UseOfficialLayoutsReturn {
  physicalLayouts: PhysicalLayouts | null;
  isLoading: boolean;
  /** True when the last load failed because Studio is locked. */
  unlockRequired: boolean;
  error: string | null;
  load: () => Promise<void>;
}

export function useOfficialLayouts(): UseOfficialLayoutsReturn {
  const zmkApp = useContext(ZMKAppContext);
  const connection = zmkApp?.state.connection ?? null;
  const { loadPhysicalLayouts } = useKeymapSource();

  const [physicalLayouts, setPhysicalLayouts] =
    useState<PhysicalLayouts | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [unlockRequired, setUnlockRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!connection) return;
    setIsLoading(true);
    setError(null);
    try {
      const layouts = await loadPhysicalLayouts();
      setUnlockRequired(false);
      setPhysicalLayouts(layouts);
    } catch (e) {
      if (isKeymapUnlockRequired(e)) {
        setUnlockRequired(true);
      } else {
        setError(e instanceof Error ? e.message : "Unknown error");
      }
    } finally {
      setIsLoading(false);
    }
  }, [connection, loadPhysicalLayouts]);

  return { physicalLayouts, isLoading, unlockRequired, error, load };
}
