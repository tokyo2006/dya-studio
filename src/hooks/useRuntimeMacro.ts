import { useState, useEffect, useCallback } from "react";
import { useCustomSubsystem } from "@cormoran/zmk-studio-react-hook";
import {
  Request,
  Response,
  type MacroDetail,
  type MacroGlobalSettings,
  type MacroStep,
  type MacroSummary,
  type StatusResponse,
} from "../proto/cormoran/runtime_macro/runtime_macro";
import { SettingWriteMode } from "../proto/cormoran/zmk/custom_settings/custom_settings";
import { encodeRuntimeMacroSteps } from "../lib/runtimeMacroCodec";
import { useCustomSettings } from "./useCustomSettings";

export type { MacroDetail, MacroGlobalSettings, MacroStep, MacroSummary };

export const RUNTIME_MACRO_SUBSYSTEM_IDENTIFIER = "cormoran__runtime_macro";

// The custom-settings keyspace prefix for runtime macro entries. Raw
// create/delete/rename go through the generic custom-settings
// CreateSetting/DeleteSetting RPC (subsystem "cormoran_custom_settings"),
// not a runtime-macro-specific request - the firmware routes by key prefix.
export const MACRO_KEY_PREFIX = "macro/";

const CODEC = {
  encode: (request: Request) => Request.encode(request).finish(),
  decode: (payload: Uint8Array) => Response.decode(payload),
};

export interface UseRuntimeMacroReturn {
  isAvailable: boolean;
  macros: MacroSummary[];
  globalSettings: MacroGlobalSettings | null;
  maxMacroBytes: number;
  maxNameLength: number;
  hasUnsavedChanges: boolean;
  isLoading: boolean;
  error: string | null;
  clearError: () => void;
  loadMacros: () => Promise<void>;
  getMacro: (slot: number) => Promise<MacroDetail | null>;
  createMacro: (name: string) => Promise<boolean>;
  deleteMacro: (name: string) => Promise<boolean>;
  renameMacro: (
    oldName: string,
    newName: string,
    steps: MacroStep[],
  ) => Promise<boolean>;
  setMacroStepCount: (
    slot: number,
    stepCount: number,
    persist?: boolean,
  ) => Promise<boolean>;
  setMacroStep: (
    slot: number,
    stepIndex: number,
    step: MacroStep,
    persist?: boolean,
  ) => Promise<boolean>;
  appendMacroStep: (
    slot: number,
    step: MacroStep,
    persist?: boolean,
  ) => Promise<boolean>;
  setTapMs: (tapMs: number, persist?: boolean) => Promise<boolean>;
  saveMacros: () => Promise<boolean>;
  discardMacros: () => Promise<boolean>;
}

