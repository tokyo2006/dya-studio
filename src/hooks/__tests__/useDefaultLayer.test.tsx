/**
 * Tests for useDefaultLayer hook
 *
 * Verifies GetState encode/decode, sentinel handling, and that set_* RPCs
 * apply the full refreshed state returned by the firmware directly (no
 * separate refetch) for the cormoran__default_layer custom subsystem.
 */
import { renderHook, act } from "@testing-library/react";
import { useDefaultLayer } from "../useDefaultLayer";
import { ZMKAppContext } from "@cormoran/zmk-studio-react-hook";
import type { ReactNode } from "react";
import { Response } from "../../proto/cormoran/default_layer/default_layer";

const mockCallRPC = jest.fn();

jest.mock("@cormoran/zmk-studio-react-hook", () => {
  const actual = jest.requireActual("@cormoran/zmk-studio-react-hook");
  const {
    createUseCustomSubsystemMock,
    // eslint-disable-next-line @typescript-eslint/no-require-imports
  } = require("../testUtils/mockUseCustomSubsystem");
  const ZMKCustomSubsystem = jest.fn().mockImplementation(() => ({
    callRPC: mockCallRPC,
  }));
  return {
    ...actual,
    ZMKCustomSubsystem,
    useCustomSubsystem: createUseCustomSubsystemMock(
      actual.ZMKAppContext,
      ZMKCustomSubsystem,
    ),
  };
});

function createWrapper(zmkAppValue: {
  state: { connection: unknown; customSubsystems: unknown[] };
  findSubsystem: (id: string) => { index: number; identifier: string } | null;
}) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <ZMKAppContext.Provider value={zmkAppValue as never}>
        {children}
      </ZMKAppContext.Provider>
    );
  };
}

const STATE_RESPONSE = Response.create({
  state: {
    endpoints: [
      { index: 1, isUsb: true, bleProfileIndex: 0, value: -2 },
      { index: 2, isUsb: false, bleProfileIndex: 0, value: -1 },
    ],
    osLayers: [
      { os: 0, value: -1 },
      { os: 2, value: 0 },
    ],
    activeEndpointIndex: 1,
    currentOs: 2,
    resolvedLayer: 0,
    layerCount: 3,
    osDetectionAvailable: true,
  },
});

const SUBSYSTEM_ID = "cormoran__default_layer";

describe("useDefaultLayer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Availability", () => {
    it("is unavailable when the subsystem is not found", () => {
      const wrapper = createWrapper({
        state: { connection: null, customSubsystems: [] },
        findSubsystem: () => null,
      });
      const { result } = renderHook(() => useDefaultLayer(), { wrapper });
      expect(result.current.isAvailable).toBe(false);
      expect(result.current.state).toBeNull();
    });
  });

  describe("Loading state", () => {
    it("loads state on mount, preserving sentinel values", async () => {
      mockCallRPC.mockResolvedValue(Response.encode(STATE_RESPONSE).finish());

      const wrapper = createWrapper({
        state: {
          connection: { isConnected: true } as never,
          customSubsystems: [{ index: 1, identifier: SUBSYSTEM_ID }],
        },
        findSubsystem: (id) =>
          id === SUBSYSTEM_ID ? { index: 1, identifier: id } : null,
      });

      const { result } = renderHook(() => useDefaultLayer(), { wrapper });

      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.isAvailable).toBe(true);
      expect(result.current.state?.endpoints[0].value).toBe(-2); // OS detection sentinel
      expect(result.current.state?.endpoints[1].value).toBe(-1); // unset sentinel
      expect(result.current.state?.layerCount).toBe(3);
    });

    it("surfaces an error response", async () => {
      mockCallRPC.mockResolvedValue(
        Response.encode(
          Response.create({ error: { message: "boom" } }),
        ).finish(),
      );

      const wrapper = createWrapper({
        state: {
          connection: { isConnected: true } as never,
          customSubsystems: [{ index: 1, identifier: SUBSYSTEM_ID }],
        },
        findSubsystem: (id) =>
          id === SUBSYSTEM_ID ? { index: 1, identifier: id } : null,
      });

      const { result } = renderHook(() => useDefaultLayer(), { wrapper });

      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.error).toBe("boom");
    });
  });

  describe("setEndpointLayer", () => {
    it("applies the full refreshed state from the response directly", async () => {
      mockCallRPC.mockResolvedValueOnce(
        Response.encode(STATE_RESPONSE).finish(),
      ); // initial load

      const updatedState = Response.create({
        state: {
          ...STATE_RESPONSE.state,
          endpoints: [
            { index: 1, isUsb: true, bleProfileIndex: 0, value: 1 },
            { index: 2, isUsb: false, bleProfileIndex: 0, value: -1 },
          ],
        },
      });
      mockCallRPC.mockResolvedValueOnce(Response.encode(updatedState).finish());

      const wrapper = createWrapper({
        state: {
          connection: { isConnected: true } as never,
          customSubsystems: [{ index: 1, identifier: SUBSYSTEM_ID }],
        },
        findSubsystem: (id) =>
          id === SUBSYSTEM_ID ? { index: 1, identifier: id } : null,
      });

      const { result } = renderHook(() => useDefaultLayer(), { wrapper });

      await act(async () => {
        await Promise.resolve();
      });

      await act(async () => {
        await result.current.setEndpointLayer(1, 1);
      });

      // Only 2 calls total: initial load + the set call (no extra refetch).
      expect(mockCallRPC).toHaveBeenCalledTimes(2);
      expect(result.current.state?.endpoints[0].value).toBe(1);
    });
  });

  describe("setOsLayer", () => {
    it("applies the full refreshed state from the response directly", async () => {
      mockCallRPC.mockResolvedValueOnce(
        Response.encode(STATE_RESPONSE).finish(),
      ); // initial load

      const updatedState = Response.create({
        state: {
          ...STATE_RESPONSE.state,
          osLayers: [
            { os: 0, value: -1 },
            { os: 2, value: 2 },
          ],
        },
      });
      mockCallRPC.mockResolvedValueOnce(Response.encode(updatedState).finish());

      const wrapper = createWrapper({
        state: {
          connection: { isConnected: true } as never,
          customSubsystems: [{ index: 1, identifier: SUBSYSTEM_ID }],
        },
        findSubsystem: (id) =>
          id === SUBSYSTEM_ID ? { index: 1, identifier: id } : null,
      });

      const { result } = renderHook(() => useDefaultLayer(), { wrapper });

      await act(async () => {
        await Promise.resolve();
      });

      await act(async () => {
        await result.current.setOsLayer(2, 2);
      });

      expect(mockCallRPC).toHaveBeenCalledTimes(2);
      expect(result.current.state?.osLayers[1].value).toBe(2);
    });
  });
});
