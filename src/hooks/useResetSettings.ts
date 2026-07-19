/**
 * useResetSettings Hook
 *
 * Wraps the ZMK core `reset_settings` RPC, which wipes every persisted setting
 * on the keyboard back to its firmware defaults — including the keymap and all
 * custom-settings subsystems. This is the app-wide "factory reset" affordance
 * exposed from the Settings tab, distinct from the keymap-only reset (which
 * only rewrites key bindings) and the per-section custom-settings reset.
 *
 * The call is routed through the shared Studio-unlock gate so a locked device
 * transparently surfaces the unlock modal and retries after unlock, mirroring
 * every other device mutation in the app.
 */
import { useState, useCallback, useContext } from "react";
import { ZMKAppContext } from "@cormoran/zmk-studio-react-hook";
import { loggedCallRpc } from "../lib/rpcLogging";
import { useStudioUnlock } from "./useStudioUnlock";
import { studioLockErrorText } from "../lib/studioUnlock";

export interface UseResetSettingsReturn {
  /**
   * Reset every persisted setting on the keyboard to firmware defaults.
   * Resolves `true` on success, `false` if it failed (error is set). Gated on
   * unlock: a locked device opens the shared unlock modal and retries.
   */
  resetAllSettings: () => Promise<boolean>;
  /** True while a reset RPC is in flight. */
  isResetting: boolean;
  /** i18n key / message of the last failure, or null. */
  error: string | null;
  /** Clear the current error. */
  clearError: () => void;
}

export function useResetSettings(): UseResetSettingsReturn {
  const zmkApp = useContext(ZMKAppContext);
  const connection = zmkApp?.state.connection ?? null;
  const { runWithUnlock } = useStudioUnlock();
  const [isResetting, setIsResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const resetAllSettings = useCallback(async (): Promise<boolean> => {
    if (!connection) {
      setError("Not connected to keyboard");
      return false;
    }

    setIsResetting(true);
    setError(null);

    try {
      // Route through the unlock gate: a locked device opens the shared modal
      // and this call is retried once unlocked. The core `reset_settings`
      // request is a plain boolean flag.
      const response = await runWithUnlock(() =>
        loggedCallRpc(connection, { core: { resetSettings: true } }),
      );

      if (response.meta?.simpleError !== undefined) {
        setError(`RPC error: ${response.meta.simpleError}`);
        return false;
      }

      // Treat any non-error response as success: the firmware wipes settings
      // and may reboot immediately, so it can answer with `resetSettings: true`
      // or with an empty core response before the reset takes effect.
      return true;
    } catch (err) {
      const locked = studioLockErrorText(err);
      if (locked !== null) {
        // Blocked by the unlock gate (modal dismissed / cooldown): surface the
        // shared "device is locked" message.
        setError(locked);
        return false;
      }
      console.error("Reset settings failed:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
      return false;
    } finally {
      setIsResetting(false);
    }
  }, [connection, runWithUnlock]);

  return { resetAllSettings, isResetting, error, clearError };
}
