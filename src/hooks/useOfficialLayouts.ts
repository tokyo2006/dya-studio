/**
 * Wraps the official ZMK Studio protocol's `keymap.getPhysicalLayouts` call
 * — the same data zmk.studio uses to render the keyboard — so
 * KscanKeyboardView can draw physical key geometry without duplicating
 * layout knowledge or depending on the app's own keymap-editing hook.
 *
 * Ported from cormoran/zmk-feature-kscan-diagnostics's
 * web/src/useOfficialKeymap.ts, trimmed to just physical layouts.
 */
import { useCallback, useContext, useState } from "react";
import { call_rpc, MetaError } from "@zmkfirmware/zmk-studio-ts-client";
import { ErrorConditions } from "@zmkfirmware/zmk-studio-ts-client/meta";
import type { PhysicalLayouts } from "@zmkfirmware/zmk-studio-ts-client/keymap";
import { ZMKAppContext } from "@cormoran/zmk-studio-react-hook";

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
      const resp = await call_rpc(connection, {
        keymap: { getPhysicalLayouts: true },
      });
      setUnlockRequired(false);
      if (resp.keymap?.getPhysicalLayouts) {
        setPhysicalLayouts(resp.keymap.getPhysicalLayouts);
      }
    } catch (e) {
      if (
        e instanceof MetaError &&
        e.condition === ErrorConditions.UNLOCK_REQUIRED
      ) {
        setUnlockRequired(true);
      } else {
        setError(e instanceof Error ? e.message : "Unknown error");
      }
    } finally {
      setIsLoading(false);
    }
  }, [connection]);

  return { physicalLayouts, isLoading, unlockRequired, error, load };
}
