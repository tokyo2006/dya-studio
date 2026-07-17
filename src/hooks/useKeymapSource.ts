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
import { useCallback, useContext, useEffect, useMemo, useRef } from "react";
import {
  ZMKAppContext,
  isUnlockRequiredError,
} from "@cormoran/zmk-studio-react-hook";
import { useCustomSubsystem } from "./useCustomSubsystem";
import type { call_rpc } from "@zmkfirmware/zmk-studio-ts-client";
import { loggedCallRpc } from "../lib/rpcLogging";
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
export const FAST_KEYMAP_SUBSYSTEM_IDENTIFIER = "cormoran__fast_keymap";
const FAST_KEYMAP_SUBSYSTEM = FAST_KEYMAP_SUBSYSTEM_IDENTIFIER;

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
  /** Ids of layers whose bindings are still loading in the background (fast
   * incremental load): they come back with empty `bindings` in `keymap` and
   * are filled in via the `onLayersLoaded` callback. Empty for the official
   * path and for single-layer / warm-cache fast loads. */
  pendingLayerIds: number[];
  /** True when `behaviors` is still loading in the background (fast incremental
   * load): it comes back empty here and is filled in via the
   * `onBehaviorsLoaded` callback. False for the official path and for
   * warm-cache fast loads (where behaviors were served without a round-trip). */
  behaviorsDeferred: boolean;
}

/** Called when the background load of the deferred layers completes, with the
 * full set of layers (real bindings). Only fires when a fast incremental load
 * left layers pending. */
export type OnLayersLoadedCallback = (layers: Keymap["layers"]) => void;

/** Called when the background load of the deferred behaviors completes, with
 * the full behaviors map. Only fires when a fast incremental load deferred
 * behaviors (see {@link KeymapData.behaviorsDeferred}). */
export type OnBehaviorsLoadedCallback = (
  behaviors: Map<number, BehaviorDefinition>,
) => void;

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
  /** Load layouts + keymap + behaviors as one uniform {@link KeymapData}.
   *
   * On the fast path this returns as soon as the layout + FIRST layer are ready
   * so the keymap preview can paint immediately. Two things load in the
   * background afterwards: the remaining layers (empty placeholders listed in
   * {@link KeymapData.pendingLayerIds}, filled via `onLayersLoaded`) and the
   * behaviors (deferred unless a warm cache served them for free — see
   * {@link KeymapData.behaviorsDeferred} — filled via `onBehaviorsLoaded`).
   * While behaviors are deferred, bindings render with a placeholder label. On
   * the official path everything is loaded before returning and neither
   * background callback fires. */
  loadKeymapData: (
    onProgress?: KeymapLoadProgressCallback,
    onLayersLoaded?: OnLayersLoadedCallback,
    onBehaviorsLoaded?: OnBehaviorsLoadedCallback,
  ) => Promise<KeymapData>;
  /** Load just the physical layouts (with full geometry for every layout). */
  loadPhysicalLayouts: () => Promise<PhysicalLayouts>;
  /** Load just the layer names, in keymap order. */
  loadLayerNames: () => Promise<string[]>;
  /** Fetch one physical layout's key geometry on demand. On the fast path,
   * non-active layout geometry is loaded lazily (not at initial load) — call
   * this when switching to a layout whose `keys` are still empty. */
  loadLayoutGeometry: (index: number) => Promise<KeyPhysicalAttrs[]>;
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
 * shapes. Purely in-memory — no RPCs.
 *
 * The fast load only fetches the ACTIVE layout's key geometry; other layouts
 * come back with `keys === undefined` and are mapped to an empty `keys` array
 * here. We deliberately DON'T fetch them up front: the editor only renders the
 * active layout, so pulling every other layout's geometry over BLE at load
 * time is exactly what made "Finalizing" take seconds. A non-active layout's
 * geometry is fetched lazily via {@link UseKeymapSourceReturn.loadLayoutGeometry}
 * only when the user switches to it (see useKeymap.setActiveLayout). */
/** Maps the fast loader's behavior list onto the official
 * `Map<local_id, BehaviorDefinition>` shape every consumer expects. Shared by
 * {@link mapFastModel} and the background `onBehaviorsLoaded` delivery. */
