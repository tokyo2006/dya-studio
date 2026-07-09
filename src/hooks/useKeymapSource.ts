/**
 * useKeymapSource — the single place that decides HOW keymap/behavior/layout
 * data is loaded from a connected keyboard.
 *
 * If the keyboard exposes the `cormoran__fast_keymap` custom Studio RPC
 * subsystem (cormoran/zmk-feature-fast-keymap), we load through that fast,
 * fingerprint-cached path; otherwise we fall back to the official
 * `zmk.keymap` / `zmk.behaviors` protocol. Either way the data is returned in
 * the OFFICIAL shapes (`Keymap`, `PhysicalLayouts`, `BehaviorDefinition`), so
 * every consumer — the keymap editor, the combo/macro pages, the physical
 * layout view, the layer-name selects — sees one uniform result and never has
 * to care which path served it.
 *
 * Only *loading* is abstracted here. Mutating the keymap (set binding, add
 * layer, rename, save, …) always goes through the official protocol: the fast
 * subsystem is read-only, and the official keymap subsystem is what owns the
 * edit/save state. See {@link useKeymap}.
 */
import { useCallback, useContext, useEffect, useMemo } from "react";
import {
  ZMKAppContext,
  isUnlockRequiredError,
  useCustomSubsystem,
} from "@cormoran/zmk-studio-react-hook";
import { call_rpc } from "@zmkfirmware/zmk-studio-ts-client";
import type {
  Keymap,
  PhysicalLayouts,
  PhysicalLayout,
  KeyPhysicalAttrs,
} from "@zmkfirmware/zmk-studio-ts-client/keymap";
import type { BehaviorBindingParametersSet } from "@zmkfirmware/zmk-studio-ts-client/behaviors";
import { ErrorConditions } from "@zmkfirmware/zmk-studio-ts-client/meta";
import {
  Request,
  Response,
  LayoutDetailsMode,
} from "../proto/cormoran/fast_keymap/fast_keymap";
import {
  loadFastKeymap,
  loadPhysicalLayoutGeometry,
  type FastKeymapModel,
} from "../lib/fastKeymap";
import {
  assertOfficialKeymapRpcAllowed,
  setFastKeymapAvailable,
} from "../lib/officialKeymapRpcGuard";
import type { TranslationParams } from "../i18n/translations";

/** Identifier the fast-keymap module registers on the device. */
const FAST_KEYMAP_SUBSYSTEM = "cormoran__fast_keymap";

/** ts-proto codec for the fast_keymap Request/Response wire messages. */
const FAST_KEYMAP_CODEC = {
  encode: (request: Request) => Request.encode(request).finish(),
  decode: (payload: Uint8Array) => Response.decode(payload),
};

/**
 * Behavior definition loaded from the keyboard. Shared shape regardless of
 * which protocol served it (the fast path maps `local_id`/`display_name`/
 * `metadata` onto these same fields).
 */
export interface BehaviorDefinition {
  id: number;
  displayName: string;
  metadata: BehaviorBindingParametersSet[];
}

/** Which protocol served a given load. Purely informational (drives the
 * "fast load" indicator / diagnostics). */
export type KeymapSource = "fast" | "official";

/** The uniform result of a full keymap-data load, in official shapes. */
export interface KeymapData {
  physicalLayouts: PhysicalLayouts;
  keymap: Keymap;
  behaviors: Map<number, BehaviorDefinition>;
  source: KeymapSource;
}

/**
 * Phases of a full keymap-data load. Behaviors are loaded one at a time on the
 * official path, so that phase carries a determinate count; the fast path
 * loads everything in a single cached round-trip and only reports coarse
 * phases.
 */
export type KeymapLoadPhase = "layouts" | "keymap" | "behaviors" | "finalizing";

/**
 * Progress of the current keymap load, or `null` when idle. Used to show the
 * user what is loading and — for the behaviors phase — how far along it is.
 */
export interface KeymapLoadProgress {
  phase: KeymapLoadPhase;
  /** Items loaded so far (behaviors phase only). */
  current?: number;
  /** Total items to load (behaviors phase only). */
  total?: number;
}

/** Callback invoked as a load advances through its phases. */
export type KeymapLoadProgressCallback = (progress: KeymapLoadProgress) => void;

/**
 * Thrown when a load fails because the keyboard is locked. Callers should
 * detect it with {@link isKeymapUnlockRequired} (which also recognizes the
 * transport-level unlock error the fast path / official mutations throw).
 */
export class KeymapUnlockRequiredError extends Error {
  constructor() {
    super("Keyboard needs to be unlocked");
    this.name = "KeymapUnlockRequiredError";
  }
}

/** True when `err` means "the keyboard is locked" — from either protocol. */
export function isKeymapUnlockRequired(err: unknown): boolean {
  return err instanceof KeymapUnlockRequiredError || isUnlockRequiredError(err);
}

