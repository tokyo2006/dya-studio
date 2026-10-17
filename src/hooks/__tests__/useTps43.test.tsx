/**
 * Tests for useTps43 hook (tokyo2006__tps43 trackpad subsystem).
 *
 * The demo Tps43Handler stands in for firmware so requests round-trip through
 * the real protobuf codec.
 */
import { renderHook, act } from "@testing-library/react";
import { useTps43 } from "../useTps43";
import { ZMKAppContext } from "@cormoran/zmk-studio-react-hook";
import type { ReactNode } from "react";
import { Request, Response } from "../../proto/tokyo2006/tps43/tps43";
import { Tps43Handler } from "../../lib/transport/demo-tps43";
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

const SUBSYSTEM_ID = "tokyo2006__tps43";

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

describe("useTps43", () => {
  let handler: Tps43Handler;

  beforeEach(() => {
    jest.clearAllMocks();
    handler = new Tps43Handler();
    mockCallRPC.mockImplementation(async (payload: Uint8Array) =>
      Response.encode(handler.process(Request.decode(payload))).finish(),
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("is unavailable when the subsystem is not advertised", () => {
    const { result } = renderHook(() => useTps43(), {
      wrapper: wrapperFor(false),
    });
    expect(result.current.isAvailable).toBe(false);
    expect(result.current.values).toBeNull();
    expect(mockCallRPC).not.toHaveBeenCalled();
  });

  it("loads the device state on mount", async () => {
    const { result } = renderHook(() => useTps43(), {
      wrapper: wrapperFor(true),
    });
    await flushPromises();

    expect(result.current.isAvailable).toBe(true);
    expect(result.current.values?.pressAndHoldTime).toBe(250);
    expect(result.current.values?.bottomBeta).toBe(5);
    expect(result.current.values?.oneFingerTap).toBe(false);
    expect(sentRequests()[0].getState).toBeDefined();
  });

  it("shows edits immediately and writes them together after the debounce, persisted", async () => {
    jest.useFakeTimers();
    const { result } = renderHook(() => useTps43(), {
      wrapper: wrapperFor(true),
    });
    await flushPromises();
    mockCallRPC.mockClear();

    act(() => {
      result.current.update({ oneFingerTap: true });
      result.current.update({ bottomBeta: 10 });
    });
    expect(result.current.values?.oneFingerTap).toBe(true);
    expect(result.current.values?.bottomBeta).toBe(10);
    expect(result.current.writeState).toBe("queued");
    expect(mockCallRPC).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(MEMORY_WRITE_DEBOUNCE_MS);
    });
    await flushPromises();

    const [req] = sentRequests();
    expect(req.setState?.persist).toBe(true);
    expect(req.setState?.state?.oneFingerTap).toBe(true);
    expect(req.setState?.state?.bottomBeta).toBe(10);
    // Untouched fields are not sent.
    expect(req.setState?.state?.scroll).toBeUndefined();
    expect(result.current.writeState).toBe("idle");
    expect(result.current.state?.bottomBeta).toBe(10);
  });

  it("reset restores firmware defaults", async () => {
    jest.useFakeTimers();
    handler.process({
      setState: { state: { bottomBeta: 200 }, persist: true },
    });
    const { result } = renderHook(() => useTps43(), {
      wrapper: wrapperFor(true),
    });
    await flushPromises();
    expect(result.current.values?.bottomBeta).toBe(200);
    mockCallRPC.mockClear();

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
    expect(result.current.values?.bottomBeta).toBe(5);
  });
});
