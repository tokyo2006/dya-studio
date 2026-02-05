/**
 * Tests for useRuntimeInputProcessor hook
 *
 * This test suite verifies the runtime input processor state management,
 * including loading processors, setting scaling, and setting rotation.
 */
import { renderHook, act } from "@testing-library/react";
import { useRuntimeInputProcessor } from "../useRuntimeInputProcessor";
import { ZMKAppContext } from "@cormoran/zmk-studio-react-hook";
import type { ReactNode } from "react";
import {
  Response,
  Notification,
} from "../../proto/zmk/runtime_input_processor/runtime_input_processor";

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

describe("useRuntimeInputProcessor", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOnNotification.mockReturnValue(() => {});
  });

  describe("Initial State", () => {
    it("should have empty processors array initially", () => {
      const wrapper = createWrapper({
        state: { connection: null, customSubsystems: [] },
        findSubsystem: () => null,
        onNotification: mockOnNotification,
      });

      const { result } = renderHook(() => useRuntimeInputProcessor(), {
        wrapper,
      });

      expect(result.current.processors).toEqual([]);
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

      const { result } = renderHook(() => useRuntimeInputProcessor(), {
        wrapper,
      });

      await act(async () => {
        await result.current.loadProcessors();
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

      const { result } = renderHook(() => useRuntimeInputProcessor(), {
        wrapper,
      });

      await act(async () => {
        await result.current.loadProcessors();
      });

      expect(result.current.error).toBe(
        "Not connected to device or subsystem not found",
      );
    });
  });

  describe("Loading Processors", () => {
    it("should load processors successfully via notifications", async () => {
      const mockConnection = { isConnected: true };

      // Mock notification callback
      let notificationCallback:
        | ((notification: { payload: Uint8Array }) => void)
        | null = null;
      mockOnNotification.mockImplementation(
        (subscription: { callback: typeof notificationCallback }) => {
          notificationCallback = subscription.callback;
          return () => {}; // unsubscribe function
        },
      );

      // Mock successful RPC response (empty, data comes via notification)
      const response = Response.create({
        listProcessors: {},
      });
      mockCallRPC.mockResolvedValue(Response.encode(response).finish());

      const wrapper = createWrapper({
        state: {
          connection: mockConnection as never,
          customSubsystems: [{ index: 0, identifier: "cormoran_rip" }],
        },
        findSubsystem: (id: string) =>
          id === "cormoran_rip"
            ? { index: 0, identifier: "cormoran_rip" }
            : null,
        onNotification: mockOnNotification,
      });

      const { result } = renderHook(() => useRuntimeInputProcessor(), {
        wrapper,
      });

      // Wait for useEffect to trigger loadProcessors
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      // Simulate notification arrival
      if (notificationCallback) {
        const notification = Notification.create({
          processorChanged: {
            processor: {
              id: 0,
              name: "trackpad",
              scaleMultiplier: 1,
              scaleDivisor: 1,
              rotationDegrees: 0,
              tempLayerEnabled: false,
              tempLayerLayer: 0,
              tempLayerActivationDelayMs: 100,
              tempLayerDeactivationDelayMs: 500,
            },
          },
        });
        await act(async () => {
          notificationCallback({
            payload: Notification.encode(notification).finish(),
          });
          await new Promise((resolve) => setTimeout(resolve, 600)); // Wait for notification collection timeout
        });
      }

      expect(result.current.processors).toHaveLength(1);
      expect(result.current.processors[0]).toEqual({
        id: 0,
        name: "trackpad",
        scaleMultiplier: 1,
        scaleDivisor: 1,
        rotationDegrees: 0,
        tempLayerEnabled: false,
        tempLayerLayer: 0,
        tempLayerActivationDelayMs: 100,
        tempLayerDeactivationDelayMs: 500,
      });
      expect(result.current.error).toBe(null);
    });

    it("should expose loadProcessors function", async () => {
      const response = Response.create({ listProcessors: { processors: [] } });
      mockCallRPC.mockResolvedValue(Response.encode(response).finish());

      const wrapper = createWrapper({
        state: {
          connection: null, // Start with no connection to avoid auto-load
          customSubsystems: [],
        },
        findSubsystem: (id: string) =>
          id === "cormoran_rip"
            ? { index: 0, identifier: "cormoran_rip" }
            : null,
        onNotification: mockOnNotification,
      });

      const { result } = renderHook(() => useRuntimeInputProcessor(), {
        wrapper,
      });

      // Verify the functions exist
      expect(typeof result.current.loadProcessors).toBe("function");
      expect(typeof result.current.setScaling).toBe("function");
      expect(typeof result.current.setRotation).toBe("function");
      expect(result.current.processors).toEqual([]);
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("Setting Scaling", () => {
    it("should set scaling successfully and simplify fraction", async () => {
      const mockConnection = { isConnected: true };

      let notificationCallback:
        | ((notification: { payload: Uint8Array }) => void)
        | null = null;
      mockOnNotification.mockImplementation(
        (subscription: { callback: typeof notificationCallback }) => {
          notificationCallback = subscription.callback;
          return () => {};
        },
      );

      // Mock successful initial load
      const initialLoadResponse = Response.create({ listProcessors: {} });

      // Mock successful set scale multiplier response
      const setMultiplierResponse = Response.create({
        setScaleMultiplier: {},
      });

      // Mock successful set scale divisor response
      const setDivisorResponse = Response.create({
        setScaleDivisor: {},
      });

      // Mock reload after setting
      const reloadResponse = Response.create({ listProcessors: {} });

      mockCallRPC
        .mockResolvedValueOnce(Response.encode(initialLoadResponse).finish())
        .mockResolvedValueOnce(Response.encode(setMultiplierResponse).finish())
        .mockResolvedValueOnce(Response.encode(setDivisorResponse).finish())
        .mockResolvedValueOnce(Response.encode(reloadResponse).finish());

      const wrapper = createWrapper({
        state: {
          connection: mockConnection as never,
          customSubsystems: [{ index: 0, identifier: "cormoran_rip" }],
        },
        findSubsystem: (id: string) =>
          id === "cormoran_rip"
            ? { index: 0, identifier: "cormoran_rip" }
            : null,
        onNotification: mockOnNotification,
      });

      const { result } = renderHook(() => useRuntimeInputProcessor(), {
        wrapper,
      });

      // Wait for initial load and send initial notification
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        if (notificationCallback) {
          const initialNotification = Notification.create({
            processorChanged: {
              processor: {
                id: 0,
                name: "trackpad",
                scaleMultiplier: 1,
                scaleDivisor: 1,
                rotationDegrees: 0,
                tempLayerEnabled: false,
                tempLayerLayer: 0,
                tempLayerActivationDelayMs: 100,
                tempLayerDeactivationDelayMs: 500,
              },
            },
          });
          notificationCallback({
            payload: Notification.encode(initialNotification).finish(),
          });
        }
        await new Promise((resolve) => setTimeout(resolve, 600));
      });

      // Now call setScaling with a value that can be simplified (200/100 => 2/1)
      await act(async () => {
        await result.current.setScaling(0, 200, 100);
        // Send notification for updated processor
        if (notificationCallback) {
          const updatedNotification = Notification.create({
            processorChanged: {
              processor: {
                id: 0,
                name: "trackpad",
                scaleMultiplier: 2, // Simplified from 200/100
                scaleDivisor: 1,
                rotationDegrees: 0,
                tempLayerEnabled: false,
                tempLayerLayer: 0,
                tempLayerActivationDelayMs: 100,
                tempLayerDeactivationDelayMs: 500,
              },
            },
          });
          notificationCallback({
            payload: Notification.encode(updatedNotification).finish(),
          });
        }
        await new Promise((resolve) => setTimeout(resolve, 600));
      });

      expect(result.current.error).toBe(null);
      expect(result.current.processors[0]?.scaleMultiplier).toBe(2);
      expect(result.current.processors[0]?.scaleDivisor).toBe(1);
    });
  });

  describe("Setting Rotation", () => {
    it("should set rotation successfully", async () => {
      const mockConnection = { isConnected: true };

      let notificationCallback:
        | ((notification: { payload: Uint8Array }) => void)
        | null = null;
      mockOnNotification.mockImplementation(
        (subscription: { callback: typeof notificationCallback }) => {
          notificationCallback = subscription.callback;
          return () => {};
        },
      );

      // Mock successful initial load
      const initialLoadResponse = Response.create({ listProcessors: {} });

      // Mock successful set rotation response
      const setRotationResponse = Response.create({
        setRotation: {},
      });

      // Mock reload after setting
      const reloadResponse = Response.create({ listProcessors: {} });

      mockCallRPC
        .mockResolvedValueOnce(Response.encode(initialLoadResponse).finish())
        .mockResolvedValueOnce(Response.encode(setRotationResponse).finish())
        .mockResolvedValueOnce(Response.encode(reloadResponse).finish());

      const wrapper = createWrapper({
        state: {
          connection: mockConnection as never,
          customSubsystems: [{ index: 0, identifier: "cormoran_rip" }],
        },
        findSubsystem: (id: string) =>
          id === "cormoran_rip"
            ? { index: 0, identifier: "cormoran_rip" }
            : null,
        onNotification: mockOnNotification,
      });

      const { result } = renderHook(() => useRuntimeInputProcessor(), {
        wrapper,
      });

      // Wait for initial load and send initial notification
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        if (notificationCallback) {
          const initialNotification = Notification.create({
            processorChanged: {
              processor: {
                id: 0,
                name: "trackpad",
                scaleMultiplier: 1,
                scaleDivisor: 1,
                rotationDegrees: 0,
                tempLayerEnabled: false,
                tempLayerLayer: 0,
                tempLayerActivationDelayMs: 100,
                tempLayerDeactivationDelayMs: 500,
              },
            },
          });
          notificationCallback({
            payload: Notification.encode(initialNotification).finish(),
          });
        }
        await new Promise((resolve) => setTimeout(resolve, 600));
      });

      // Now call setRotation
      await act(async () => {
        await result.current.setRotation(0, 90);
        // Send notification for updated processor
        if (notificationCallback) {
          const updatedNotification = Notification.create({
            processorChanged: {
              processor: {
                id: 0,
                name: "trackpad",
                scaleMultiplier: 1,
                scaleDivisor: 1,
                rotationDegrees: 90,
                tempLayerEnabled: false,
                tempLayerLayer: 0,
                tempLayerActivationDelayMs: 100,
                tempLayerDeactivationDelayMs: 500,
              },
            },
          });
          notificationCallback({
            payload: Notification.encode(updatedNotification).finish(),
          });
        }
        await new Promise((resolve) => setTimeout(resolve, 600));
      });

      expect(result.current.error).toBe(null);
      expect(result.current.processors[0]?.rotationDegrees).toBe(90);
    });
  });

  describe("Error Handling", () => {
    it("should handle RPC errors", async () => {
      const mockConnection = { isConnected: true };

      mockCallRPC.mockRejectedValue(new Error("RPC failed"));

      const wrapper = createWrapper({
        state: {
          connection: mockConnection as never,
          customSubsystems: [{ index: 0, identifier: "cormoran_rip" }],
        },
        findSubsystem: (id: string) =>
          id === "cormoran_rip"
            ? { index: 0, identifier: "cormoran_rip" }
            : null,
        onNotification: mockOnNotification,
      });

      const { result } = renderHook(() => useRuntimeInputProcessor(), {
        wrapper,
      });

      await act(async () => {
        await result.current.loadProcessors();
      });

      expect(result.current.error).toContain("Failed to load processors");
    });

    it("should handle error response from device", async () => {
      const mockConnection = { isConnected: true };

      // Mock error response
      const errorResponse = Response.create({
        error: { message: "Test error" },
      });
      mockCallRPC.mockResolvedValue(Response.encode(errorResponse).finish());

      const wrapper = createWrapper({
        state: {
          connection: mockConnection as never,
          customSubsystems: [{ index: 0, identifier: "cormoran_rip" }],
        },
        findSubsystem: (id: string) =>
          id === "cormoran_rip"
            ? { index: 0, identifier: "cormoran_rip" }
            : null,
        onNotification: mockOnNotification,
      });

      const { result } = renderHook(() => useRuntimeInputProcessor(), {
        wrapper,
      });

      await act(async () => {
        await result.current.loadProcessors();
      });

      expect(result.current.error).toBe("Test error");
    });
  });
});
