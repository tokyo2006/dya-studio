// Fast-load client for the cormoran__fast_keymap custom Studio RPC
// subsystem -- see DESIGN.md SS9 phase C. Loads the behavior list and the
// effective keymap using the three "send less" cache levers the firmware
// exposes (SS4): a `get_snapshot` fingerprint round-trip first, then only
// fetching whatever changed since the last load (cached in localStorage,
// keyed by fingerprint) -- skipping behavior metadata that matches a
// bundled standard definition (standardBehaviors.ts) and preferring the
// default+edited-diff path over a whole-layer fetch.

import {
  BehaviorDetailsMode,
  ErrorCode,
  LayoutDetailsMode,
  type BehaviorBindingParametersSet,
  type BehaviorDetails,
  type BehaviorSummary,
  type EditedBinding,
  type KeyPhysicalAttrs,
  type Request,
  type Response,
  type Snapshot,
} from "../../proto/cormoran/fast_keymap/fast_keymap";
import { FK_DEFINITION_VERSION, bundledByDefFp } from "./standardBehaviors";

/** Miss-repair batch fetch chunk size (DESIGN.md SS5): `GetBehaviorsRequest.
 * behavior_ids` must fit `CONFIG_ZMK_STUDIO_RPC_RX_BUF_SIZE=128`, so the
 * firmware bounds it to `max_count:32` -- chunk any larger miss set into
 * multiple `get_behaviors` round-trips of at most this many ids each. */
const GET_BEHAVIORS_CHUNK_SIZE = 32;

/** Batch size for `get_layers` (DESIGN.md SS7): `GetLayersRequest.layer_ids`
 * is bounded `max_count:32` on the firmware for the same RX-buffer reason as
 * `get_behaviors`, so chunk any larger set of layers to fetch. */
const GET_LAYERS_CHUNK_SIZE = 32;

/** Matches `useCustomSubsystem(...).call` -- see web/src/App.tsx. */
export type FastKeymapCall = (request: Request) => Promise<Response | null>;

export interface FastKeymapBinding {
  /** The behavior's local_id, or -1 when the device reports no bound
   * behavior at this position (BehaviorBinding.behavior_id's official
   * "missing binding" convention -- see DESIGN.md SS7). */
  behaviorId: number;
  param1: number;
  param2: number;
}

export type BehaviorResolvedFrom = "bundle" | "device" | "cache";

export interface FastKeymapBehavior {
  localId: number;
  alias: string;
  displayName: string;
  /** Content-addressed identity + validator (DESIGN.md SS4/SS5) -- replaces
   * the old per-behavior `metadataFp`. Keys both the bundle and the
   * per-device cache. */
  defFp: number;
  metadata: BehaviorBindingParametersSet[];
  /** How this behavior's alias/display_name/metadata was obtained --
   * "bundle" and "cache" mean `get_behaviors` was NOT called for it.
   * Purely informational (drives the "fast load" indicator in the UI).
   * There is no separate wire `standard` flag any more -- a behavior is
   * effectively "standard, and resolved without a device round-trip" iff
   * `resolvedFrom === "bundle"`. */
  resolvedFrom: BehaviorResolvedFrom;
}

export interface FastKeymapLayer {
  id: number;
  name: string;
  bindingCount: number;
  editedCount: number;
  bindings: FastKeymapBinding[];
  /** True when this layer's whole effective binding list came straight
   * from the localStorage cache (its `fp` matched) -- zero RPCs for this
   * layer. */
  loadedFromCache: boolean;
}

export interface FastKeymapLayoutKey {
  width: number;
  height: number;
  x: number;
  y: number;
  r: number;
  rx: number;
  ry: number;
}

export interface FastKeymapLayout {
  name: string;
  /** Device-opaque per-layout fingerprint (DESIGN.md SS4/SS6) -- the web
   * never recomputes this, it only caches and compares the device-reported
   * value (unlike a behavior's def_fp). */
  fp: number;
  /** Undefined until this layout's geometry has actually been fetched.
   * loadFastKeymap() always resolves the *active* layout's keys (from cache
   * or a `get_physical_layout` fetch); other layouts' keys stay undefined
   * until a consumer calls loadPhysicalLayoutGeometry() for them. */
  keys?: FastKeymapLayoutKey[];
}

export interface FastKeymapLoadStats {
  /** `behaviors_fp` matched the cache: `list_behaviors` was skipped
   * entirely (and so was every `get_behaviors` round-trip). */
  behaviorsFromCache: boolean;
  /** Behaviors resolved from the bundled standard-definitions table
   * (`def_fp` matched a bundle entry) without a device round-trip. Only
   * meaningful when `behaviorsFromCache` is false. */
  behaviorsBundled: number;
  /** Behaviors resolved from a stale per-device cache entry whose `def_fp`
   * still matched (i.e. `behaviors_fp` changed, but this particular
   * behavior didn't) -- no device round-trip needed for these either. Only
   * meaningful when `behaviorsFromCache` is false. */
  behaviorsCached: number;
  /** Behaviors resolved from the device -- either inlined in the
   * `list_behaviors` response (`CUSTOM`/`ALL` mode) or fetched via one or
   * more `get_behaviors` batch round-trips (a `def_fp` miss). */
  behaviorsFetched: number;
  /** Layers whose whole effective binding list came from the cache (`fp`
   * match, zero RPCs). */
  layersFromCache: number;
  /** Layers whose whole effective bindings were fetched (no usable default
   * cache to diff against) -- pulled together in one batched `get_layers`
   * round-trip on a cold load; see loadLayers(). */
  layersFetchedFull: number;
  /** Layers assembled from a (possibly cached) default layer plus a
   * `get_edited_layer` diff. */
  layersFetchedDiff: number;
  /** `physical_layout_fp` matched the cache: `get_physical_layouts` was
   * skipped entirely. */
  physicalLayoutsFromCache: boolean;
}

