import { useState, useEffect, useCallback } from "react";
import { useCustomSubsystem } from "@cormoran/zmk-studio-react-hook";
import {
  Request,
  Response,
  OutputPriority,
} from "../proto/zmk/ble_management/ble_management";

// Subsystem identifier for ZMK BLE management custom protocol
// This matches the identifier registered in the ZMK firmware module
const SUBSYSTEM_IDENTIFIER = "cormoran_ble";

const CODEC = {
  encode: (request: Request) => Request.encode(request).finish(),
  decode: (payload: Uint8Array) => Response.decode(payload),
};

export interface BLEProfile {
  index: number;
  name: string;
  address: string;
  isConnected: boolean;
  isOpen: boolean;
  isActive: boolean;
}

export interface UseBLEProfilesReturn {
  isAvailable: boolean;
  profiles: BLEProfile[];
  maxProfiles: number;
  isLoading: boolean;
  error: string | null;
  outputPriority: OutputPriority | null;
  loadProfiles: () => Promise<void>;
  switchProfile: (index: number) => Promise<void>;
  unpairProfile: (index: number) => Promise<void>;
  setProfileName: (index: number, name: string) => Promise<void>;
  getOutputPriority: () => Promise<void>;
  setOutputPriority: (priority: OutputPriority) => Promise<void>;
}

export function useBLEProfiles(): UseBLEProfilesReturn {
  const { subsystem, ready, call } = useCustomSubsystem(
    SUBSYSTEM_IDENTIFIER,
    CODEC,
  );
  const [profiles, setProfiles] = useState<BLEProfile[]>([]);
  const [maxProfiles, setMaxProfiles] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outputPriority, setOutputPriorityState] =
    useState<OutputPriority | null>(null);

  const loadProfiles = useCallback(async () => {
    if (!ready) {
      setError("Not connected to device or subsystem not found");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const resp = await call(Request.create({ getProfiles: {} }));

      if (resp) {
        if (resp.getProfiles) {
          // The protobuf-generated ProfileInfo matches our BLEProfile interface
          const profiles = resp.getProfiles.profiles.map((p) => ({
            index: p.index,
            name: p.name,
            address: p.address,
            isConnected: p.isConnected,
            isOpen: p.isOpen,
            isActive: p.isActive,
          }));
          setProfiles(profiles);
          setMaxProfiles(resp.getProfiles.maxProfiles);
        } else if (resp.error) {
          setError(resp.error.message);
        }
      }
    } catch (err) {
      console.error("Failed to load profiles:", err);
      setError(
        `Failed to load profiles: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
    } finally {
      setIsLoading(false);
    }
  }, [ready, call]);

  const switchProfile = useCallback(
    async (index: number) => {
      if (!ready) return;

      setIsLoading(true);
      setError(null);

      try {
        const resp = await call(Request.create({ switchProfile: { index } }));

        if (resp) {
          if (resp.switchProfile?.success) {
            await loadProfiles();
          } else if (resp.error) {
            setError(resp.error.message);
          } else {
            setError("Failed to switch profile");
          }
        }
      } catch (err) {
        console.error("Failed to switch profile:", err);
        setError(
          `Failed to switch profile: ${err instanceof Error ? err.message : "Unknown error"}`,
        );
      } finally {
        setIsLoading(false);
      }
    },
    [ready, call, loadProfiles],
  );

  const unpairProfile = useCallback(
    async (index: number) => {
      if (!ready) return;

      setIsLoading(true);
      setError(null);

      try {
        const resp = await call(Request.create({ unpairProfile: { index } }));

        if (resp) {
          if (resp.unpairProfile?.success) {
            await loadProfiles();
          } else if (resp.error) {
            setError(resp.error.message);
          } else {
            setError("Failed to unpair profile");
          }
        }
      } catch (err) {
        console.error("Failed to unpair profile:", err);
        setError(
          `Failed to unpair profile: ${err instanceof Error ? err.message : "Unknown error"}`,
        );
      } finally {
        setIsLoading(false);
      }
    },
    [ready, call, loadProfiles],
  );

  const setProfileName = useCallback(
    async (index: number, name: string) => {
      if (!ready) return;

      setIsLoading(true);
      setError(null);

      try {
        const resp = await call(
          Request.create({ setProfileName: { index, name } }),
        );

        if (resp) {
          if (resp.setProfileName?.success) {
            await loadProfiles();
          } else if (resp.error) {
            setError(resp.error.message);
          } else {
            setError("Failed to set profile name");
          }
        }
      } catch (err) {
        console.error("Failed to set profile name:", err);
        setError(
          `Failed to set profile name: ${err instanceof Error ? err.message : "Unknown error"}`,
        );
      } finally {
        setIsLoading(false);
      }
    },
    [ready, call, loadProfiles],
  );

  const getOutputPriority = useCallback(async () => {
    if (!ready) {
      setError("Not connected to device or subsystem not found");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const resp = await call(Request.create({ getOutputPriority: {} }));

      if (resp) {
        if (resp.getOutputPriority) {
          setOutputPriorityState(resp.getOutputPriority.priority);
        } else if (resp.error) {
          setError(resp.error.message);
        }
      }
    } catch (err) {
      console.error("Failed to get output priority:", err);
      setError(
        `Failed to get output priority: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
    } finally {
      setIsLoading(false);
    }
  }, [ready, call]);

  const setOutputPriority = useCallback(
    async (priority: OutputPriority) => {
      if (!ready) return;

      setIsLoading(true);
      setError(null);

      try {
        const resp = await call(
          Request.create({ setOutputPriority: { priority } }),
        );

        if (resp) {
          if (resp.setOutputPriority?.success) {
            await getOutputPriority();
          } else if (resp.error) {
            setError(resp.error.message);
          } else {
            setError("Failed to set output priority");
          }
        }
      } catch (err) {
        console.error("Failed to set output priority:", err);
        setError(
          `Failed to set output priority: ${err instanceof Error ? err.message : "Unknown error"}`,
        );
      } finally {
        setIsLoading(false);
      }
    },
    [ready, call, getOutputPriority],
  );

  // Load profiles and output priority when connection or subsystem changes
  useEffect(() => {
    if (ready) {
      loadProfiles();
      getOutputPriority();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  return {
    isAvailable: subsystem !== null,
    profiles,
    maxProfiles,
    isLoading,
    error,
    outputPriority,
    loadProfiles,
    switchProfile,
    unpairProfile,
    setProfileName,
    getOutputPriority,
    setOutputPriority,
  };
}
