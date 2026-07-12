import { loadPhysicalLayoutGeometry, FastKeymapCacheKeys } from "../fastKeymap";
import type {
  Request,
  Response,
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
const KEYS = [{ width: 100, height: 100, x: 1, y: 2, r: 0, rx: 0, ry: 0 }];

describe("loadPhysicalLayoutGeometry cache", () => {
  it("returns cached geometry without an RPC when fp matches", async () => {
    const storage = memoryStorage();
    storage.setItem(
      FastKeymapCacheKeys.layoutGeometry(DEVICE, 8194),
      JSON.stringify({ name: "DYA2", fp: 8194, keys: KEYS }),
    );
    const call = jest.fn<Promise<Response | null>, [Request]>();

    const keys = await loadPhysicalLayoutGeometry(call, 2, {
      deviceKey: DEVICE,
      storage,
      fp: 8194,
    });

    expect(call).not.toHaveBeenCalled();
    expect(keys).toEqual(KEYS);
  });

  it("fetches and caches when there is no cached fp", async () => {
    const storage = memoryStorage();
    const call = jest.fn(
      async (): Promise<Response> =>
        ({
          getPhysicalLayout: {
            index: 2,
            layout: { name: "DYA2", fp: 8194, keys: KEYS },
          },
        }) as Response,
    );

    const keys = await loadPhysicalLayoutGeometry(call, 2, {
      deviceKey: DEVICE,
      storage,
    });

    expect(call).toHaveBeenCalledTimes(1);
    expect(keys).toEqual(KEYS);
    // wrote the per-layout geometry cache, keyed by the returned fp
    expect(
      storage.getItem(FastKeymapCacheKeys.layoutGeometry(DEVICE, 8194)),
    ).not.toBeNull();
  });
});
