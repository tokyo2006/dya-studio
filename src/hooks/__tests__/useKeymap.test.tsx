/**
 * Tests for useKeymap hook
 *
 * This test suite verifies the keymap state management,
 * including loading, modifying, and saving keymaps.
 */
import { renderHook, act, waitFor } from "@testing-library/react";
import { useKeymap } from "../useKeymap";
import { ZMKAppContext } from "@cormoran/zmk-studio-react-hook";
import type { ReactNode } from "react";

// Mock the zmk-studio-ts-client
jest.mock("@zmkfirmware/zmk-studio-ts-client", () => ({
  call_rpc: jest.fn(),
  MetaError: class MetaError extends Error {
    condition: number;
    constructor(condition: number) {
      super("MetaError");
      this.condition = condition;
    }
  },
}));

jest.mock("@zmkfirmware/zmk-studio-ts-client/meta", () => ({
  ErrorConditions: {
    GENERIC: 0,
    UNLOCK_REQUIRED: 1,
    RPC_NOT_FOUND: 2,
    MSG_DECODE_FAILED: 3,
    MSG_ENCODE_FAILED: 4,
    UNRECOGNIZED: -1,
  },
}));

import { call_rpc } from "@zmkfirmware/zmk-studio-ts-client";

const mockCallRpc = call_rpc as jest.MockedFunction<typeof call_rpc>;

// Test data
const mockPhysicalLayouts = {
  activeLayoutIndex: 0,
  layouts: [
    {
      name: "Default",
      keys: [
        { width: 100, height: 100, x: 0, y: 0, r: 0, rx: 0, ry: 0 },
        { width: 100, height: 100, x: 100, y: 0, r: 0, rx: 0, ry: 0 },
      ],
    },
  ],
};

const mockKeymap = {
  layers: [
    {
      id: 0,
      name: "Base",
      bindings: [
        { behaviorId: 1, param1: 0x04, param2: 0 }, // A key
        { behaviorId: 1, param1: 0x05, param2: 0 }, // B key
      ],
    },
    {
      id: 1,
      name: "Lower",
      bindings: [
        { behaviorId: 2, param1: 0, param2: 0 }, // Trans
        { behaviorId: 2, param1: 0, param2: 0 }, // Trans
      ],
    },
  ],
  availableLayers: 4,
  maxLayerNameLength: 32,
};

const mockBehaviors = [1, 2, 3]; // kp, trans, mo

const mockBehaviorDetails: Record<
  number,
  { id: number; displayName: string; metadata: never[] }
> = {
  1: { id: 1, displayName: "kp", metadata: [] },
  2: { id: 2, displayName: "trans", metadata: [] },
  3: { id: 3, displayName: "mo", metadata: [] },
};

// Create a wrapper with ZMKAppContext
function createWrapper(zmkAppValue: unknown) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <ZMKAppContext.Provider value={zmkAppValue as never}>
        {children}
      </ZMKAppContext.Provider>
    );
  };
}