/**
 * Translate a {@link KeymapLoadProgress} into a human-readable label. Kept
 * here so every consumer of the keymap data (keymap tab, combo tab, …) shows
 * consistent wording.
 */
export function getKeymapLoadingLabel(
  t: (key: string, params?: TranslationParams) => string,
  progress: KeymapLoadProgress | null,
): string {
  switch (progress?.phase) {
    case "layouts":
      return t("Loading physical layouts...");
    case "keymap":
      return t("Loading keymap...");
    case "behaviors":
      return t("Loading behaviors...");
    case "finalizing":
      return t("Finalizing...");
    default:
      return t("Loading keymap data...");
  }
}

export interface UseKeymapSourceReturn {
  /** True when the fast-keymap subsystem was found on the connected device. */
  isFastAvailable: boolean;
  /** Which protocol the next load will use. */
  source: KeymapSource;
  /** Load layouts + keymap + behaviors as one uniform {@link KeymapData}. */
  loadKeymapData: (
    onProgress?: KeymapLoadProgressCallback,
  ) => Promise<KeymapData>;
  /** Load just the physical layouts (with full geometry for every layout). */
  loadPhysicalLayouts: () => Promise<PhysicalLayouts>;
  /** Load just the layer names, in keymap order. */
  loadLayerNames: () => Promise<string[]>;
}

// -- fast-path helpers ------------------------------------------------------

/** Runs one fast_keymap RPC, throwing on a null/error response — mirrors the
 * vendored loader's internal `callChecked`, for the lean subset loaders that
 * don't go through the full `loadFastKeymap`. */
async function fastCallChecked(
  call: (request: Request) => Promise<Response | null>,
  request: Request,
): Promise<Response> {
  const response = await call(request);
  if (!response) {
    throw new Error("fast_keymap RPC: device sent no response payload");
  }
  if (response.error) {
    throw new Error(`fast_keymap RPC error: code ${response.error.code}`);
  }
  return response;
}

function toKeyPhysicalAttrs(keys: KeyPhysicalAttrs[]): KeyPhysicalAttrs[] {
  return keys.map((k) => ({
    width: k.width,
    height: k.height,
    x: k.x,
    y: k.y,
    r: k.r,
    rx: k.rx,
    ry: k.ry,
  }));
}

/** Maps a loaded {@link FastKeymapModel} onto the official {@link KeymapData}
 * shapes. `fillGeometry` fetches any non-active layout whose geometry the fast
 * load left lazy, so the resulting PhysicalLayouts is complete (the editor
 * lets the user switch to any layout, which needs its key geometry). */
async function mapFastModel(
  model: FastKeymapModel,
  call: (request: Request) => Promise<Response | null>,
  deviceKey: string | undefined,
): Promise<KeymapData> {
  const keymap: Keymap = {
    layers: model.layers.map((layer) => ({
      id: layer.id,
      name: layer.name,
      bindings: layer.bindings.map((b) => ({
        behaviorId: b.behaviorId,
        param1: b.param1,
        param2: b.param2,
      })),
    })),
    availableLayers: model.availableLayers,
    maxLayerNameLength: model.maxLayerNameLength,
  };

  // Fill geometry for every layout the fast load left lazy (it only fetches
  // the active layout's keys up front). Cached, so this is usually free.
  const layouts: PhysicalLayout[] = [];
  for (let i = 0; i < model.layouts.length; i++) {
    const layout = model.layouts[i];
    let keys = layout.keys;
    if (keys === undefined) {
      keys = await loadPhysicalLayoutGeometry(call, i, { deviceKey });
    }
    layouts.push({ name: layout.name, keys: toKeyPhysicalAttrs(keys) });
  }

  const physicalLayouts: PhysicalLayouts = {
    activeLayoutIndex: model.activeLayoutIndex,
    layouts,
  };

  const behaviors = new Map<number, BehaviorDefinition>();
  for (const b of model.behaviors) {
    behaviors.set(b.localId, {
      id: b.localId,
      displayName: b.displayName,
      metadata: b.metadata,
    });
  }

  return { physicalLayouts, keymap, behaviors, source: "fast" };
}

/**
 * Hook exposing the fast-or-official keymap-data loaders. Uses the atomic
 * `connection` + `customSubsystems` state (both set together on connect), so
 * `isFastAvailable` is already reliable the moment a connection exists — no
 * "resolving" race.
 */
