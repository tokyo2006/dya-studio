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
import { useKeymapSource } from "./useKeymapSource";
import { useStudioUnlock } from "./useStudioUnlock";
import { StudioUnlockCancelledError } from "../lib/studioUnlock";

export interface UseOfficialLayoutsReturn {
  physicalLayouts: PhysicalLayouts | null;
  isLoading: boolean;
  error: string | null;
  load: () => Promise<void>;
}

export function useOfficialLayouts(): UseOfficialLayoutsReturn {
  const zmkApp = useContext(ZMKAppContext);
  const connection = zmkApp?.state.connection ?? null;
  const { loadPhysicalLayouts } = useKeymapSource();
  const { runWithUnlock } = useStudioUnlock();

  const [physicalLayouts, setPhysicalLayouts] =
    useState<PhysicalLayouts | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!connection) return;
    setIsLoading(true);
    setError(null);
    try {
      // A locked keyboard surfaces the shared unlock modal and the load is
      // retried after unlock, so `layouts` is always a real result here.
      const layouts = await runWithUnlock(() => loadPhysicalLayouts());
      setPhysicalLayouts(layouts);
    } catch (e) {
      if (e instanceof StudioUnlockCancelledError) {
        // User dismissed the unlock modal; leave layouts unloaded silently.
      } else {
        setError(e instanceof Error ? e.message : "Unknown error");
      }
    } finally {
      setIsLoading(false);
    }
  }, [connection, loadPhysicalLayouts, runWithUnlock]);

  return { physicalLayouts, isLoading, error, load };
}
