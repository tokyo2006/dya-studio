/**
 * useRuntimeCombo Hook
 *
 * Provides access to cormoran/zmk-feature-runtime-combo through the custom ZMK
 * Studio RPC subsystem.
 */
import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  ZMKAppContext,
  ZMKCustomSubsystem,
} from "@cormoran/zmk-studio-react-hook";
import {
  Request,
  Response,
  type Combo,
  type GlobalSettings,
  type BehaviorBinding,
  type StatusResponse,
} from "../proto/cormoran/runtime_combo/runtime_combo";

export type { Combo, GlobalSettings, BehaviorBinding, StatusResponse };

export const RUNTIME_COMBO_IDENTIFIER = "cormoran__runtime_combo";

export interface ComboInput {
  index: number;
  keyPositions: number[];
  behavior: BehaviorBinding;
  layerMask: number;
  enabled: boolean;
}

export interface UseRuntimeComboReturn {
  isAvailable: boolean;
  combos: Combo[];
  globalSettings: GlobalSettings | null;
  isLoading: boolean;
  error: string | null;
  hasPendingChanges: boolean;
  loadCombos: () => Promise<void>;
  loadGlobalSettings: () => Promise<void>;
  reload: () => Promise<void>;
  setCombo: (combo: ComboInput, persist?: boolean) => Promise<boolean>;
  setComboName: (
    index: number,
    name: string,
    persist?: boolean,
  ) => Promise<boolean>;
  deleteCombo: (index: number, persist?: boolean) => Promise<boolean>;
  setTimeoutMs: (timeoutMs: number, persist?: boolean) => Promise<boolean>;
  setSlowRelease: (slowRelease: boolean, persist?: boolean) => Promise<boolean>;
  saveChanges: () => Promise<StatusResponse | null>;
  discardChanges: () => Promise<StatusResponse | null>;
  clearError: () => void;
}

