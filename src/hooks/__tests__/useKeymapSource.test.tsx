import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { ZMKAppContext } from "@cormoran/zmk-studio-react-hook";
import { useKeymapSource } from "../useKeymapSource";
import { setFastKeymapAvailable } from "../../lib/officialKeymapRpcGuard";
import type { FastKeymapModel } from "../../lib/fastKeymap";

// -- mock the transport bits --------------------------------------------------

const mockCallRpc = jest.fn();
jest.mock("@zmkfirmware/zmk-studio-ts-client", () => ({
  ...jest.requireActual("@zmkfirmware/zmk-studio-ts-client"),
  call_rpc: (...args: unknown[]) => mockCallRpc(...args),
}));

// The custom-subsystem hook is mocked so a test can toggle whether the
// fast-keymap subsystem is "present" and control its `call`.
const mockUseCustomSubsystem = jest.fn();
jest.mock("@cormoran/zmk-studio-react-hook", () => ({
  ...jest.requireActual("@cormoran/zmk-studio-react-hook"),
  useCustomSubsystem: (...args: unknown[]) => mockUseCustomSubsystem(...args),
}));

// The vendored fast loader is mocked: we test useKeymapSource's decision +
// mapping, not the (separately-tested) fingerprint/cache loader.
const mockLoadFastKeymap = jest.fn();
const mockLoadPhysicalLayoutGeometry = jest.fn();
jest.mock("../../lib/fastKeymap", () => ({
  loadFastKeymap: (...args: unknown[]) => mockLoadFastKeymap(...args),
  loadPhysicalLayoutGeometry: (...args: unknown[]) =>
    mockLoadPhysicalLayoutGeometry(...args),
}));