export function useRuntimeMacro(): UseRuntimeMacroReturn {
  const { subsystem, ready, call } = useCustomSubsystem(
    RUNTIME_MACRO_SUBSYSTEM_IDENTIFIER,
    CODEC,
  );
  const customSettings = useCustomSettings();
  const [macros, setMacros] = useState<MacroSummary[]>([]);
  const [globalSettings, setGlobalSettings] =
    useState<MacroGlobalSettings | null>(null);
  const [maxMacroBytes, setMaxMacroBytes] = useState(64);
  const [maxNameLength, setMaxNameLength] = useState(64);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subsystemIndex = subsystem?.index;

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const callRpc = useCallback(
    async (request: Request): Promise<Response | null> => {
      if (!ready) {
        setError("Not connected to device or subsystem not found");
        return null;
      }

      const response = await call(request);

      if (!response) {
        setError("Runtime macro RPC returned an empty response");
        return null;
      }

      if (response.error) {
        setError(response.error.message);
        return null;
      }

      setError(null);
      return response;
    },
    [ready, call],
  );

  const runMutation = useCallback(
    async (
      request: Request,
      persist: boolean,
    ): Promise<StatusResponse | null> => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await callRpc(request);
        if (!response?.status) {
          return null;
        }
        if (!persist) {
          setHasUnsavedChanges(true);
        }
        return response.status;
      } catch (err) {
        console.error("Runtime macro mutation failed:", err);
        setError(
          `Runtime macro mutation failed: ${
            err instanceof Error ? err.message : "Unknown error"
          }`,
        );
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [callRpc],
  );

  const loadMacros = useCallback(async () => {
    if (!ready) {
      setMacros([]);
      setGlobalSettings(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const listResponse = await callRpc(Request.create({ listMacros: {} }));
      if (listResponse?.listMacros) {
        setMacros(listResponse.listMacros.macros);
        setMaxMacroBytes(listResponse.listMacros.maxMacroBytes || 64);
        setMaxNameLength(listResponse.listMacros.maxNameLength || 64);
      }

      const settingsResponse = await callRpc(
        Request.create({ getMacroGlobalSettings: {} }),
      );
      if (settingsResponse?.getMacroGlobalSettings?.settings) {
        setGlobalSettings(settingsResponse.getMacroGlobalSettings.settings);
      }
    } catch (err) {
      console.error("Failed to load runtime macros:", err);
      setError(
        `Failed to load runtime macros: ${
          err instanceof Error ? err.message : "Unknown error"
        }`,
      );
    } finally {
      setIsLoading(false);
    }
  }, [callRpc, ready]);

  const getMacro = useCallback(
    async (slot: number): Promise<MacroDetail | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await callRpc(Request.create({ getMacro: { slot } }));
        return response?.getMacro?.macro ?? null;
      } catch (err) {
        console.error("Failed to get runtime macro:", err);
        setError(
          `Failed to get runtime macro: ${
            err instanceof Error ? err.message : "Unknown error"
          }`,
        );
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [callRpc],
  );

  const setMacroStepCount = useCallback(
    async (
      slot: number,
      stepCount: number,
      persist = false,
    ): Promise<boolean> => {
      const status = await runMutation(
        Request.create({ setMacroStepCount: { slot, stepCount, persist } }),
        persist,
      );
      return status !== null;
    },
    [runMutation],
  );

  const setMacroStep = useCallback(
    async (
      slot: number,
      stepIndex: number,
      step: MacroStep,
      persist = false,
    ): Promise<boolean> => {
      const status = await runMutation(
        Request.create({
          setMacroStep: { slot, stepIndex, step, persist },
        }),
        persist,
      );
      return status !== null;
    },
    [runMutation],
  );

  const appendMacroStep = useCallback(
    async (slot: number, step: MacroStep, persist = false): Promise<boolean> => {
      const status = await runMutation(
        Request.create({ appendMacroStep: { slot, step, persist } }),
        persist,
      );
      return status !== null;
    },
    [runMutation],
  );

  const setTapMs = useCallback(
    async (tapMs: number, persist = false): Promise<boolean> => {
      const status = await runMutation(
        Request.create({ setTapMs: { tapMs, persist } }),
        persist,
      );
      if (status) {
        setGlobalSettings((prev) => ({
          tapMs,
          maxEntries: prev?.maxEntries ?? 0,
          keyPressBehaviorId: prev?.keyPressBehaviorId ?? 0,
          poolBytesTotal: prev?.poolBytesTotal ?? 0,
          poolBytesUsed: prev?.poolBytesUsed ?? 0,
        }));
      }
      return status !== null;
    },
    [runMutation],
  );

  // Raw create/delete/rename go through the generic custom-settings
  // CreateSetting/DeleteSetting RPC (subsystem "cormoran_custom_settings"),
  // not a runtime-macro-specific request.
  const createMacro = useCallback(
    async (name: string): Promise<boolean> => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await customSettings.createSetting(
          MACRO_KEY_PREFIX + name,
          { bytesValue: Uint8Array.from([1]) }, // format version, no steps
          SettingWriteMode.SETTING_WRITE_MODE_MEMORY,
        );
        if (response.error) {
          setError(response.error.message);
          return false;
        }
        await loadMacros();
        return true;
      } catch (err) {
        console.error("Failed to create runtime macro:", err);
        setError(
          `Failed to create runtime macro: ${
            err instanceof Error ? err.message : "Unknown error"
          }`,
        );
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [customSettings, loadMacros],
  );

  const deleteMacro = useCallback(
    async (name: string): Promise<boolean> => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await customSettings.deleteSetting(
          MACRO_KEY_PREFIX + name,
        );
        if (response.error) {
          setError(response.error.message);
          return false;
        }
        await loadMacros();
        return true;
      } catch (err) {
        console.error("Failed to delete runtime macro:", err);
        setError(
          `Failed to delete runtime macro: ${
            err instanceof Error ? err.message : "Unknown error"
          }`,
        );
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [customSettings, loadMacros],
  );

  const renameMacro = useCallback(
    async (
      oldName: string,
      newName: string,
      steps: MacroStep[],
    ): Promise<boolean> => {
      setIsLoading(true);
      setError(null);
      try {
        const encoded = encodeRuntimeMacroSteps(steps);
        // Create the new name first (carrying the current body), then delete
        // the old one - so a failure never loses data.
        const createResponse = await customSettings.createSetting(
          MACRO_KEY_PREFIX + newName,
          { bytesValue: encoded },
          SettingWriteMode.SETTING_WRITE_MODE_MEMORY,
        );
        if (createResponse.error) {
          setError(createResponse.error.message);
          return false;
        }
        const deleteResponse = await customSettings.deleteSetting(
          MACRO_KEY_PREFIX + oldName,
        );
        if (deleteResponse.error) {
          setError(deleteResponse.error.message);
          return false;
        }
        await loadMacros();
        return true;
      } catch (err) {
        console.error("Failed to rename runtime macro:", err);
        setError(
          `Failed to rename runtime macro: ${
            err instanceof Error ? err.message : "Unknown error"
          }`,
        );
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [customSettings, loadMacros],
  );

  const saveMacros = useCallback(async (): Promise<boolean> => {
    const status = await runMutation(Request.create({ saveMacros: {} }), true);
    if (status) {
      setHasUnsavedChanges(false);
      await loadMacros();
    }
    return status !== null;
  }, [loadMacros, runMutation]);

  const discardMacros = useCallback(async (): Promise<boolean> => {
    const status = await runMutation(
      Request.create({ discardMacros: {} }),
      true,
    );
    if (status) {
      setHasUnsavedChanges(false);
      await loadMacros();
    }
    return status !== null;
  }, [loadMacros, runMutation]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (subsystemIndex === undefined) {
        setMacros([]);
        setGlobalSettings(null);
        setHasUnsavedChanges(false);
        return;
      }
      void loadMacros();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadMacros, subsystemIndex]);

  return {
    isAvailable: subsystem !== null,
    macros,
    globalSettings,
    maxMacroBytes,
    maxNameLength,
    hasUnsavedChanges,
    isLoading,
    error,
    clearError,
    loadMacros,
    getMacro,
    createMacro,
    deleteMacro,
    renameMacro,
    setMacroStepCount,
    setMacroStep,
    appendMacroStep,
    setTapMs,
    saveMacros,
    discardMacros,
  };
}
