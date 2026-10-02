/**
 * Tests for useCirque hook (tokyo2006__cirque trackpad subsystem).
 *
 * The demo CirqueHandler stands in for firmware so requests round-trip
 * through the real protobuf codec.
 */
import { renderHook, act } from "@testing-library/react";
import { useCirque } from "../useCirque";
import { ZMKAppContext } from "@cormoran/zmk-studio-react-hook";
import type { ReactNode } from "react";
import { Request, Response } from "../../proto/tokyo2006/cirque/cirque";
import { CirqueHandler } from "../../lib/transport/demo-cirque";
import { MEMORY_WRITE_DEBOUNCE_MS } from "../useDebouncedMemoryWrite";

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

const SUBSYSTEM_ID = "tokyo2006__cirque";

function wrapperFor(available: boolean) {
  const value = {
    state: {
      connection: available ? ({ isConnected: true } as never) : null,
      customSubsystems: available
        ? [{ index: 1, identifier: SUBSYSTEM_ID }]
        : [],
    },
    findSubsystem: (id: string) =>
      available && id === SUBSYSTEM_ID ? { index: 1, identifier: id } : null,
  };
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <ZMKAppContext.Provider value={value as never}>
        {children}
      </ZMKAppContext.Provider>
    );
  };
}

function sentRequests(): Request[] {
  return mockCallRPC.mock.calls.map(([payload]) => Request.decode(payload));
}

async function flushPromises() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("useCirque", () => {
  let handler: CirqueHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    handler = new CirqueHandler();
    mockCallRPC.mockImplementation(async (payload: Uint8Array) =>
      Response.encode(handler.process(Request.decode(payload))).finish(),
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("is unavailable when the subsystem is not advertised", () => {
    const { result } = renderHook(() => useCirque(), {
      wrapper: wrapperFor(false),
    });
    expect(result.current.isAvailable).toBe(false);
    expect(result.current.values).toBeNull();
    expect(mockCallRPC).not.toHaveBeenCalled();
  });

  it("loads the device state on mount", async () => {
    const { result } = renderHook(() => useCirque(), {
      wrapper: wrapperFor(true),
    });
    await flushPromises();

    expect(result.current.isAvailable).toBe(true);
    expect(result.current.values?.tapMaxMs).toBe(250);
    expect(result.current.values?.primaryTapEnable).toBe(true);
    expect(sentRequests()[0].getState).toBeDefined();
  });

  it("shows edits immediately and writes them together after the debounce, persisted", async () => {
    jest.useFakeTimers();
    const { result } = renderHook(() => useCirque(), {
      wrapper: wrapperFor(true),
    });
    await flushPromises();
    mockCallRPC.mockClear();

    act(() => {
      result.current.update({ tapMaxMs: 300 });
      result.current.update({ invertX: true });
    });
    expect(result.current.values?.tapMaxMs).toBe(300);
    expect(result.current.values?.invertX).toBe(true);
    expect(result.current.writeState).toBe("queued");
    expect(mockCallRPC).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(MEMORY_WRITE_DEBOUNCE_MS);
    });
    await flushPromises();

    const [req] = sentRequests();
    expect(req.setState?.persist).toBe(true);
    expect(req.setState?.state?.tapMaxMs).toBe(300);
    expect(req.setState?.state?.invertX).toBe(true);
    // Untouched fields are not sent.
    expect(req.setState?.state?.scrollZone).toBeUndefined();
    expect(result.current.writeState).toBe("idle");
    expect(result.current.state?.tapMaxMs).toBe(300);
  });

  it("surfaces a firmware rejection and resyncs from the device", async () => {
    jest.useFakeTimers();
    const { result } = renderHook(() => useCirque(), {
      wrapper: wrapperFor(true),
    });
    await flushPromises();
    mockCallRPC.mockClear();

    act(() => {
      result.current.update({ rotateDegrees: 45 });
    });
    await act(async () => {
      jest.advanceTimersByTime(MEMORY_WRITE_DEBOUNCE_MS);
    });
    await flushPromises();

    expect(result.current.error).toBe("rotateDegrees failed (-22)");
    expect(
      sentRequests().map((r) =>
        Object.keys(r).find((k) => r[k as keyof Request]),
      ),
    ).toEqual(["setState", "getState"]);
    expect(result.current.values?.rotateDegrees).toBe(0);
  });

  it("reset drops queued edits and restores firmware defaults", async () => {
    jest.useFakeTimers();
    handler.process({ setState: { state: { tapMaxMs: 400 }, persist: true } });
    const { result } = renderHook(() => useCirque(), {
      wrapper: wrapperFor(true),
    });
    await flushPromises();
    expect(result.current.values?.tapMaxMs).toBe(400);
    mockCallRPC.mockClear();

    act(() => {
      result.current.update({ scrollZone: 10 });
    });
    let ok = false;
    await act(async () => {
      ok = await result.current.reset();
    });
    await act(async () => {
      jest.advanceTimersByTime(MEMORY_WRITE_DEBOUNCE_MS * 2);
    });

    expect(ok).toBe(true);
    const reqs = sentRequests();
    expect(reqs).toHaveLength(1);
    expect(reqs[0].reset?.factoryDefaults).toBe(true);
    expect(result.current.values?.tapMaxMs).toBe(250);
    expect(result.current.values?.scrollZone).toBe(80);
  });
});
