import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { ZMKAppContext } from "@cormoran/zmk-studio-react-hook";
import { MetaError } from "@zmkfirmware/zmk-studio-ts-client";
import { ErrorConditions } from "@zmkfirmware/zmk-studio-ts-client/meta";
import { useOfficialLayouts } from "../useOfficialLayouts";

const mockCallRpc = jest.fn();

jest.mock("@zmkfirmware/zmk-studio-ts-client", () => ({
  ...jest.requireActual("@zmkfirmware/zmk-studio-ts-client"),
  call_rpc: (...args: unknown[]) => mockCallRpc(...args),
}));

function createWrapper() {
  const zmkAppValue = {
    // No custom subsystems -> useKeymapSource falls back to the official
    // keymap protocol, which is what these tests exercise.
    state: { connection: {}, deviceInfo: null },
    findSubsystem: () => null,
  };
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <ZMKAppContext.Provider value={zmkAppValue as never}>
        {children}
      </ZMKAppContext.Provider>
    );
  };
}

describe("useOfficialLayouts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("loads physical layouts via keymap.getPhysicalLayouts", async () => {
    mockCallRpc.mockResolvedValue({
      keymap: {
        getPhysicalLayouts: {
          activeLayoutIndex: 0,
          layouts: [{ name: "test", keys: [] }],
        },
      },
    });

    const { result } = renderHook(() => useOfficialLayouts(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.load();
    });

    expect(result.current.physicalLayouts?.layouts).toHaveLength(1);
    expect(result.current.unlockRequired).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("sets unlockRequired on an UNLOCK_REQUIRED MetaError", async () => {
    mockCallRpc.mockRejectedValue(
      new MetaError(ErrorConditions.UNLOCK_REQUIRED),
    );

    const { result } = renderHook(() => useOfficialLayouts(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.load();
    });

    await waitFor(() => expect(result.current.unlockRequired).toBe(true));
    expect(result.current.physicalLayouts).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("sets a generic error for other failures", async () => {
    mockCallRpc.mockRejectedValue(new Error("boom"));

    const { result } = renderHook(() => useOfficialLayouts(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.load();
    });

    expect(result.current.error).toBe("boom");
    expect(result.current.unlockRequired).toBe(false);
  });
});
