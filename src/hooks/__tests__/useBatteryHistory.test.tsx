/**
 * Tests for useBatteryHistory hook
 *
 * This test suite verifies the battery history state management,
 * including loading battery history from the device.
 */
import { renderHook, act } from "@testing-library/react";
import { useBatteryHistory } from "../useBatteryHistory";
import { ZMKAppContext } from "@cormoran/zmk-studio-react-hook";
import type { ReactNode } from "react";

// Mock ZMKCustomSubsystem
const mockCallRPC = jest.fn();
const mockOnNotification = jest.fn();

jest.mock("@cormoran/zmk-studio-react-hook", () => ({
  ...jest.requireActual("@cormoran/zmk-studio-react-hook"),
  ZMKCustomSubsystem: jest.fn().mockImplementation(() => ({
    callRPC: mockCallRPC,
  })),
}));

// Create a wrapper with ZMKAppContext
function createWrapper(zmkAppValue: {
  state: {
    connection: unknown;
    customSubsystems: unknown[];
  };
  findSubsystem: (id: string) => { index: number; identifier: string } | null;
  onNotification: (subscription: unknown) => () => void;
}) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <ZMKAppContext.Provider value={zmkAppValue as never}>
        {children}
      </ZMKAppContext.Provider>
    );
  };
}

describe("useBatteryHistory", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOnNotification.mockReturnValue(() => {});
  });

  describe("Initial State", () => {
    it("should have empty devices array initially", () => {
      const wrapper = createWrapper({
        state: { connection: null, customSubsystems: [] },
        findSubsystem: () => null,
        onNotification: mockOnNotification,
      });

      const { result } = renderHook(() => useBatteryHistory(), { wrapper });

      expect(result.current.devices).toEqual([]);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe(null);
    });
  });

  describe("Not Connected", () => {
    it("should set error when not connected", async () => {
      const wrapper = createWrapper({
        state: { connection: null, customSubsystems: [] },
        findSubsystem: () => null,
        onNotification: mockOnNotification,
      });

      const { result } = renderHook(() => useBatteryHistory(), { wrapper });

      await act(async () => {
        await result.current.loadBatteryHistory();
      });

      expect(result.current.error).toBe(
        "Not connected to device or subsystem not found",
      );
    });

    it("should set error when subsystem not found", async () => {
      const wrapper = createWrapper({
        state: {
          connection: { isConnected: true } as never,
          customSubsystems: [],
        },
        findSubsystem: () => null,
        onNotification: mockOnNotification,
      });

      const { result } = renderHook(() => useBatteryHistory(), { wrapper });

      await act(async () => {
        await result.current.loadBatteryHistory();
      });

      expect(result.current.error).toBe(
        "Not connected to device or subsystem not found",
      );
    });
  });

  describe("Loading Battery History", () => {
    it("should expose loadBatteryHistory function", async () => {
      // Mock successful RPC response (empty response)
      mockCallRPC.mockResolvedValue(new Uint8Array([10, 0]));

      const wrapper = createWrapper({
        state: {
          connection: null, // Start with no connection to avoid auto-load
          customSubsystems: [],
        },
        findSubsystem: (id: string) =>
          id === "zmk__battery_history"
            ? { index: 0, identifier: "zmk__battery_history" }
            : null,
        onNotification: mockOnNotification,
      });

      const { result } = renderHook(() => useBatteryHistory(), { wrapper });

      // Verify the function exists
      expect(typeof result.current.loadBatteryHistory).toBe("function");
      expect(typeof result.current.clearBatteryHistory).toBe("function");
      expect(result.current.devices).toEqual([]);
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("Clear Battery History", () => {
    it("should clear battery history", async () => {
      const mockConnection = { isConnected: true };

      // Mock successful clear response
      mockCallRPC.mockResolvedValue(
        new Uint8Array([18, 2, 8, 10]), // ClearBatteryHistoryResponse with entriesCleared: 10
      );

      const wrapper = createWrapper({
        state: {
          connection: mockConnection as never,
          customSubsystems: [{ index: 0, identifier: "zmk__battery_history" }],
        },
        findSubsystem: (id: string) =>
          id === "zmk__battery_history"
            ? { index: 0, identifier: "zmk__battery_history" }
            : null,
        onNotification: mockOnNotification,
      });

      const { result } = renderHook(() => useBatteryHistory(), { wrapper });

      await act(async () => {
        await result.current.clearBatteryHistory();
      });

      expect(result.current.devices).toEqual([]);
    });
  });

  describe("Error Handling", () => {
    it("should handle RPC errors", async () => {
      const mockConnection = { isConnected: true };

      mockCallRPC.mockRejectedValue(new Error("RPC failed"));

      const wrapper = createWrapper({
        state: {
          connection: mockConnection as never,
          customSubsystems: [{ index: 0, identifier: "zmk__battery_history" }],
        },
        findSubsystem: (id: string) =>
          id === "zmk__battery_history"
            ? { index: 0, identifier: "zmk__battery_history" }
            : null,
        onNotification: mockOnNotification,
      });

      const { result } = renderHook(() => useBatteryHistory(), { wrapper });

      await act(async () => {
        await result.current.loadBatteryHistory();
      });

      expect(result.current.error).toContain("Failed to load battery history");
    });
  });
});