describe("useKeymap", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Initial State", () => {
    it("should have null values when not connected", () => {
      const zmkApp = {
        state: { connection: null },
        onNotification: jest.fn(() => jest.fn()),
      };

      const { result } = renderHook(() => useKeymap(), {
        wrapper: createWrapper(zmkApp),
      });

      expect(result.current.physicalLayouts).toBeNull();
      expect(result.current.keymap).toBeNull();
      expect(result.current.behaviors.size).toBe(0);
      expect(result.current.hasUnsavedChanges).toBe(false);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.unlockRequired).toBe(false);
    });
  });

  describe("Data Loading", () => {
    it("should load keymap data when connected", async () => {
      const mockConnection = { label: "test" };
      const zmkApp = {
        state: { connection: mockConnection },
        onNotification: jest.fn(() => jest.fn()),
      };

      // Setup mock responses
      mockCallRpc.mockImplementation(async (_conn, req) => {
        if (req.keymap?.getPhysicalLayouts) {
          return {
            keymap: { getPhysicalLayouts: mockPhysicalLayouts },
          } as never;
        }
        if (req.keymap?.getKeymap) {
          return { keymap: { getKeymap: mockKeymap } } as never;
        }
        if (req.behaviors?.listAllBehaviors) {
          return {
            behaviors: { listAllBehaviors: { behaviors: mockBehaviors } },
          } as never;
        }
        if (req.behaviors?.getBehaviorDetails) {
          const id = req.behaviors.getBehaviorDetails.behaviorId;
          return {
            behaviors: { getBehaviorDetails: mockBehaviorDetails[id] },
          } as never;
        }
        if (req.keymap?.checkUnsavedChanges) {
          return { keymap: { checkUnsavedChanges: false } } as never;
        }
        return {} as never;
      });

      const { result } = renderHook(() => useKeymap(), {
        wrapper: createWrapper(zmkApp),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.physicalLayouts).toEqual(mockPhysicalLayouts);
      expect(result.current.keymap).toEqual(mockKeymap);
      expect(result.current.behaviors.size).toBe(3);
    });

    it("should handle unlock required error", async () => {
      const mockConnection = { label: "test" };
      const zmkApp = {
        state: { connection: mockConnection },
        onNotification: jest.fn(() => jest.fn()),
      };

      // Return unlock required error
      mockCallRpc.mockResolvedValue({
        meta: { simpleError: 1 }, // UNLOCK_REQUIRED
      } as never);

      const { result } = renderHook(() => useKeymap(), {
        wrapper: createWrapper(zmkApp),
      });

      await waitFor(() => {
        expect(result.current.unlockRequired).toBe(true);
      });

      expect(result.current.error).toContain("unlock");
    });
  });

  describe("Binding Operations", () => {
    it("should check if binding is modified correctly", async () => {
      const mockConnection = { label: "test" };
      const zmkApp = {
        state: { connection: mockConnection },
        onNotification: jest.fn(() => jest.fn()),
      };

      // Setup mock responses for successful loading
      mockCallRpc.mockImplementation(async (_conn, req) => {
        if (req.keymap?.getPhysicalLayouts) {
          return {
            keymap: { getPhysicalLayouts: mockPhysicalLayouts },
          } as never;
        }
        if (req.keymap?.getKeymap) {
          return { keymap: { getKeymap: mockKeymap } } as never;
        }
        if (req.behaviors?.listAllBehaviors) {
          return {
            behaviors: { listAllBehaviors: { behaviors: mockBehaviors } },
          } as never;
        }
        if (req.behaviors?.getBehaviorDetails) {
          const id = req.behaviors.getBehaviorDetails.behaviorId;
          return {
            behaviors: { getBehaviorDetails: mockBehaviorDetails[id] },
          } as never;
        }
        if (req.keymap?.checkUnsavedChanges) {
          return { keymap: { checkUnsavedChanges: false } } as never;
        }
        return {} as never;
      });

      const { result } = renderHook(() => useKeymap(), {
        wrapper: createWrapper(zmkApp),
      });

      await waitFor(() => {
        expect(result.current.keymap).not.toBeNull();
      });

      // Initially, no bindings should be modified
      expect(result.current.isBindingModified(0, 0)).toBe(false);
      expect(result.current.isBindingModified(0, 1)).toBe(false);
    });

    it("should get original binding correctly", async () => {
      const mockConnection = { label: "test" };
      const zmkApp = {
        state: { connection: mockConnection },
        onNotification: jest.fn(() => jest.fn()),
      };

      mockCallRpc.mockImplementation(async (_conn, req) => {
        if (req.keymap?.getPhysicalLayouts) {
          return {
            keymap: { getPhysicalLayouts: mockPhysicalLayouts },
          } as never;
        }
        if (req.keymap?.getKeymap) {
          return { keymap: { getKeymap: mockKeymap } } as never;
        }
        if (req.behaviors?.listAllBehaviors) {
          return {
            behaviors: { listAllBehaviors: { behaviors: mockBehaviors } },
          } as never;
        }
        if (req.behaviors?.getBehaviorDetails) {
          const id = req.behaviors.getBehaviorDetails.behaviorId;
          return {
            behaviors: { getBehaviorDetails: mockBehaviorDetails[id] },
          } as never;
        }
        if (req.keymap?.checkUnsavedChanges) {
          return { keymap: { checkUnsavedChanges: false } } as never;
        }
        return {} as never;
      });

      const { result } = renderHook(() => useKeymap(), {
        wrapper: createWrapper(zmkApp),
      });

      await waitFor(() => {
        expect(result.current.keymap).not.toBeNull();
      });

      const original = result.current.getOriginalBinding(0, 0);
      expect(original).toEqual({ behaviorId: 1, param1: 0x04, param2: 0 });
    });
  });

  describe("Behavior Lookup", () => {
    it("should get behavior by ID", async () => {
      const mockConnection = { label: "test" };
      const zmkApp = {
        state: { connection: mockConnection },
        onNotification: jest.fn(() => jest.fn()),
      };

      mockCallRpc.mockImplementation(async (_conn, req) => {
        if (req.keymap?.getPhysicalLayouts) {
          return {
            keymap: { getPhysicalLayouts: mockPhysicalLayouts },
          } as never;
        }
        if (req.keymap?.getKeymap) {
          return { keymap: { getKeymap: mockKeymap } } as never;
        }
        if (req.behaviors?.listAllBehaviors) {
          return {
            behaviors: { listAllBehaviors: { behaviors: mockBehaviors } },
          } as never;
        }
        if (req.behaviors?.getBehaviorDetails) {
          const id = req.behaviors.getBehaviorDetails.behaviorId;
          return {
            behaviors: { getBehaviorDetails: mockBehaviorDetails[id] },
          } as never;
        }
        if (req.keymap?.checkUnsavedChanges) {
          return { keymap: { checkUnsavedChanges: false } } as never;
        }
        return {} as never;
      });

      const { result } = renderHook(() => useKeymap(), {
        wrapper: createWrapper(zmkApp),
      });

      await waitFor(() => {
        expect(result.current.behaviors.size).toBe(3);
      });

      const behavior = result.current.getBehavior(1);
      expect(behavior).toBeDefined();
      expect(behavior?.displayName).toBe("kp");
    });
  });

  describe("clearUnlockRequired", () => {
    it("should clear unlock required state", async () => {
      const mockConnection = { label: "test" };
      const zmkApp = {
        state: { connection: mockConnection },
        onNotification: jest.fn(() => jest.fn()),
      };

      mockCallRpc.mockResolvedValue({
        meta: { simpleError: 1 }, // UNLOCK_REQUIRED
      } as never);

      const { result } = renderHook(() => useKeymap(), {
        wrapper: createWrapper(zmkApp),
      });

      await waitFor(() => {
        expect(result.current.unlockRequired).toBe(true);
      });

      act(() => {
        result.current.clearUnlockRequired();
      });

      expect(result.current.unlockRequired).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });
});
