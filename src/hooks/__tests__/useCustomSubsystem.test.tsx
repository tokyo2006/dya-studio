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
    const baseCall = jest.fn().mockResolvedValue(null);
    const baseCallRPC = jest.fn().mockResolvedValue(null);
    mockLibUseCustomSubsystem.mockReturnValue({
      subsystem: { index: 1, identifier: "x" },
      ready: true,
      call: baseCall,
      callRPC: baseCallRPC,
    });

    const { result } = renderHook(() =>
      useCustomSubsystem("x", {
        encode: () => new Uint8Array(),
        decode: () => ({}),
      }),
    );

    // wrapper forwards subsystem/ready
    expect(result.current.subsystem).toEqual({ index: 1, identifier: "x" });
    expect(result.current.ready).toBe(true);

    await result.current.call?.({ foo: 1 });
    expect(baseCall).toHaveBeenCalledWith(
      { foo: 1 },
      { timeout: DEFAULT_CUSTOM_SUBSYSTEM_TIMEOUT_MS },
    );

    const payload = new Uint8Array([1]);
    await result.current.callRPC(payload);
    expect(baseCallRPC).toHaveBeenCalledWith(payload, {
      timeout: DEFAULT_CUSTOM_SUBSYSTEM_TIMEOUT_MS,
    });
  });

  it("lets an explicit timeout override the default", async () => {
    const baseCall = jest.fn().mockResolvedValue(null);
    mockLibUseCustomSubsystem.mockReturnValue({
      subsystem: null,
      ready: false,
      call: baseCall,
      callRPC: jest.fn(),
    });

    const { result } = renderHook(() =>
      useCustomSubsystem("x", {
        encode: () => new Uint8Array(),
        decode: () => ({}),
      }),
    );

    await result.current.call?.({ foo: 1 }, { timeout: 1234 });
    expect(baseCall).toHaveBeenCalledWith({ foo: 1 }, { timeout: 1234 });
  });
});