export interface FastKeymapModel {
  definitionVersion: number;
  behaviors: FastKeymapBehavior[];
  layers: FastKeymapLayer[];
  layouts: FastKeymapLayout[];
  activeLayoutIndex: number;
  /** Number of layers the device can hold (from the snapshot) -- gates "add
   * layer" / "restore layer" in editors. NOTE: local addition to the vendored
   * upstream model, sourced straight from `Snapshot.available_layers`. */
  availableLayers: number;
  /** Max layer-name length the device accepts (from the snapshot) -- caps the
   * rename input in editors. NOTE: local addition to the vendored upstream
   * model, sourced straight from `Snapshot.max_layer_name_length`. */
  maxLayerNameLength: number;
  /** Ids of layers whose bindings were NOT fetched this load (empty `bindings`
   * placeholders), because `firstLayerOnly` deferred them. Empty on a normal
   * (full) load. NOTE: local addition to the vendored upstream model, used to
   * drive incremental "show the first layer, load the rest in the background"
   * loading. */
  pendingLayerIds: number[];
  /** True when `deferBehaviors` skipped the behavior load this round because it
   * couldn't be served from the whole-set cache for free -- `behaviors` came
   * back empty and must be filled by a later (background) full load. False when
   * behaviors are populated (either not deferred, or a warm-cache hit served
   * them without an RPC). NOTE: local addition to the vendored upstream model,
   * used to drive "show the keymap first, resolve behavior labels in the
   * background" loading. */
  behaviorsDeferred: boolean;
  stats: FastKeymapLoadStats;
}

export interface LoadFastKeymapOptions {
  /** Stable cache-key prefix for this device -- pass the connected device
   * name when available (DESIGN.md SS9: "cache in localStorage keyed by a
   * stable device key"). Defaults to a fixed key, which is fine for a
   * single-device workflow but will share a cache across different
   * physical devices. */
  deviceKey?: string;
  /** Defaults to `window.localStorage`. Overridable for tests / for
   * environments without a global localStorage. */
  storage?: Storage;
  /** Whether to ask the device to inline each behavior's `alias` (the
   * `&<alias>` token) in `list_behaviors`/`get_behaviors` (DESIGN.md SS5).
   * Defaults to `true` so the returned model can render/export tokens. Set
   * `false` to save those bytes on a cold load when the consumer never shows
   * a behavior's alias -- standard behaviors still get their alias from the
   * bundle, but device-only (custom) behaviors will have an empty `alias`. */
  includeAliases?: boolean;
  /** Whether to ask the device to inline each behavior's human `display_name`
   * (DESIGN.md SS5). Defaults to `true` (opt-out): set `false` to save those
   * bytes on a cold load when the consumer never shows a behavior's name.
   * Standard behaviors still get their name from the bundle; device-only
   * (custom) behaviors will have an empty `displayName`. */
  includeDisplayNames?: boolean;
  /** When `true`, only the FIRST layer's bindings are fetched (plus any layer
   * already in cache); every other uncached layer comes back as an empty
   * `bindings` placeholder whose id is listed in `FastKeymapModel.pendingLayerIds`.
   * Lets a consumer show the first layer immediately and load the rest in the
   * background with a second (cache-warm) load. NOTE: local addition to the
   * vendored upstream loader. */
  firstLayerOnly?: boolean;
  /** When `true`, the behavior load is skipped UNLESS the whole set can be
   * served from cache for free (behaviors_fp still matches -- no `list_behaviors`
   * / `get_behaviors` round-trip). On a miss, `behaviors` comes back empty and
   * `FastKeymapModel.behaviorsDeferred` is set, so a consumer can render the
   * keymap immediately (unresolved bindings show a placeholder) and resolve the
   * labels via a later (background) full load. NOTE: local addition to the
   * vendored upstream loader. */
  deferBehaviors?: boolean;
  /** Invoked with the resolved behaviors the moment they finish loading, BEFORE
   * the (slower) layer fetch that follows -- lets a background full load hand
   * behavior labels to the UI as soon as they're ready rather than at the end.
   * Not called when the load was deferred to an empty set. NOTE: local addition
   * to the vendored upstream loader. */
  onBehaviorsLoaded?: (behaviors: FastKeymapBehavior[]) => void;
}

function defaultStorage(): Storage | undefined {
  return typeof localStorage !== "undefined" ? localStorage : undefined;
}

/** localStorage key builders -- the single source of truth for the cache
 * key format, shared by loadFastKeymap() and (for cache-seeding/inspection)
 * tests. Keyed by fingerprint, as described in DESIGN.md SS9 "C". */
export const FastKeymapCacheKeys = {
  prefix(deviceKey: string): string {
    return `fastKeymap:v${FK_DEFINITION_VERSION}:${deviceKey}`;
  },
  behaviors(deviceKey: string): string {
    return `${FastKeymapCacheKeys.prefix(deviceKey)}:behaviors`;
  },
  layer(deviceKey: string, fp: number): string {
    return `${FastKeymapCacheKeys.prefix(deviceKey)}:layer:${fp}`;
  },
  defaultLayer(deviceKey: string, defaultFp: number): string {
    return `${FastKeymapCacheKeys.prefix(deviceKey)}:defaultLayer:${defaultFp}`;
  },
  layouts(deviceKey: string): string {
    return `${FastKeymapCacheKeys.prefix(deviceKey)}:layouts`;
  },
  /** Per-layout geometry cache (DESIGN.md SS6): keyed by that one layout's
   * own device-opaque `fp`, independent of the whole-set `layouts()` key
   * above -- lets a single changed/added layout skip fetching every other
   * layout's already-known geometry. */
  layoutGeometry(deviceKey: string, fp: number): string {
    return `${FastKeymapCacheKeys.prefix(deviceKey)}:layoutGeometry:${fp}`;
  },
};

