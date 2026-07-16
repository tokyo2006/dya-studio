import { loadFastKeymap, FastKeymapCacheKeys } from "../fastKeymap";
import { FK_DEFINITION_VERSION } from "../standardBehaviors";
import type {
  Request,
  Response,
  Snapshot,
} from "../../../proto/cormoran/fast_keymap/fast_keymap";

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k: string) => map.get(k) ?? null,
    key: (i: number) => [...map.keys()][i] ?? null,
    removeItem: (k: string) => map.delete(k),
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
  };
}

const DEVICE = "kbd";
const BEHAVIORS_FP = 111;
const PHYS_FP = 222;
const LAYER_FP = 333;

const SNAPSHOT: Snapshot = {
  definitionVersion: FK_DEFINITION_VERSION,
  behaviorsFp: BEHAVIORS_FP,
  defaultKeymapFp: 0,
  keymapFp: 0,
  physicalLayoutFp: PHYS_FP,
  behaviorCount: 1,
  maxLayerNameLength: 16,
  availableLayers: 4,
  activeLayoutIndex: 0,
  layers: [
    {
      id: 1,
      name: "base",
      bindingCount: 1,
      fp: LAYER_FP,
      defaultFp: LAYER_FP,
      editedCount: 0,
    },
  ],
  defFpBits: 16,
};

/** A `call` that only knows how to answer `get_snapshot`; any other request
 * (a behavior/layer/layout round-trip) throws, so a test can assert those were
 * avoided. The layer + layout caches are seeded so only the behaviors decision
 * is exercised. */
function snapshotOnlyCall(): jest.Mock<Promise<Response>, [Request]> {
  return jest.fn(async (req: Request): Promise<Response> => {
    if (req.getSnapshot) {
      return { snapshot: SNAPSHOT } as Response;
    }
    throw new Error(
      `unexpected RPC: ${Object.keys(req).join(",")} (should have been cached / deferred)`,
    );
  });
}

function seedLayerAndLayoutCaches(storage: Storage) {
  // First (only) layer resolves from cache -> no get_layers.
  storage.setItem(
    FastKeymapCacheKeys.layer(DEVICE, LAYER_FP),
    JSON.stringify([{ behaviorId: 42, param1: 4, param2: 0 }]),
  );
  // Whole-set layouts cache hit -> no get_physical_layouts.
  storage.setItem(
    FastKeymapCacheKeys.layouts(DEVICE),
    JSON.stringify({
      fp: PHYS_FP,
      activeLayoutIndex: 0,
      layouts: [{ name: "active", fp: 1, keys: [] }],
    }),
  );
}

describe("loadFastKeymap deferBehaviors", () => {
  it("defers behaviors (no list_behaviors RPC) when the cache is cold", async () => {
    const storage = memoryStorage();
    seedLayerAndLayoutCaches(storage);
    const call = snapshotOnlyCall();

    const model = await loadFastKeymap(call, {
      deviceKey: DEVICE,
      storage,
      firstLayerOnly: true,
      deferBehaviors: true,
    });

    expect(model.behaviorsDeferred).toBe(true);
    expect(model.behaviors).toEqual([]);
    // The ONLY round-trip was get_snapshot; behaviors were not fetched.
    expect(call).toHaveBeenCalledTimes(1);
  });

  it("serves behaviors from the whole-set cache for free (no RPC, not deferred)", async () => {
    const storage = memoryStorage();
    seedLayerAndLayoutCaches(storage);
    // Warm behaviors cache whose fp still matches the snapshot's.
    storage.setItem(
      FastKeymapCacheKeys.behaviors(DEVICE),
      JSON.stringify({
        fp: BEHAVIORS_FP,
        defFpBits: 16,
        behaviors: [
          {
            localId: 42,
            alias: "kp",
            displayName: "Key Press",
            defFp: 5,
            metadata: [],
          },
        ],
      }),
    );
    const call = snapshotOnlyCall();

    const model = await loadFastKeymap(call, {
      deviceKey: DEVICE,
      storage,
      firstLayerOnly: true,
      deferBehaviors: true,
    });

    expect(model.behaviorsDeferred).toBe(false);
    expect(model.behaviors).toHaveLength(1);
    expect(model.behaviors[0].displayName).toBe("Key Press");
    // Still no behaviors round-trip: only get_snapshot.
    expect(call).toHaveBeenCalledTimes(1);
  });

  it("invokes onBehaviorsLoaded before layers on a full (non-deferred) load", async () => {
    const storage = memoryStorage();
    seedLayerAndLayoutCaches(storage);
    // Warm behaviors cache so the full load resolves them without an RPC too.
    storage.setItem(
      FastKeymapCacheKeys.behaviors(DEVICE),
      JSON.stringify({
        fp: BEHAVIORS_FP,
        defFpBits: 16,
        behaviors: [
          {
            localId: 42,
            alias: "kp",
            displayName: "Key Press",
            defFp: 5,
            metadata: [],
          },
        ],
      }),
    );
    const call = snapshotOnlyCall();
    const onBehaviorsLoaded = jest.fn();

    const model = await loadFastKeymap(call, {
      deviceKey: DEVICE,
      storage,
      onBehaviorsLoaded,
    });

    expect(model.behaviorsDeferred).toBe(false);
    expect(onBehaviorsLoaded).toHaveBeenCalledTimes(1);
    expect(onBehaviorsLoaded.mock.calls[0][0]).toHaveLength(1);
  });
});
