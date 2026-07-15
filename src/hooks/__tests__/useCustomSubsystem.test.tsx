import { renderHook } from "@testing-library/react";

const mockLibUseCustomSubsystem = jest.fn();
jest.mock("@cormoran/zmk-studio-react-hook", () => ({
  ...jest.requireActual("@cormoran/zmk-studio-react-hook"),
  useCustomSubsystem: (...args: unknown[]) =>
    mockLibUseCustomSubsystem(...args),
}));

import {
  useCustomSubsystem,
  DEFAULT_CUSTOM_SUBSYSTEM_TIMEOUT_MS,
} from "../useCustomSubsystem";

beforeEach(() => jest.clearAllMocks());

describe("useCustomSubsystem timeout wrapper", () => {
  it("injects the default timeout into call() and callRPC()", async () => {
    // call() is reimplemented as encode → callRPC → decode (so it can log the
    // raw byte sizes), so it drives baseCallRPC rather than base.call.
    const responsePayload = new Uint8Array([7]);
    const baseCallRPC = jest.fn().mockResolvedValue(responsePayload);
    const encode = jest.fn(() => new Uint8Array([9]));
    const decode = jest.fn(() => ({ decoded: true }));
    mockLibUseCustomSubsystem.mockReturnValue({
      subsystem: { index: 1, identifier: "x" },
      ready: true,
      call: jest.fn(), // presence signals a codec was provided
      callRPC: baseCallRPC,
    });

    const { result } = renderHook(() =>
      useCustomSubsystem("x", { encode, decode }),
    );

    // wrapper forwards subsystem/ready
    expect(result.current.subsystem).toEqual({ index: 1, identifier: "x" });
    expect(result.current.ready).toBe(true);

    const decoded = await result.current.call?.({ foo: 1 });
    expect(encode).toHaveBeenCalledWith({ foo: 1 });
    expect(baseCallRPC).toHaveBeenCalledWith(new Uint8Array([9]), {
      timeout: DEFAULT_CUSTOM_SUBSYSTEM_TIMEOUT_MS,
    });
    expect(decode).toHaveBeenCalledWith(responsePayload);
    expect(decoded).toEqual({ decoded: true });

    baseCallRPC.mockClear();
    const payload = new Uint8Array([1]);
    await result.current.callRPC(payload);
    expect(baseCallRPC).toHaveBeenCalledWith(payload, {
      timeout: DEFAULT_CUSTOM_SUBSYSTEM_TIMEOUT_MS,
    });
  });

  it("lets an explicit timeout override the default", async () => {
    const baseCallRPC = jest.fn().mockResolvedValue(null);
    mockLibUseCustomSubsystem.mockReturnValue({
      subsystem: null,
      ready: false,
      call: jest.fn(), // presence signals a codec was provided
      callRPC: baseCallRPC,
    });

    const { result } = renderHook(() =>
      useCustomSubsystem("x", {
        encode: () => new Uint8Array([9]),
        decode: () => ({}),
      }),
    );

    await result.current.call?.({ foo: 1 }, { timeout: 1234 });
    expect(baseCallRPC).toHaveBeenCalledWith(new Uint8Array([9]), {
      timeout: 1234,
    });
  });

  it("returns null from call() without decoding when the device sends no payload", async () => {
    const baseCallRPC = jest.fn().mockResolvedValue(null);
    const decode = jest.fn();
    mockLibUseCustomSubsystem.mockReturnValue({
      subsystem: { index: 1, identifier: "x" },
      ready: true,
      call: jest.fn(),
      callRPC: baseCallRPC,
    });

    const { result } = renderHook(() =>
      useCustomSubsystem("x", { encode: () => new Uint8Array([9]), decode }),
    );

    const decoded = await result.current.call?.({ foo: 1 });
    expect(decoded).toBeNull();
    expect(decode).not.toHaveBeenCalled();
  });
});