/**
 * Loads the full behavior list + effective keymap from a connected device
 * as fast as the firmware's caching levers allow, per DESIGN.md SS9 "C".
 */
export async function loadFastKeymap(
  call: FastKeymapCall,
  options: LoadFastKeymapOptions = {},
): Promise<FastKeymapModel> {
  const storage = options.storage ?? defaultStorage();
  const deviceKey = options.deviceKey ?? "default-device";
  const includeAliases = options.includeAliases ?? true;
  const includeDisplayNames = options.includeDisplayNames ?? true;

  const snapshotResponse = await callChecked(call, { getSnapshot: true });
  const snapshot = snapshotResponse.snapshot;
  if (!snapshot) {
    throw new Error(
      "get_snapshot: device returned a response with no snapshot",
    );
  }

  // Only trust the bundle when the firmware's canonicalization contract
  // version matches ours -- see standardBehaviors.ts's FK_DEFINITION_VERSION
  // doc comment. A mismatch just means every behavior gets fetched.
  const bundleTrusted = snapshot.definitionVersion === FK_DEFINITION_VERSION;

  // Behaviors: normally a full load, but with `deferBehaviors` we only take a
  // free whole-set cache hit and otherwise defer -- so the caller can paint the
  // keymap before paying for the behavior round-trips (unresolved bindings show
  // a placeholder until a background full load fills them in).
  const emptyBehaviorsResult = {
    behaviors: [] as FastKeymapBehavior[],
    fromCache: false,
    bundledCount: 0,
    cachedCount: 0,
    fetchedCount: 0,
  };
  let behaviorsResult;
  let behaviorsDeferred = false;
  if (options.deferBehaviors) {
    const wholeSet = readWholeSetBehaviorCache(storage, deviceKey, snapshot);
    if (wholeSet) {
      behaviorsResult = {
        ...emptyBehaviorsResult,
        behaviors: wholeSet,
        fromCache: true,
      };
    } else {
      behaviorsResult = emptyBehaviorsResult;
      behaviorsDeferred = true;
    }
  } else {
    behaviorsResult = await loadBehaviors(
      call,
      storage,
      deviceKey,
      snapshot,
      bundleTrusted,
      includeAliases,
      includeDisplayNames,
    );
  }
  // Hand the freshly-resolved behaviors to a waiting consumer NOW, before the
  // (slower) layer fetch below -- but not an empty deferred set.
  if (!behaviorsDeferred && behaviorsResult.behaviors.length > 0) {
    options.onBehaviorsLoaded?.(behaviorsResult.behaviors);
  }

  const layersResult = await loadLayers(
    call,
    storage,
    deviceKey,
    snapshot,
    options.firstLayerOnly ?? false,
  );
  const layoutsResult = await loadPhysicalLayouts(
    call,
    storage,
    deviceKey,
    snapshot,
  );

  return {
    definitionVersion: snapshot.definitionVersion,
    behaviors: behaviorsResult.behaviors,
    layers: layersResult.layers,
    layouts: layoutsResult.layouts,
    activeLayoutIndex: layoutsResult.activeLayoutIndex,
    availableLayers: snapshot.availableLayers,
    maxLayerNameLength: snapshot.maxLayerNameLength,
    pendingLayerIds: layersResult.pendingLayerIds,
    behaviorsDeferred,
    stats: {
      behaviorsFromCache: behaviorsResult.fromCache,
      behaviorsBundled: behaviorsResult.bundledCount,
      behaviorsCached: behaviorsResult.cachedCount,
      behaviorsFetched: behaviorsResult.fetchedCount,
      layersFromCache: layersResult.fromCacheCount,
      layersFetchedFull: layersResult.fetchedFullCount,
      layersFetchedDiff: layersResult.fetchedDiffCount,
      physicalLayoutsFromCache: layoutsResult.fromCache,
    },
  };
}

// `ErrorCode` is generated as an `as const` object (buf.gen.yaml's
// `enumsAsLiterals=true` -- ts-proto's default `export enum` output isn't
// erasable syntax, which tsconfig.app.json's `erasableSyntaxOnly` forbids),
// so it has no built-in reverse (number -> name) mapping like a real TS
// enum would. Build one for error messages.
const ERROR_CODE_NAMES: Record<number, string> = Object.fromEntries(
  Object.entries(ErrorCode).map(([name, code]) => [code, name]),
);

async function callChecked(
  call: FastKeymapCall,
  request: Request,
): Promise<Response> {
  const response = await call(request);
  if (!response) {
    throw new Error("fast_keymap RPC: device sent no response payload");
  }
  if (response.error) {
    const name =
      ERROR_CODE_NAMES[response.error.code] ?? String(response.error.code);
    throw new Error(`fast_keymap RPC error: ${name}`);
  }
  return response;
}

/** One layer's unsaved (pending) positions, from {@link loadPendingPositions}. */
export interface FastKeymapPendingLayer {
  id: number;
  /** Binding positions (selected-layout order) with an unsaved edit. */
  positions: number[];
}

/**
 * Fetch the positions whose binding has an unsaved, in-memory-only edit --
 * changed since the last save (ZMK core's pending bit) -- via the `get_pending`
 * RPC. Only layers with at least one pending position are returned; a
 * fully-saved keymap yields an empty array. Values are not returned (the client
 * already holds the current bindings from {@link loadFastKeymap} / `get_layers`);
 * this reports only WHICH keys are unsaved.
 */
