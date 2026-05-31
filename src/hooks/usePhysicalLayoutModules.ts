/**
 * usePhysicalLayoutModules Hook
 *
 * Loads non-key physical module geometry from the physical layouts custom
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
  type GetPhysicalLayoutResponse,
  type PhysicalDevice,
  type RectPhysicalAttrs,
  type RotaryEncoder,
} from "../proto/zmk/physical_layouts/physical_layouts";

export const PHYSICAL_LAYOUTS_IDENTIFIER = "cormoran__physical_layouts";
export const LEGACY_PHYSICAL_LAYOUTS_IDENTIFIER = "zmk__physical_layouts";
export const PHYSICAL_LAYOUTS_IDENTIFIERS = [
  PHYSICAL_LAYOUTS_IDENTIFIER,
  LEGACY_PHYSICAL_LAYOUTS_IDENTIFIER,
] as const;

export type PhysicalLayoutModuleKind =
  | "trackball"
  | "rotary-encoder"
  | "touch-pad"
  | "custom-module";

export interface PhysicalLayoutModulePresentation {
  kind: PhysicalLayoutModuleKind;
  identifier: string;
  displayName: string;
  label: string;
  enabled: boolean;
  attrs: RectPhysicalAttrs;
  links: PhysicalDevice["links"];
}

export interface UsePhysicalLayoutModulesReturn {
  isAvailable: boolean;
  modules: PhysicalLayoutModulePresentation[];
  isLoading: boolean;
  error: string | null;
  loadModules: () => Promise<void>;
}

export function physicalDevicePresentations(
  device: PhysicalDevice,
): PhysicalLayoutModulePresentation[] {
  if (device.trackball?.attrs) {
    const { x, y, size } = device.trackball.attrs;
    return [
      {
        kind: "trackball",
        identifier: device.identifier,
        displayName: device.displayName || device.identifier || "Trackball",
        label: "Trackball",
        enabled: device.enabled,
        attrs: { x, y, width: size, height: size, r: 0, rx: 0, ry: 0 },
        links: device.links,
      },
    ];
  }

  if (device.touchPad?.attrs) {
    return [
      {
        kind: "touch-pad",
        identifier: device.identifier,
        displayName: device.displayName || device.identifier || "Touch Pad",
        label: "Touch Pad",
        enabled: device.enabled,
        attrs: device.touchPad.attrs,
        links: device.links,
      },
    ];
  }

  if (device.customModule?.attrs) {
    return [
      {
        kind: "custom-module",
        identifier: device.identifier,
        displayName:
          device.displayName || device.identifier || "Physical Module",
        label: device.customModule.type || "Module",
        enabled: device.enabled,
        attrs: device.customModule.attrs,
        links: device.links,
      },
    ];
  }

  return [];
}

export function rotaryEncoderPresentation(
  encoder: RotaryEncoder,
  index: number,
): PhysicalLayoutModulePresentation[] {
  if (!encoder.attrs) return [];

  const { x, y, size } = encoder.attrs;
  return [
    {
      kind: "rotary-encoder",
      identifier: `rotary-encoder:${index}`,
      displayName: `Rotary Encoder ${index + 1}`,
      label: "Encoder",
      enabled: encoder.enabled,
      attrs: { x, y, width: size, height: size, r: 0, rx: 0, ry: 0 },
      links: [],
    },
  ];
}

function toPresentations(
  layout: GetPhysicalLayoutResponse,
): PhysicalLayoutModulePresentation[] {
  return [
    ...layout.devices.flatMap(physicalDevicePresentations),
    ...layout.rotaryEncoders.flatMap(rotaryEncoderPresentation),
  ];
}

export function usePhysicalLayoutModules(): UsePhysicalLayoutModulesReturn {
  const zmkApp = useContext(ZMKAppContext);
  const [modules, setModules] = useState<PhysicalLayoutModulePresentation[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subsystem = useMemo(() => {
    for (const identifier of PHYSICAL_LAYOUTS_IDENTIFIERS) {
      const found = zmkApp?.findSubsystem(identifier);
      if (found) return found;
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zmkApp?.state.customSubsystems]);
  const subsystemIndex = subsystem?.index;
  const connection = zmkApp?.state.connection;

  const loadModules = useCallback(async () => {
    if (!connection || subsystemIndex === undefined) {
      setModules([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const service = new ZMKCustomSubsystem(connection, subsystemIndex);
      const request = Request.create({ getPhysicalLayout: {} });
      const responsePayload = await service.callRPC(
        Request.encode(request).finish(),
      );

      if (!responsePayload) {
        setModules([]);
        return;
      }

      const response = Response.decode(responsePayload);
      if (response.error) {
        setError(response.error.message);
        setModules([]);
        return;
      }

      setModules(
        response.physicalLayout ? toPresentations(response.physicalLayout) : [],
      );
    } catch (err) {
      console.error("Failed to load physical layout modules:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load physical layout modules",
      );
      setModules([]);
    } finally {
      setIsLoading(false);
    }
  }, [connection, subsystemIndex]);

  useEffect(() => {
    if (connection && subsystemIndex !== undefined) {
      loadModules();
    } else {
      setModules([]);
      setError(null);
    }
  }, [connection, subsystemIndex, loadModules]);

  return {
    isAvailable: subsystemIndex !== undefined,
    modules,
    isLoading,
    error,
    loadModules,
  };
}
