import { renderHook, waitFor } from "@testing-library/react";
import { ZMKAppContext } from "@cormoran/zmk-studio-react-hook";
import type { ReactNode } from "react";
import { useRuntimeCombo } from "../useRuntimeCombo";
import {
  Response,
  type Combo,
} from "../../proto/cormoran/runtime_combo/runtime_combo";

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
  state: {
    connection: unknown;
    customSubsystems: unknown[];
  };
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

describe("useRuntimeCombo", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("loads combos and global settings from the runtime combo subsystem", async () => {
    const combo: Combo = {
      index: 0,
      name: "Escape chord",
      keyPositions: [0, 1],
      behavior: { behaviorId: 10, param1: 0x29, param2: 0 },
      layerMask: 0,
      enabled: true,
    };

    mockCallRPC
      .mockResolvedValueOnce(
        Response.encode(
          Response.create({ listCombos: { combos: [combo] } }),
        ).finish(),
      )
      .mockResolvedValueOnce(
        Response.encode(
          Response.create({
            getGlobalSettings: {
              settings: { timeoutMs: 50, slowRelease: false, maxCombo: 16 },
            },
          }),
        ).finish(),
      );

    const wrapper = createWrapper({
      state: {
        connection: { isConnected: true },
        customSubsystems: [{ index: 7, identifier: "cormoran__runtime_combo" }],
      },
      findSubsystem: (id: string) =>
        id === "cormoran__runtime_combo"
          ? { index: 7, identifier: "cormoran__runtime_combo" }
          : null,
    });

    const { result } = renderHook(() => useRuntimeCombo(), { wrapper });

    await waitFor(() => expect(result.current.combos).toHaveLength(1));
    expect(result.current.isAvailable).toBe(true);
    expect(result.current.combos[0]).toEqual(combo);
    expect(result.current.globalSettings).toEqual({
      timeoutMs: 50,
      slowRelease: false,
      maxCombo: 16,
    });
    expect(result.current.error).toBe(null);
  });

  it("reports unavailable when the subsystem is missing", () => {
    const wrapper = createWrapper({
      state: { connection: { isConnected: true }, customSubsystems: [] },
      findSubsystem: () => null,
    });

    const { result } = renderHook(() => useRuntimeCombo(), { wrapper });

    expect(result.current.isAvailable).toBe(false);
    expect(result.current.combos).toEqual([]);
  });
});