export async function loadPendingPositions(
  call: FastKeymapCall,
): Promise<FastKeymapPendingLayer[]> {
  const response = await callChecked(call, { getPending: true });
  return (response.getPending?.layers ?? []).map((l) => ({
    id: l.id,
    positions: [...l.positions],
  }));
}

// ---------------------------------------------------------------------
// localStorage cache helpers -- caching is a pure optimization, never a
// correctness requirement, so any storage failure (quota, private
// browsing, no `Storage` at all) just falls back to "not cached".
// ---------------------------------------------------------------------

function readCache<T>(
  storage: Storage | undefined,
  key: string,
): T | undefined {
  if (!storage) return undefined;
  try {
    const raw = storage.getItem(key);
    if (!raw) return undefined;
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

function writeCache(
  storage: Storage | undefined,
  key: string,
  value: unknown,
): void {
  if (!storage) return;
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore -- see file header.
  }
}

// -- behaviors ------------------------------------------------------------

interface SerializedBehavior {
  localId: number;
  alias: string;
  displayName: string;
  defFp: number;
  metadata: BehaviorBindingParametersSet[];
}

/** Guards against an old-shaped cache entry (pre-def_fp protocol: had
 * `metadataFp`/`standard`, no `defFp`) -- treat it exactly like a miss
 * rather than crashing on it. See DESIGN.md SS5 / this function's callers. */
function isSerializedBehavior(value: unknown): value is SerializedBehavior {
  if (!value || typeof value !== "object") return false;
  const b = value as Partial<SerializedBehavior>;
  return (
    typeof b.localId === "number" &&
    typeof b.alias === "string" &&
    typeof b.displayName === "string" &&
    typeof b.defFp === "number" &&
    Array.isArray(b.metadata)
  );
}

function serializeBehavior(behavior: FastKeymapBehavior): SerializedBehavior {
  return {
    localId: behavior.localId,
    alias: behavior.alias,
    displayName: behavior.displayName,
    defFp: behavior.defFp,
    metadata: behavior.metadata,
  };
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/**
 * Resolves one `BehaviorSummary` per the resolution ladder (DESIGN.md SS5 /
 * the fast-keymap proposal SS2.3):
 *
 * 1. inline `details` (present per the request's `BehaviorDetailsMode`) --
 *    resolvedFrom "device", no further lookup needed.
 * 2. a per-device cache entry (from a PRIOR load, possibly stale as a
 *    whole -- see `cacheByDefFp`) whose `defFp` matches -- "cache".
 * 3. the bundled standard-behavior table, by `defFp` -- "bundle".
 * 4. otherwise: unresolved -- the caller collects its `local_id` into the
 *    `get_behaviors` miss-repair batch.
 */
function resolveInline(
  summary: BehaviorSummary,
  details: BehaviorDetails,
): FastKeymapBehavior {
  return {
    localId: summary.localId,
    alias: details.alias,
    displayName: details.displayName,
    defFp: summary.defFp,
    metadata: details.metadata,
    resolvedFrom: "device",
  };
}

/**
 * The whole-set behaviors fast path (DESIGN.md SS5): when `behaviors_fp` still
 * matches the last load's, every behavior is exactly as served, so the cached
 * set can be returned WITHOUT a `list_behaviors` (or any `get_behaviors`)
 * round-trip. Returns `null` on any miss -- a changed fp, a missing/old-shaped
 * cache, or a length mismatch -- so the caller falls back to a full load.
 * Shared by `loadBehaviors` (its fast path) and the `deferBehaviors` path,
 * which uses it to serve a warm cache for free rather than deferring.
 */
function readWholeSetBehaviorCache(
  storage: Storage | undefined,
  deviceKey: string,
  snapshot: Snapshot,
): FastKeymapBehavior[] | null {
  const cached = readCache<{
    fp: number;
    defFpBits?: number;
    behaviors: unknown[];
  }>(storage, FastKeymapCacheKeys.behaviors(deviceKey));
  if (!cached) return null;
  const cachedBehaviors = (cached.behaviors ?? []).filter(isSerializedBehavior);
  // An old-shaped cache (no entries survive the filter, even though `cached`
  // itself is truthy) is treated as absent, not a match.
  if (
    cached.fp !== snapshot.behaviorsFp ||
    cachedBehaviors.length !== cached.behaviors.length
  ) {
    return null;
  }
  return cachedBehaviors.map((b) => ({ ...b, resolvedFrom: "cache" as const }));
}

async function loadBehaviors(
  call: FastKeymapCall,
  storage: Storage | undefined,
  deviceKey: string,
  snapshot: Snapshot,
  bundleTrusted: boolean,
  includeAlias: boolean,
  includeDisplayName: boolean,
): Promise<{
  behaviors: FastKeymapBehavior[];
  fromCache: boolean;
  bundledCount: number;
  cachedCount: number;
  fetchedCount: number;
}> {
  const excludeDisplayName = !includeDisplayName;
  // The width (bits) the device serves def_fp at this session (SS4). Bundle
  // and cache def_fp keys are masked to it; 0/absent means legacy 16-bit.
  const servedBits = snapshot.defFpBits || 16;

  const cacheKey = FastKeymapCacheKeys.behaviors(deviceKey);
  const cached = readCache<{
    fp: number;
    defFpBits?: number;
    behaviors: unknown[];
  }>(storage, cacheKey);
  const cachedBehaviors = (cached?.behaviors ?? []).filter(
    isSerializedBehavior,
  );

  // Whole-set fast path: behaviors_fp matches the last load's -> every
  // behavior is still exactly as served, skip list_behaviors entirely (and
  // so every get_behaviors round-trip with it).
  const wholeSet = readWholeSetBehaviorCache(storage, deviceKey, snapshot);
  if (wholeSet) {
    return {
      behaviors: wholeSet,
      fromCache: true,
      bundledCount: 0,
      cachedCount: 0,
      fetchedCount: 0,
    };
  }

  // Per-behavior cache lookup, independent of whether the OVERALL
  // behaviors_fp still matches -- a single changed/added/removed behavior
  // shouldn't cost every other behavior its cache hit (DESIGN.md SS5's
  // resolution ladder step 2). Only trustworthy when the cache was written at
  // the same def_fp width as this session serves: a cached def_fp masked to a
  // different width could false-match a different behavior's summary def_fp.
  // (The whole-set fast path above is inherently width-safe: behaviors_fp
  // hashes the served def_fps, so a width change already changes it.)
  const cacheByDefFp = new Map<number, SerializedBehavior>();
  if ((cached?.defFpBits || 16) === servedBits) {
    for (const b of cachedBehaviors) {
      cacheByDefFp.set(b.defFp, b);
    }
  }

  // Mode selection (DESIGN.md SS5): an untrusted bundle (definition_version
  // mismatch) needs everything inlined (ALL); an empty per-device cache
  // (first connect for this device, or an old-shaped cache discarded above)
  // needs at least the non-standard behaviors inlined (CUSTOM) since there's
  // no cache to fall back on and only the bundle covers "standard"; once
  // both a trusted bundle AND a warm per-device cache exist, slim summaries
  // (NONE) are enough -- every behavior resolves from bundle or cache.
  const mode = !bundleTrusted
    ? BehaviorDetailsMode.BEHAVIOR_DETAILS_ALL
    : cachedBehaviors.length === 0
      ? BehaviorDetailsMode.BEHAVIOR_DETAILS_CUSTOM
      : BehaviorDetailsMode.BEHAVIOR_DETAILS_NONE;

  const listResponse = await callChecked(call, {
    listBehaviors: { details: mode, includeAlias, excludeDisplayName },
  });
  const summaries = listResponse.listBehaviors?.behaviors ?? [];

  const behaviors: FastKeymapBehavior[] = new Array(summaries.length);
  // local_id -> index into `behaviors`, for the misses the batch fetch
  // below needs to patch in place.
  const missIndexByLocalId = new Map<number, number>();
  let bundledCount = 0;
  let cachedCount = 0;
  let fetchedCount = 0;

  summaries.forEach((summary, index) => {
    if (summary.details) {
      fetchedCount++;
      behaviors[index] = resolveInline(summary, summary.details);
      return;
    }

    const cacheHit = cacheByDefFp.get(summary.defFp);
    if (cacheHit) {
      cachedCount++;
      behaviors[index] = {
        localId: summary.localId,
        alias: cacheHit.alias,
        displayName: cacheHit.displayName,
        defFp: summary.defFp,
        metadata: cacheHit.metadata,
        resolvedFrom: "cache",
      };
      return;
    }

    const bundled = bundleTrusted
      ? bundledByDefFp(summary.defFp, servedBits)
      : undefined;
    if (bundled) {
      bundledCount++;
      behaviors[index] = {
        localId: summary.localId,
        alias: bundled.alias,
        displayName: bundled.displayName,
        defFp: summary.defFp,
        metadata: bundled.metadata,
        resolvedFrom: "bundle",
      };
      return;
    }

    missIndexByLocalId.set(summary.localId, index);
  });

  // Miss-repair batch (DESIGN.md SS5): resolve every remaining unresolved
  // behavior in as few get_behaviors round-trips as fit the request buffer
  // (chunked at GET_BEHAVIORS_CHUNK_SIZE).
  const missLocalIds = [...missIndexByLocalId.keys()];
  for (const idsChunk of chunk(missLocalIds, GET_BEHAVIORS_CHUNK_SIZE)) {
    const batchResponse = await callChecked(call, {
      getBehaviors: { behaviorIds: idsChunk, includeAlias, excludeDisplayName },
    });
    for (const entry of batchResponse.getBehaviors?.behaviors ?? []) {
      const index = missIndexByLocalId.get(entry.id);
      if (index === undefined || !entry.details) continue;
      fetchedCount++;
      const summary = summaries[index];
      behaviors[index] = resolveInline(summary, entry.details);
    }
  }

  // Any local_id the device didn't answer for (shouldn't normally happen)
  // still needs a slot -- fall back to the slim summary's own fields so the
  // model stays fully populated rather than sparse.
  for (const [localId, index] of missIndexByLocalId) {
    if (behaviors[index]) continue;
    const summary = summaries[index];
    fetchedCount++;
    behaviors[index] = {
      localId,
      alias: "",
      displayName: "",
      defFp: summary.defFp,
      metadata: [],
      resolvedFrom: "device",
    };
  }

  writeCache(storage, cacheKey, {
    fp: snapshot.behaviorsFp,
    defFpBits: servedBits,
    behaviors: behaviors.map(serializeBehavior),
  });

  return {
    behaviors,
    fromCache: false,
    bundledCount,
    cachedCount,
    fetchedCount,
  };
}

// -- keymap (layers) --------------------------------------------------------

function toFastBindings(
  bindings: { behaviorId: number; param1: number; param2: number }[],
): FastKeymapBinding[] {
  return bindings.map((b) => ({
    behaviorId: b.behaviorId,
    param1: b.param1,
    param2: b.param2,
  }));
}

function overlayEdits(
  defaultBindings: FastKeymapBinding[],
  edits: EditedBinding[],
): FastKeymapBinding[] {
  const result = defaultBindings.map((b) => ({ ...b }));
  for (const edit of edits) {
    if (!edit.binding) continue;
    if (edit.position < 0 || edit.position >= result.length) continue;
    result[edit.position] = {
      behaviorId: edit.binding.behaviorId,
      param1: edit.binding.param1,
      param2: edit.binding.param2,
    };
  }
  return result;
}

async function loadLayers(
  call: FastKeymapCall,
  storage: Storage | undefined,
  deviceKey: string,
  snapshot: Snapshot,
  // Local addition (see LoadFastKeymapOptions.firstLayerOnly): defer every
  // uncached layer except the first to an empty placeholder.
  firstLayerOnly: boolean,
): Promise<{
  layers: FastKeymapLayer[];
  fromCacheCount: number;
  fetchedFullCount: number;
  fetchedDiffCount: number;
  pendingLayerIds: number[];
}> {
  const layers: FastKeymapLayer[] = new Array(snapshot.layers.length);
  let fromCacheCount = 0;
  let fetchedFullCount = 0;
  let fetchedDiffCount = 0;
  const pendingLayerIds: number[] = [];

  const makeLayer = (
    lf: Snapshot["layers"][number],
    bindings: FastKeymapBinding[],
    loadedFromCache: boolean,
  ): FastKeymapLayer => ({
    id: lf.id,
    name: lf.name,
    bindingCount: lf.bindingCount,
    editedCount: lf.editedCount,
    bindings,
    loadedFromCache,
  });

  // Layers that couldn't be resolved from a cache and so need a full
  // effective-binding fetch -- collected here and pulled in ONE batched
  // `get_layers` round-trip (chunked) instead of one `get_layer` each, which
  // matters most on a cold load where every layer lands here (DESIGN.md SS7).
  const pending: { index: number; lf: Snapshot["layers"][number] }[] = [];

  for (let index = 0; index < snapshot.layers.length; index++) {
    const lf = snapshot.layers[index];
    const layerKey = FastKeymapCacheKeys.layer(deviceKey, lf.fp);
    const defaultKey = FastKeymapCacheKeys.defaultLayer(
      deviceKey,
      lf.defaultFp,
    );

    const cachedCurrent = readCache<FastKeymapBinding[]>(storage, layerKey);
    if (cachedCurrent) {
      fromCacheCount++;
      layers[index] = makeLayer(lf, cachedCurrent, true);
      continue;
    }

    // firstLayerOnly (local addition): show the first layer immediately and
    // defer every other uncached layer to an empty placeholder -- a later full
    // load (cache-warm) fetches these in one batched get_layers round-trip.
    if (firstLayerOnly && index !== 0) {
      pendingLayerIds.push(lf.id);
      layers[index] = makeLayer(lf, [], false);
      continue;
    }

    // A cached default (from a prior load, possibly written while loading a
    // sibling layer sharing this default_fp) lets us avoid the batch fetch:
    // an unedited layer reuses it directly, an edited one overlays a small
    // `get_edited_layer` diff. Without one, fall through to the batch.
    const cachedDefault = readCache<FastKeymapBinding[]>(storage, defaultKey);
    if (cachedDefault) {
      if (lf.fp === lf.defaultFp) {
        writeCache(storage, layerKey, cachedDefault);
        layers[index] = makeLayer(lf, cachedDefault, false);
        continue;
      }
      const editedResponse = await callChecked(call, {
        getEditedLayer: { layerId: lf.id },
      });
      const bindings = overlayEdits(
        cachedDefault,
        editedResponse.getEditedLayer?.bindings ?? [],
      );
      writeCache(storage, layerKey, bindings);
      fetchedDiffCount++;
      layers[index] = makeLayer(lf, bindings, false);
      continue;
    }

    pending.push({ index, lf });
  }

  // Batch-fetch every remaining layer's effective bindings. `get_layers`
  // returns current bindings directly, so on a cold load (no cached default
  // to diff against) this is both fewer round-trips AND fewer than the old
  // get_default_layer + get_edited_layer pair per edited layer.
  for (const group of chunk(pending, GET_LAYERS_CHUNK_SIZE)) {
    const response = await callChecked(call, {
      getLayers: { layerIds: group.map((p) => p.lf.id) },
    });
    const bindingsById = new Map(
      (response.getLayers?.layers ?? []).map((l) => [
        l.id,
        toFastBindings(l.bindings),
      ]),
    );

    for (const { index, lf } of group) {
      // A layer the device didn't return (shouldn't happen -- ids come from
      // the snapshot) falls back to empty rather than leaving a hole.
      const bindings = bindingsById.get(lf.id) ?? [];
      writeCache(
        storage,
        FastKeymapCacheKeys.layer(deviceKey, lf.fp),
        bindings,
      );
      // Unedited layer: its effective bindings ARE the default, so seed the
      // default cache too (lets a sibling / a later edit reuse it).
      if (lf.fp === lf.defaultFp) {
        writeCache(
          storage,
          FastKeymapCacheKeys.defaultLayer(deviceKey, lf.defaultFp),
          bindings,
        );
      }
      fetchedFullCount++;
      layers[index] = makeLayer(lf, bindings, false);
    }
  }

  return {
    layers,
    fromCacheCount,
    fetchedFullCount,
    fetchedDiffCount,
    pendingLayerIds,
  };
}

// -- physical layouts (slim summary + on-demand geometry, DESIGN.md SS6) ---
//
// get_physical_layouts(NONE) returns just {name, fp} per layout (no `keys`,
// omitted for free by proto3) -- geometry is pulled in separately via
// get_physical_layout(index), eagerly for the active layout (loadFastKeymap
// always wants to render it) and lazily for the rest (via the exported
// loadPhysicalLayoutGeometry() helper, for a consumer that wants to show a
// non-active layout on demand).
//
// Two cache layers, both keyed by fingerprint:
// - the whole-set cache (FastKeymapCacheKeys.layouts) -- keyed by the
//   Snapshot's physical_layout_fp, exactly like before: a match skips every
//   layout RPC.
// - a per-layout geometry cache (FastKeymapCacheKeys.layoutGeometry) --
//   keyed by that one layout's own device-opaque `fp`, so a single
//   changed/added layout doesn't cost every other layout's cached geometry
//   (mirrors the behaviors resolution ladder in DESIGN.md SS5).

interface SerializedLayouts {
  fp: number;
  activeLayoutIndex: number;
  layouts: FastKeymapLayout[];
}

/** Guards against an old-shaped cache entry (pre-summary protocol: every
 * layout always carried `keys`, none carried a per-layout `fp`) -- treat it
 * exactly like a miss rather than crashing on it or trusting stale/missing
 * fingerprints. */
function isSerializedLayoutsCache(value: unknown): value is SerializedLayouts {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<SerializedLayouts>;
  return (
    typeof v.fp === "number" &&
    typeof v.activeLayoutIndex === "number" &&
    Array.isArray(v.layouts) &&
    v.layouts.every(
      (l) =>
        l &&
        typeof l === "object" &&
        typeof (l as Partial<FastKeymapLayout>).name === "string" &&
        typeof (l as Partial<FastKeymapLayout>).fp === "number",
    )
  );
}

interface SerializedLayoutGeometry {
  name: string;
  fp: number;
  keys: FastKeymapLayoutKey[];
}

function isSerializedLayoutGeometry(
  value: unknown,
): value is SerializedLayoutGeometry {
  if (!value || typeof value !== "object") return false;
  const l = value as Partial<SerializedLayoutGeometry>;
  return (
    typeof l.name === "string" &&
    typeof l.fp === "number" &&
    Array.isArray(l.keys)
  );
}

/** Reconstructs a layout's keys, restoring each key's width/height from the
 * summary's `defaultWidth`/`defaultHeight` when the firmware omitted them
 * (encoded 0) because they matched the common size -- see the proto's
 * PhysicalLayoutSummary.default_* / DESIGN.md SS6. A real key is never
 * 0-sized, so `0` unambiguously means "use the default". */
function toLayoutKeys(layout: {
  keys: KeyPhysicalAttrs[];
  defaultWidth: number;
  defaultHeight: number;
}): FastKeymapLayoutKey[] {
  return layout.keys.map((k) => ({
    width: k.width === 0 ? layout.defaultWidth : k.width,
    height: k.height === 0 ? layout.defaultHeight : k.height,
    x: k.x,
    y: k.y,
    r: k.r,
    rx: k.rx,
    ry: k.ry,
  }));
}

function readLayoutGeometryCache(
  storage: Storage | undefined,
  deviceKey: string,
  fp: number,
): SerializedLayoutGeometry | undefined {
  const raw = readCache<unknown>(
    storage,
    FastKeymapCacheKeys.layoutGeometry(deviceKey, fp),
  );
  return isSerializedLayoutGeometry(raw) ? raw : undefined;
}

function writeLayoutGeometryCache(
  storage: Storage | undefined,
  deviceKey: string,
  entry: SerializedLayoutGeometry,
): void {
  writeCache(
    storage,
    FastKeymapCacheKeys.layoutGeometry(deviceKey, entry.fp),
    entry,
  );
}

/**
 * Fetches one layout's geometry on demand via `get_physical_layout`, caches
 * it (keyed by that layout's own `fp`, like every per-layout geometry cache
 * entry), and returns the keys. Exported so a consuming app can lazily load
 * a non-active layout's geometry (e.g. when the user picks a different
 * layout to view) without loadFastKeymap() having to fetch every layout's
 * geometry up front.
 *
 * When the caller knows the layout's fingerprint (`options.fp`), a cached
 * geometry entry with that fp is returned WITHOUT a device round-trip -- the
 * geometry is content-addressed by fp, so a matching cache entry is exactly
 * what the device would serve. (Local addition to the vendored upstream:
 * upstream always did the RPC.)
 */
export async function loadPhysicalLayoutGeometry(
  call: FastKeymapCall,
  index: number,
  options: LoadFastKeymapOptions & { fp?: number } = {},
): Promise<FastKeymapLayoutKey[]> {
  const storage = options.storage ?? defaultStorage();
  const deviceKey = options.deviceKey ?? "default-device";

  if (options.fp !== undefined) {
    const cached = readLayoutGeometryCache(storage, deviceKey, options.fp);
    if (cached) {
      return cached.keys;
    }
  }

  const response = await callChecked(call, {
    getPhysicalLayout: { layoutIndex: index },
  });
  const layout = response.getPhysicalLayout?.layout;
  if (!layout) {
    throw new Error(`get_physical_layout(${index}): device returned no layout`);
  }

  const keys = toLayoutKeys(layout);
  writeLayoutGeometryCache(storage, deviceKey, {
    name: layout.name,
    fp: layout.fp,
    keys,
  });
  return keys;
}

async function loadPhysicalLayouts(
  call: FastKeymapCall,
  storage: Storage | undefined,
  deviceKey: string,
  snapshot: Snapshot,
): Promise<{
  layouts: FastKeymapLayout[];
  activeLayoutIndex: number;
  fromCache: boolean;
}> {
  const cacheKey = FastKeymapCacheKeys.layouts(deviceKey);
  const cachedRaw = readCache<unknown>(storage, cacheKey);
  const cached = isSerializedLayoutsCache(cachedRaw) ? cachedRaw : undefined;

  // Whole-set fast path: physical_layout_fp matches the last load's -> every
  // layout (name + fp + whatever geometry was cached) is still exactly as
  // served, skip get_physical_layouts entirely.
  if (cached && cached.fp === snapshot.physicalLayoutFp) {
    return {
      layouts: cached.layouts,
      activeLayoutIndex: cached.activeLayoutIndex,
      fromCache: true,
    };
  }

  const response = await callChecked(call, {
    getPhysicalLayouts: { details: LayoutDetailsMode.LAYOUT_DETAILS_NONE },
  });
  const data = response.getPhysicalLayouts;
  const summaries = data?.layouts ?? [];
  const activeLayoutIndex =
    data?.activeLayoutIndex ?? snapshot.activeLayoutIndex;

  // Per-layout geometry cache lookup (independent of the whole-set match
  // above) -- a layout whose fp didn't change keeps its cached geometry
  // without a device round-trip.
  const layouts: FastKeymapLayout[] = summaries.map((summary) => {
    const cachedGeometry = readLayoutGeometryCache(
      storage,
      deviceKey,
      summary.fp,
    );
    return {
      name: summary.name,
      fp: summary.fp,
      keys: cachedGeometry?.keys,
    };
  });

  // Only the active layout's geometry is fetched eagerly here -- other
  // layouts' geometry is left undefined for the caller to fetch lazily via
  // loadPhysicalLayoutGeometry() (DESIGN.md SS6 / the web flow it
  // describes).
  const activeLayout = layouts[activeLayoutIndex];
  if (activeLayout && activeLayout.keys === undefined) {
    const activeResponse = await callChecked(call, {
      getPhysicalLayout: { layoutIndex: activeLayoutIndex },
    });
    const activeData = activeResponse.getPhysicalLayout?.layout;
    if (activeData) {
      const keys = toLayoutKeys(activeData);
      activeLayout.name = activeData.name;
      activeLayout.fp = activeData.fp;
      activeLayout.keys = keys;
      writeLayoutGeometryCache(storage, deviceKey, {
        name: activeData.name,
        fp: activeData.fp,
        keys,
      });
    }
  }

  writeCache(storage, cacheKey, {
    fp: snapshot.physicalLayoutFp,
    activeLayoutIndex,
    layouts,
  });

  return { layouts, activeLayoutIndex, fromCache: false };
}

// ---------------------------------------------------------------------
// `.keymap` export (DESIGN.md SS9 "C"). Renders each layer as a devicetree
// `bindings = < ... >;` block using each binding's resolved alias (falling
// back to `behavior_<local_id>` when the behavior can't be resolved at
// all). Params are always rendered as raw numbers -- resolving `&kp`
// numeric usage IDs back to ZMK keycode names (e.g. 30 -> "N1") is out of
// scope for v1.
// ---------------------------------------------------------------------

/** How many of a binding's two params to render, inferred from the
 * resolved behavior's metadata (first parameter set): both param1/param2
 * present -> 2, only param1 -> 1, neither (or metadata unresolved) -> 0.
 * Best-effort -- behaviors with multiple sets of differing arity (e.g.
 * `&bt`) are only checked against their first set. */
function behaviorParamArity(behavior: FastKeymapBehavior | undefined): number {
  const firstSet = behavior?.metadata[0];
  if (!firstSet) return 0;
  if (firstSet.param2.length > 0) return 2;
  if (firstSet.param1.length > 0) return 1;
  return 0;
}

/** Builds a `local_id -> behavior` lookup for `formatBindingToken()` /
 * `exportKeymapText()`; also handy for UI code rendering a single layer. */
export function indexBehaviorsById(
  behaviors: FastKeymapBehavior[],
): Map<number, FastKeymapBehavior> {
  return new Map(behaviors.map((b) => [b.localId, b] as const));
}

/** Renders one binding as a `.keymap`-style token, e.g. `&kp 30` or
 * `&mo 1` -- shared by exportKeymapText() and the UI's per-binding
 * display. See exportKeymapText()'s doc comment for the params/arity
 * caveats. */
export function formatBindingToken(
  binding: FastKeymapBinding,
  behaviorsById: Map<number, FastKeymapBehavior>,
): string {
  return renderBindingToken(binding, behaviorsById);
}

function renderBindingToken(
  binding: FastKeymapBinding,
  behaviorsById: Map<number, FastKeymapBehavior>,
): string {
  if (binding.behaviorId < 0) {
    return "&none";
  }

  const behavior = behaviorsById.get(binding.behaviorId);
  const alias = behavior?.alias || `behavior_${binding.behaviorId}`;
  const arity = behaviorParamArity(behavior);

  const tokens = [`&${alias}`];
  if (arity >= 1) tokens.push(String(binding.param1));
  if (arity >= 2) tokens.push(String(binding.param2));
  return tokens.join(" ");
}

/** Devicetree node names must start with a lowercase letter/underscore and
 * contain only `[a-z0-9_]` (roughly) -- sanitize a (possibly
 * user-authored) layer name into one, falling back to `layer_<id>` for an
 * empty/unusable name. */
function layerNodeName(name: string, id: number): string {
  const sanitized = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (!sanitized || /^[0-9]/.test(sanitized)) {
    return `layer_${id}${sanitized ? `_${sanitized}` : ""}`;
  }
  return sanitized;
}

/** Renders `model` as `.keymap`-style `keymap { <layer> { bindings = < ... >; }; ... };`
 * text, suitable for pasting into a ZMK keymap file's `keymap` node. */
export function exportKeymapText(model: FastKeymapModel): string {
  const behaviorsById = indexBehaviorsById(model.behaviors);

  const layerBlocks = model.layers.map((layer) => {
    const tokens = layer.bindings.map((binding) =>
      formatBindingToken(binding, behaviorsById),
    );
    const bindingsInner = tokens.length > 0 ? ` ${tokens.join(" ")} ` : " ";
    return `    ${layerNodeName(layer.name, layer.id)} {\n        bindings = <${bindingsInner}>;\n    };`;
  });

  return `keymap {\n    compatible = "zmk,keymap";\n\n${layerBlocks.join("\n\n")}\n};`;
}