export function useRuntimeCombo(): UseRuntimeComboReturn {
  const zmkApp = useContext(ZMKAppContext);
  const [combos, setCombos] = useState<Combo[]>([]);
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasPendingChanges, setHasPendingChanges] = useState(false);

  const subsystem = useMemo(
    () => zmkApp?.findSubsystem(RUNTIME_COMBO_IDENTIFIER),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [zmkApp?.state.customSubsystems],
  );
  const subsystemIndex = subsystem?.index;

  const callRuntimeComboRPC = useCallback(
    async (request: Request): Promise<Response | null> => {
      if (!zmkApp?.state.connection || subsystemIndex === undefined) {
        setError("Not connected to device or subsystem not found");
        return null;
      }

      const service = new ZMKCustomSubsystem(
        zmkApp.state.connection,
        subsystemIndex,
      );
      const payload = Request.encode(request).finish();
      const responsePayload = await service.callRPC(payload);
      if (!responsePayload) {
        return null;
      }

      const response = Response.decode(responsePayload);
      if (response.error) {
        setError(response.error.message);
        return response;
      }

      setError(null);
      return response;
    },
    [zmkApp, subsystemIndex],
  );

  const loadCombos = useCallback(async () => {
    if (!zmkApp?.state.connection || subsystemIndex === undefined) {
      setCombos([]);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const response = await callRuntimeComboRPC(
        Request.create({ listCombos: {} }),
      );
      if (response?.listCombos) {
        setCombos(
          [...response.listCombos.combos].sort((a, b) => a.index - b.index),
        );
      }
    } catch (err) {
      console.error("Failed to load runtime combos:", err);
      setError(
        `Failed to load runtime combos: ${
          err instanceof Error ? err.message : "Unknown error"
        }`,
      );
    } finally {
      setIsLoading(false);
    }
  }, [callRuntimeComboRPC, subsystemIndex, zmkApp?.state.connection]);

  const loadGlobalSettings = useCallback(async () => {
    if (!zmkApp?.state.connection || subsystemIndex === undefined) {
      setGlobalSettings(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const response = await callRuntimeComboRPC(
        Request.create({ getGlobalSettings: {} }),
      );
      if (response?.getGlobalSettings?.settings) {
        setGlobalSettings(response.getGlobalSettings.settings);
      }
    } catch (err) {
      console.error("Failed to load runtime combo settings:", err);
      setError(
        `Failed to load runtime combo settings: ${
          err instanceof Error ? err.message : "Unknown error"
        }`,
      );
    } finally {
      setIsLoading(false);
    }
  }, [callRuntimeComboRPC, subsystemIndex, zmkApp?.state.connection]);

  const reload = useCallback(async () => {
    await Promise.all([loadCombos(), loadGlobalSettings()]);
  }, [loadCombos, loadGlobalSettings]);

  const setCombo = useCallback(
    async (combo: ComboInput, persist = false): Promise<boolean> => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await callRuntimeComboRPC(
          Request.create({
            setCombo: {
              ...combo,
              persist,
            },
          }),
        );
        if (response?.error) {
          return false;
        }
        if (response?.status) {
          setCombos((prev) => {
            const existing = prev.find((item) => item.index === combo.index);
            const nextCombo: Combo = {
              index: combo.index,
              name: existing?.name ?? "",
              keyPositions: [...combo.keyPositions],
              behavior: { ...combo.behavior },
              layerMask: combo.layerMask,
              enabled: combo.enabled,
            };
            return [
              ...prev.filter((item) => item.index !== combo.index),
              nextCombo,
            ].sort((a, b) => a.index - b.index);
          });
          if (!persist) {
            setHasPendingChanges(true);
          }
          return true;
        }
      } catch (err) {
        console.error("Failed to set runtime combo:", err);
        setError(
          `Failed to set runtime combo: ${
            err instanceof Error ? err.message : "Unknown error"
          }`,
        );
      } finally {
        setIsLoading(false);
      }
      return false;
    },
    [callRuntimeComboRPC],
  );

  const setComboName = useCallback(
    async (index: number, name: string, persist = false): Promise<boolean> => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await callRuntimeComboRPC(
          Request.create({
            setComboName: {
              index,
              name,
              persist,
            },
          }),
        );
        if (response?.error) {
          return false;
        }
        if (response?.status) {
          setCombos((prev) =>
            prev.map((combo) =>
              combo.index === index ? { ...combo, name } : combo,
            ),
          );
          if (!persist) {
            setHasPendingChanges(true);
          }
          return true;
        }
      } catch (err) {
        console.error("Failed to set runtime combo name:", err);
        setError(
          `Failed to set runtime combo name: ${
            err instanceof Error ? err.message : "Unknown error"
          }`,
        );
      } finally {
        setIsLoading(false);
      }
      return false;
    },
    [callRuntimeComboRPC],
  );

  const deleteCombo = useCallback(
    async (index: number, persist = false): Promise<boolean> => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await callRuntimeComboRPC(
          Request.create({ deleteCombo: { index, persist } }),
        );
        if (response?.error) {
          return false;
        }
        if (response?.status) {
          setCombos((prev) => prev.filter((combo) => combo.index !== index));
          if (!persist) {
            setHasPendingChanges(true);
          }
          return true;
        }
      } catch (err) {
        console.error("Failed to delete runtime combo:", err);
        setError(
          `Failed to delete runtime combo: ${
            err instanceof Error ? err.message : "Unknown error"
          }`,
        );
      } finally {
        setIsLoading(false);
      }
      return false;
    },
    [callRuntimeComboRPC],
  );

  const setTimeoutMs = useCallback(
    async (timeoutMs: number, persist = false): Promise<boolean> => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await callRuntimeComboRPC(
          Request.create({ setTimeoutMs: { timeoutMs, persist } }),
        );
        if (response?.error) {
          return false;
        }
        if (response?.status) {
          setGlobalSettings((prev) =>
            prev
              ? { ...prev, timeoutMs }
              : { timeoutMs, slowRelease: false, maxCombo: 0 },
          );
          if (!persist) {
            setHasPendingChanges(true);
          }
          return true;
        }
      } catch (err) {
        console.error("Failed to set runtime combo timeout:", err);
        setError(
          `Failed to set runtime combo timeout: ${
            err instanceof Error ? err.message : "Unknown error"
          }`,
        );
      } finally {
        setIsLoading(false);
      }
      return false;
    },
    [callRuntimeComboRPC],
  );

  const setSlowRelease = useCallback(
    async (slowRelease: boolean, persist = false): Promise<boolean> => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await callRuntimeComboRPC(
          Request.create({ setSlowRelease: { slowRelease, persist } }),
        );
        if (response?.error) {
          return false;
        }
        if (response?.status) {
          setGlobalSettings((prev) =>
            prev
              ? { ...prev, slowRelease }
              : { timeoutMs: 50, slowRelease, maxCombo: 0 },
          );
          if (!persist) {
            setHasPendingChanges(true);
          }
          return true;
        }
      } catch (err) {
        console.error("Failed to set runtime combo slow release:", err);
        setError(
          `Failed to set runtime combo slow release: ${
            err instanceof Error ? err.message : "Unknown error"
          }`,
        );
      } finally {
        setIsLoading(false);
      }
      return false;
    },
    [callRuntimeComboRPC],
  );

  const saveChanges = useCallback(async (): Promise<StatusResponse | null> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await callRuntimeComboRPC(Request.create({ save: {} }));
      if (response?.status) {
        setHasPendingChanges(false);
        await reload();
        return response.status;
      }
      return null;
    } catch (err) {
      console.error("Failed to save runtime combo changes:", err);
      setError(
        `Failed to save runtime combo changes: ${
          err instanceof Error ? err.message : "Unknown error"
        }`,
      );
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [callRuntimeComboRPC, reload]);

  const discardChanges =
    useCallback(async (): Promise<StatusResponse | null> => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await callRuntimeComboRPC(
          Request.create({ discard: {} }),
        );
        if (response?.status) {
          setHasPendingChanges(false);
          await reload();
          return response.status;
        }
        return null;
      } catch (err) {
        console.error("Failed to discard runtime combo changes:", err);
        setError(
          `Failed to discard runtime combo changes: ${
            err instanceof Error ? err.message : "Unknown error"
          }`,
        );
        return null;
      } finally {
        setIsLoading(false);
      }
    }, [callRuntimeComboRPC, reload]);

  useEffect(() => {
    if (subsystemIndex !== undefined && zmkApp?.state.connection) {
      void reload();
    } else {
      setCombos([]);
      setGlobalSettings(null);
      setHasPendingChanges(false);
      setError(null);
    }
  }, [reload, subsystemIndex, zmkApp?.state.connection]);

  return {
    isAvailable: subsystemIndex !== undefined,
    combos,
    globalSettings,
    isLoading,
    error,
    hasPendingChanges,
    loadCombos,
    loadGlobalSettings,
    reload,
    setCombo,
    setComboName,
    deleteCombo,
    setTimeoutMs,
    setSlowRelease,
    saveChanges,
    discardChanges,
    clearError: () => setError(null),
  };
}
