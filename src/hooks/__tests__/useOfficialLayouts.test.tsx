import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { ZMKAppContext } from "@cormoran/zmk-studio-react-hook";
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
    expect(result.current.error).toBeNull();
  });

  // Unlock handling now lives in the shared StudioUnlockProvider (see
  // StudioUnlockContext.test.tsx): a locked load is routed through
  // `runWithUnlock`, which opens the modal and retries after unlock rather than
  // surfacing an error on this hook.
  it("sets a generic error for non-unlock failures", async () => {
    mockCallRpc.mockRejectedValue(new Error("boom"));

    const { result } = renderHook(() => useOfficialLayouts(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.load();
    });

    expect(result.current.error).toBe("boom");
  });
});