function mapFastBehaviors(
  behaviors: FastKeymapModel["behaviors"],
): Map<number, BehaviorDefinition> {
  const map = new Map<number, BehaviorDefinition>();
  for (const b of behaviors) {
    map.set(b.localId, {
      id: b.localId,
      displayName: b.displayName,
      metadata: b.metadata,
    });
  }
  return map;
}

function mapFastModel(model: FastKeymapModel): KeymapData {
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

  const layouts: PhysicalLayout[] = model.layouts.map((layout) => ({
    name: layout.name,
    keys: toKeyPhysicalAttrs(layout.keys ?? []),
  }));

  const physicalLayouts: PhysicalLayouts = {
    activeLayoutIndex: model.activeLayoutIndex,
    layouts,
  };

  return {
    physicalLayouts,
    keymap,
    behaviors: mapFastBehaviors(model.behaviors),
    source: "fast",
    pendingLayerIds: model.pendingLayerIds,
    behaviorsDeferred: model.behaviorsDeferred,
  };
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

  // Per-layout fingerprints from the last fast load, indexed by layout index.
  // Lets loadLayoutGeometry hit the fp-keyed geometry cache without a
  // round-trip when a cached entry exists (mapFastModel discards the fps).
  const layoutFpsRef = useRef<number[]>([]);

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
      const response = await loggedCallRpc(connection, request);
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
    async (
      onProgress?: KeymapLoadProgressCallback,
      onLayersLoaded?: OnLayersLoadedCallback,
      onBehaviorsLoaded?: OnBehaviorsLoadedCallback,
    ): Promise<KeymapData> => {
      if (isFastAvailable) {
        onProgress?.({ phase: "keymap" });
        // Phase 1: fetch only the layout + FIRST layer so the keymap preview can
        // paint as fast as possible. Behaviors are deferred (unless a warm cache
        // serves them for free) and other uncached layers come back as empty
        // placeholders (model.pendingLayerIds / model.behaviorsDeferred).
        const model = await loadFastKeymap(call, {
          deviceKey,
          firstLayerOnly: true,
          deferBehaviors: true,
        });
        // Remember each layout's fingerprint so a later lazy geometry load can
        // hit the fp-keyed cache (mapFastModel drops the fps).
        layoutFpsRef.current = model.layouts.map((l) => l.fp);
        const data = mapFastModel(model);

        // Phase 2 (background): resolve whatever phase 1 deferred — the behavior
        // labels and/or the remaining layers. layouts and the first layer are
        // cache-warm now, so this pays only for the behaviors round-trip(s) and
        // one batched get_layers. Behaviors are handed back first (onBehaviorsLoaded,
        // mid-load) so labels appear before the remaining layers arrive.
        const needsBackground =
          data.pendingLayerIds.length > 0 || data.behaviorsDeferred;
        if (needsBackground && (onLayersLoaded || onBehaviorsLoaded)) {
          void loadFastKeymap(call, {
            deviceKey,
            onBehaviorsLoaded: onBehaviorsLoaded
              ? (behaviors) => onBehaviorsLoaded(mapFastBehaviors(behaviors))
              : undefined,
          })
            .then((full) => onLayersLoaded?.(mapFastModel(full).keymap.layers))
            .catch((err) => {
              console.error("Background keymap load failed:", err);
            });
        }

        return data;
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

      return {
        physicalLayouts,
        keymap,
        behaviors,
        source: "official",
        pendingLayerIds: [],
        behaviorsDeferred: false,
      };
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

  const loadLayoutGeometry = useCallback(
    async (index: number): Promise<KeyPhysicalAttrs[]> => {
      if (isFastAvailable) {
        const keys = await loadPhysicalLayoutGeometry(call, index, {
          deviceKey,
          fp: layoutFpsRef.current[index],
        });
        return toKeyPhysicalAttrs(keys);
      }
      // Official protocol already returns every layout's geometry with the
      // keymap load, so this is only a fallback (re-fetch the full set).
      const layouts = await officialRpc(
        { keymap: { getPhysicalLayouts: true } },
        (r) => r.keymap?.getPhysicalLayouts,
      );
      return layouts?.layouts[index]?.keys ?? [];
    },
    [isFastAvailable, call, deviceKey, officialRpc],
  );

  return {
    isFastAvailable,
    source,
    loadKeymapData,
    loadPhysicalLayouts,
    loadLayerNames,
    loadLayoutGeometry,
  };
}