export function useKeymapSource(): UseKeymapSourceReturn {
  const zmkApp = useContext(ZMKAppContext);
  const connection = useMemo(
    () => zmkApp?.state.connection ?? null,
    [zmkApp?.state.connection],
  );
  const deviceKey = zmkApp?.state.deviceInfo?.name;

  const { subsystem, call } = useCustomSubsystem(
    FAST_KEYMAP_SUBSYSTEM,
    FAST_KEYMAP_CODEC,
  );
  const isFastAvailable = subsystem !== null;
  const source: KeymapSource = isFastAvailable ? "fast" : "official";

  // Keep the app-wide official-RPC guard in sync: once fast-keymap is
  // available, any official keymap/behaviors *read* becomes a hard error
  // (see officialKeymapRpcGuard) instead of a silent slow round-trip.
  useEffect(() => {
    setFastKeymapAvailable(isFastAvailable);
  }, [isFastAvailable]);

  // -- official-path RPC helper (throws on unlock, like the fast path) ------
  const officialRpc = useCallback(
    async <T>(
      request: Parameters<typeof call_rpc>[1],
      extractor: (
        response: Awaited<ReturnType<typeof call_rpc>>,
      ) => T | undefined,
    ): Promise<T | undefined> => {
      if (!connection) {
        throw new Error("Not connected to keyboard");
      }
      assertOfficialKeymapRpcAllowed(request);
      const response = await call_rpc(connection, request);
      if (response.meta?.simpleError !== undefined) {
        if (response.meta.simpleError === ErrorConditions.UNLOCK_REQUIRED) {
          throw new KeymapUnlockRequiredError();
        }
        throw new Error(`RPC error: ${response.meta.simpleError}`);
      }
      return extractor(response);
    },
    [connection],
  );

  const loadKeymapData = useCallback(
    async (onProgress?: KeymapLoadProgressCallback): Promise<KeymapData> => {
      if (isFastAvailable) {
        onProgress?.({ phase: "keymap" });
        const model = await loadFastKeymap(call, { deviceKey });
        onProgress?.({ phase: "finalizing" });
        return mapFastModel(model, call, deviceKey);
      }

      // -- official path ----------------------------------------------------
      onProgress?.({ phase: "layouts" });
      const physicalLayouts = (await officialRpc(
        { keymap: { getPhysicalLayouts: true } },
        (r) => r.keymap?.getPhysicalLayouts,
      )) ?? { activeLayoutIndex: 0, layouts: [] };

      onProgress?.({ phase: "keymap" });
      const keymap = (await officialRpc(
        { keymap: { getKeymap: true } },
        (r) => r.keymap?.getKeymap,
      )) ?? { layers: [], availableLayers: 0, maxLayerNameLength: 0 };

      onProgress?.({ phase: "behaviors", current: 0, total: 0 });
      const behaviors = new Map<number, BehaviorDefinition>();
      const behaviorIds =
        (await officialRpc(
          { behaviors: { listAllBehaviors: true } },
          (r) => r.behaviors?.listAllBehaviors?.behaviors,
        )) ?? [];
      const total = behaviorIds.length;
      onProgress?.({ phase: "behaviors", current: 0, total });
      let current = 0;
      for (const behaviorId of behaviorIds) {
        const details = await officialRpc(
          { behaviors: { getBehaviorDetails: { behaviorId } } },
          (r) => r.behaviors?.getBehaviorDetails,
        );
        if (details) {
          behaviors.set(behaviorId, {
            id: details.id,
            displayName: details.displayName,
            metadata: details.metadata,
          });
        }
        current += 1;
        onProgress?.({ phase: "behaviors", current, total });
      }

      return { physicalLayouts, keymap, behaviors, source: "official" };
    },
    [isFastAvailable, call, deviceKey, officialRpc],
  );

  const loadPhysicalLayouts =
    useCallback(async (): Promise<PhysicalLayouts> => {
      if (isFastAvailable) {
        // One round-trip with every layout's geometry inline (ALL mode).
        const response = await fastCallChecked(call, {
          getPhysicalLayouts: { details: LayoutDetailsMode.LAYOUT_DETAILS_ALL },
        });
        const data = response.getPhysicalLayouts;
        return {
          activeLayoutIndex: data?.activeLayoutIndex ?? 0,
          layouts: (data?.layouts ?? []).map((l) => ({
            name: l.name,
            keys: toKeyPhysicalAttrs(l.keys),
          })),
        };
      }
      return (
        (await officialRpc(
          { keymap: { getPhysicalLayouts: true } },
          (r) => r.keymap?.getPhysicalLayouts,
        )) ?? { activeLayoutIndex: 0, layouts: [] }
      );
    }, [isFastAvailable, call, officialRpc]);

  const loadLayerNames = useCallback(async (): Promise<string[]> => {
    if (isFastAvailable) {
      // Layer names come free from the snapshot's per-layer fingerprints.
      const response = await fastCallChecked(call, { getSnapshot: true });
      return (response.snapshot?.layers ?? []).map((l) => l.name);
    }
    const keymap = await officialRpc(
      { keymap: { getKeymap: true } },
      (r) => r.keymap?.getKeymap,
    );
    return keymap?.layers.map((layer) => layer.name) ?? [];
  }, [isFastAvailable, call, officialRpc]);

  return {
    isFastAvailable,
    source,
    loadKeymapData,
    loadPhysicalLayouts,
    loadLayerNames,
  };
}
