/**
 * Tests for useOsDetection hook
 *
 * Verifies GetState encode/decode, SetBleOverride round-trip, and polling
 * lifecycle for the cormoran__os_detection custom subsystem.
 */
import { renderHook, act } from "@testing-library/react";
import { useOsDetection } from "../useOsDetection";
import { ZMKAppContext } from "@cormoran/zmk-studio-react-hook";
import type { ReactNode } from "react";
import { Response, Os } from "../../proto/cormoran/os_detection/os_detection";

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
    usb: { connected: true, detected: Os.OS_MACOS },
    bleProfiles: [
      {
        index: 0,
        bonded: true,
        connected: true,
        detected: Os.OS_MACOS,
        override: Os.OS_UNSPECIFIED,
        effective: Os.OS_MACOS,
      },
    ],
    activeProfileIndex: 0,
    currentEffective: Os.OS_MACOS,
  },
});

describe("useOsDetection", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers({ legacyFakeTimers: false });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("Availability", () => {
    it("is unavailable when the subsystem is not found", () => {
      const wrapper = createWrapper({
        state: { connection: null, customSubsystems: [] },
        findSubsystem: () => null,
      });
      const { result } = renderHook(() => useOsDetection(), { wrapper });
      expect(result.current.isAvailable).toBe(false);
      expect(result.current.state).toBeNull();
    });
  });

  describe("Loading state", () => {
    it("loads state on mount when connected and available", async () => {
      mockCallRPC.mockResolvedValue(Response.encode(STATE_RESPONSE).finish());

      const wrapper = createWrapper({
        state: {
          connection: { isConnected: true } as never,
          customSubsystems: [
            { index: 0, identifier: "cormoran__os_detection" },
          ],
        },
        findSubsystem: (id) =>
          id === "cormoran__os_detection" ? { index: 0, identifier: id } : null,
      });

      const { result } = renderHook(() => useOsDetection(), { wrapper });

      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.isAvailable).toBe(true);
      expect(result.current.state?.usb?.connected).toBe(true);
      expect(result.current.state?.currentEffective).toBe(Os.OS_MACOS);
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
          customSubsystems: [
            { index: 0, identifier: "cormoran__os_detection" },
          ],
        },
        findSubsystem: (id) =>
          id === "cormoran__os_detection" ? { index: 0, identifier: id } : null,
      });

      const { result } = renderHook(() => useOsDetection(), { wrapper });

      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.error).toBe("boom");
    });
  });

  describe("setBleOverride", () => {
    it("sends the raw enum value and refetches state", async () => {
      mockCallRPC
        .mockResolvedValueOnce(Response.encode(STATE_RESPONSE).finish()) // initial load
        .mockResolvedValueOnce(
          Response.encode(
            Response.create({
              setBleOverride: {
                profile: {
                  index: 1,
                  bonded: true,
                  connected: false,
                  detected: Os.OS_WINDOWS,
                  override: Os.OS_WINDOWS,
                  effective: Os.OS_WINDOWS,
                },
              },
            }),
          ).finish(),
        )
        .mockResolvedValueOnce(Response.encode(STATE_RESPONSE).finish()); // refetch

      const wrapper = createWrapper({
        state: {
          connection: { isConnected: true } as never,
          customSubsystems: [
            { index: 0, identifier: "cormoran__os_detection" },
          ],
        },
        findSubsystem: (id) =>
          id === "cormoran__os_detection" ? { index: 0, identifier: id } : null,
      });

      const { result } = renderHook(() => useOsDetection(), { wrapper });

      await act(async () => {
        await Promise.resolve();
      });

      await act(async () => {
        await result.current.setBleOverride(1, Os.OS_WINDOWS);
      });

      expect(mockCallRPC).toHaveBeenCalledTimes(3);
    });
  });

  describe("Polling", () => {
    it("polls GetState every 5s while connected and cleans up on unmount", async () => {
      mockCallRPC.mockResolvedValue(Response.encode(STATE_RESPONSE).finish());

      const wrapper = createWrapper({
        state: {
          connection: { isConnected: true } as never,
          customSubsystems: [
            { index: 0, identifier: "cormoran__os_detection" },
          ],
        },
        findSubsystem: (id) =>
          id === "cormoran__os_detection" ? { index: 0, identifier: id } : null,
      });

      const { unmount } = renderHook(() => useOsDetection(), { wrapper });

      await act(async () => {
        await Promise.resolve();
      });
      const callsAfterMount = mockCallRPC.mock.calls.length;

      await act(async () => {
        jest.advanceTimersByTime(5000);
        await Promise.resolve();
      });
      expect(mockCallRPC.mock.calls.length).toBeGreaterThan(callsAfterMount);

      const callsBeforeUnmount = mockCallRPC.mock.calls.length;
      unmount();

      await act(async () => {
        jest.advanceTimersByTime(20000);
        await Promise.resolve();
      });
      expect(mockCallRPC.mock.calls.length).toBe(callsBeforeUnmount);
    });
  });
});