function wrapper({ children }: { children: ReactNode }) {
  const value = {
    state: { connection: { label: "test" }, deviceInfo: { name: "kbd" } },
  } as never;
  return (
    <ZMKAppContext.Provider value={value}>{children}</ZMKAppContext.Provider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

// The guard uses a module-level flag synced by useKeymapSource; reset it so
// the fast-path tests can't leak availability into later assertions.
afterEach(() => {
  setFastKeymapAvailable(false);
});

describe("useKeymapSource — official fallback", () => {
  beforeEach(() => {
    mockUseCustomSubsystem.mockReturnValue({
      subsystem: null,
      call: jest.fn(),
    });
  });

  it("reports official source when the subsystem is absent", () => {
    const { result } = renderHook(() => useKeymapSource(), { wrapper });
    expect(result.current.isFastAvailable).toBe(false);
    expect(result.current.source).toBe("official");
  });

  it("loads layouts + keymap + behaviors via the official protocol", async () => {
    mockCallRpc.mockImplementation(async (_conn, req) => {
      if (req.keymap?.getPhysicalLayouts) {
        return {
          keymap: {
            getPhysicalLayouts: {
              activeLayoutIndex: 0,
              layouts: [{ name: "default", keys: [] }],
            },
          },
        };
      }
      if (req.keymap?.getKeymap) {
        return {
          keymap: {
            getKeymap: {
              layers: [{ id: 1, name: "base", bindings: [] }],
              availableLayers: 4,
              maxLayerNameLength: 16,
            },
          },
        };
      }
      if (req.behaviors?.listAllBehaviors) {
        return { behaviors: { listAllBehaviors: { behaviors: [7] } } };
      }
      if (req.behaviors?.getBehaviorDetails) {
        return {
          behaviors: {
            getBehaviorDetails: { id: 7, displayName: "kp", metadata: [] },
          },
        };
      }
      return {};
    });

    const { result } = renderHook(() => useKeymapSource(), { wrapper });
    const data = await result.current.loadKeymapData();

    expect(data.source).toBe("official");
    expect(data.physicalLayouts.layouts).toHaveLength(1);
    expect(data.keymap.availableLayers).toBe(4);
    expect(data.behaviors.get(7)?.displayName).toBe("kp");
    expect(mockLoadFastKeymap).not.toHaveBeenCalled();
  });
});

describe("useKeymapSource — fast path", () => {
  const fastModel: FastKeymapModel = {
    definitionVersion: 1,
    behaviors: [
      {
        localId: 42,
        alias: "kp",
        displayName: "Key Press",
        defFp: 123,
        metadata: [],
        resolvedFrom: "bundle",
      },
    ],
    layers: [
      {
        id: 1,
        name: "base",
        bindingCount: 1,
        editedCount: 0,
        bindings: [{ behaviorId: 42, param1: 4, param2: 0 }],
        loadedFromCache: false,
      },
    ],
    layouts: [
      { name: "active", fp: 1, keys: [] },
      { name: "other", fp: 2, keys: undefined },
    ],
    activeLayoutIndex: 0,
    availableLayers: 8,
    maxLayerNameLength: 20,
    stats: {
      behaviorsFromCache: false,
      behaviorsBundled: 1,
      behaviorsCached: 0,
      behaviorsFetched: 0,
      layersFromCache: 0,
      layersFetchedFull: 1,
      layersFetchedDiff: 0,
      physicalLayoutsFromCache: false,
    },
  };

  let mockCall: jest.Mock;
  beforeEach(() => {
    mockCall = jest.fn().mockResolvedValue(null);
    mockUseCustomSubsystem.mockReturnValue({
      subsystem: { index: 3, identifier: "cormoran__fast_keymap" },
      call: mockCall,
    });
    mockLoadFastKeymap.mockResolvedValue(fastModel);
    mockLoadPhysicalLayoutGeometry.mockResolvedValue([
      { width: 100, height: 100, x: 0, y: 0, r: 0, rx: 0, ry: 0 },
    ]);
  });

  it("reports fast source when the subsystem is present", () => {
    const { result } = renderHook(() => useKeymapSource(), { wrapper });
    expect(result.current.isFastAvailable).toBe(true);
    expect(result.current.source).toBe("fast");
  });

  it("maps the fast model onto official shapes without loading non-active geometry", async () => {
    const { result } = renderHook(() => useKeymapSource(), { wrapper });
    const data = await result.current.loadKeymapData();

    expect(data.source).toBe("fast");
    // behaviors keyed by local_id
    expect(data.behaviors.get(42)?.displayName).toBe("Key Press");
    // layer bindings mapped through
    expect(data.keymap.layers[0].bindings[0]).toEqual({
      behaviorId: 42,
      param1: 4,
      param2: 0,
    });
    // snapshot-derived limits surfaced
    expect(data.keymap.availableLayers).toBe(8);
    expect(data.keymap.maxLayerNameLength).toBe(20);
    // The load path must NOT fetch non-active layout geometry — that was the
    // slow "Finalizing" work. Active layout keeps its (empty here) keys; the
    // non-active layout is left with empty keys until switched to.
    expect(mockLoadPhysicalLayoutGeometry).not.toHaveBeenCalled();
    expect(data.physicalLayouts.layouts[1].keys).toEqual([]);
    // the official protocol was not used for loading
    expect(mockCallRpc).not.toHaveBeenCalled();
  });

  it("fetches one layout's geometry lazily via loadLayoutGeometry", async () => {
    const { result } = renderHook(() => useKeymapSource(), { wrapper });
    const keys = await result.current.loadLayoutGeometry(1);

    expect(mockLoadPhysicalLayoutGeometry).toHaveBeenCalledTimes(1);
    expect(mockLoadPhysicalLayoutGeometry).toHaveBeenCalledWith(
      expect.any(Function),
      1,
      expect.objectContaining({ deviceKey: "kbd" }),
    );
    expect(keys).toHaveLength(1);
  });

  it("issues fast RPCs with an extended timeout (not the 5s default)", async () => {
    const { result } = renderHook(() => useKeymapSource(), { wrapper });
    await result.current.loadKeymapData();

    // loadFastKeymap is called with a wrapped `call` — invoking it must pass a
    // longer timeout to the underlying subsystem call so slow-BLE RPCs don't
    // spuriously time out and desync the RPC stream.
    const wrappedCall = mockLoadFastKeymap.mock.calls[0][0] as (
      request: unknown,
    ) => Promise<unknown>;
    await wrappedCall({ getSnapshot: true });

    expect(mockCall).toHaveBeenCalledWith(
      { getSnapshot: true },
      { timeout: 30000 },
    );
  });
});
