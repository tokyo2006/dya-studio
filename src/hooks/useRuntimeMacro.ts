import { useState, useEffect, useCallback, useContext, useMemo } from "react";
import {
  ZMKCustomSubsystem,
  ZMKAppContext,
} from "@cormoran/zmk-studio-react-hook";
import {
  Request,
  Response,
  type MacroGlobalSettings,
  type MacroSlot,
  type MacroStep,
  type MacroSummary,
  type StatusResponse,
} from "../proto/cormoran/runtime_macro/runtime_macro";

export type { MacroGlobalSettings, MacroSlot, MacroStep, MacroSummary };

export const RUNTIME_MACRO_SUBSYSTEM_IDENTIFIER = "cormoran__runtime_macro";

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
  getMacro: (index: number) => Promise<MacroSlot | null>;
  setMacroName: (
    index: number,
    name: string,
    persist?: boolean,
  ) => Promise<boolean>;
  setMacroStepCount: (
    index: number,
    stepCount: number,
    persist?: boolean,
  ) => Promise<boolean>;
  setMacroStep: (
    index: number,
    stepIndex: number,
    step: MacroStep,
    persist?: boolean,
  ) => Promise<boolean>;
  setTapMs: (tapMs: number, persist?: boolean) => Promise<boolean>;
  deleteMacro: (index: number, persist?: boolean) => Promise<boolean>;
  saveMacros: () => Promise<boolean>;
  discardMacros: () => Promise<boolean>;
}

export function useRuntimeMacro(): UseRuntimeMacroReturn {
  const zmkApp = useContext(ZMKAppContext);
  const [macros, setMacros] = useState<MacroSummary[]>([]);
  const [globalSettings, setGlobalSettings] =
    useState<MacroGlobalSettings | null>(null);
  const [maxMacroBytes, setMaxMacroBytes] = useState(64);
  const [maxNameLength, setMaxNameLength] = useState(64);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subsystem = useMemo(
    () => zmkApp?.findSubsystem(RUNTIME_MACRO_SUBSYSTEM_IDENTIFIER),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [zmkApp?.state.customSubsystems],
  );
  const subsystemIndex = subsystem?.index;

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const callRpc = useCallback(
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
        setError("Runtime macro RPC returned an empty response");
        return null;
      }

      const response = Response.decode(responsePayload);
      if (response.error) {
        setError(response.error.message);
        return null;
      }

      setError(null);
      return response;
    },
    [zmkApp, subsystemIndex],
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
    if (!zmkApp?.state.connection || subsystemIndex === undefined) {
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
  }, [callRpc, zmkApp?.state.connection, subsystemIndex]);

  const getMacro = useCallback(
    async (index: number): Promise<MacroSlot | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await callRpc(Request.create({ getMacro: { index } }));
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

  const setMacroName = useCallback(
    async (index: number, name: string, persist = false): Promise<boolean> => {
      const status = await runMutation(
        Request.create({ setMacroName: { index, name, persist } }),
        persist,
      );
      return status !== null;
    },
    [runMutation],
  );

  const setMacroStepCount = useCallback(
    async (
      index: number,
      stepCount: number,
      persist = false,
    ): Promise<boolean> => {
      const status = await runMutation(
        Request.create({ setMacroStepCount: { index, stepCount, persist } }),
        persist,
      );
      return status !== null;
    },
    [runMutation],
  );

  const setMacroStep = useCallback(
    async (
      index: number,
      stepIndex: number,
      step: MacroStep,
      persist = false,
    ): Promise<boolean> => {
      const status = await runMutation(
        Request.create({
          setMacroStep: { index, stepIndex, step, persist },
        }),
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
          maxMacro: prev?.maxMacro ?? 0,
        }));
      }
      return status !== null;
    },
    [runMutation],
  );

  const deleteMacro = useCallback(
    async (index: number, persist = false): Promise<boolean> => {
      const status = await runMutation(
        Request.create({ deleteMacro: { index, persist } }),
        persist,
      );
      return status !== null;
    },
    [runMutation],
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
    isAvailable: subsystemIndex !== undefined,
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
    setMacroName,
    setMacroStepCount,
    setMacroStep,
    setTapMs,
    deleteMacro,
    saveMacros,
    discardMacros,
  };
}
