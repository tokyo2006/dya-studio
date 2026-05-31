import { renderHook, waitFor } from "@testing-library/react";
import {
  ZMKAppContext,
  ZMKCustomSubsystem,
} from "@cormoran/zmk-studio-react-hook";
import type { ReactNode } from "react";
import {
  PHYSICAL_LAYOUTS_IDENTIFIER,
  LEGACY_PHYSICAL_LAYOUTS_IDENTIFIER,
  usePhysicalLayoutModules,
} from "../usePhysicalLayoutModules";
import { Response } from "../../proto/zmk/physical_layouts/physical_layouts";

const mockCallRPC = jest.fn();

jest.mock("@cormoran/zmk-studio-react-hook", () => ({
  ...jest.requireActual("@cormoran/zmk-studio-react-hook"),
  ZMKCustomSubsystem: jest.fn().mockImplementation(() => ({
    callRPC: mockCallRPC,
  })),
}));

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

describe("usePhysicalLayoutModules", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCallRPC.mockResolvedValue(
      Response.encode(
        Response.create({
          physicalLayout: {
            devices: [],
            rotaryEncoders: [],
          },
        }),
      ).finish(),
    );
  });

  it("uses the current cormoran subsystem identifier when available", async () => {
    const connection = { isConnected: true };
    const findSubsystem = jest.fn((id: string) =>
      id === PHYSICAL_LAYOUTS_IDENTIFIER
        ? { index: 7, identifier: PHYSICAL_LAYOUTS_IDENTIFIER }
        : null,
    );

    const wrapper = createWrapper({
      state: {
        connection,
        customSubsystems: [
          { index: 7, identifier: PHYSICAL_LAYOUTS_IDENTIFIER },
        ],
      },
      findSubsystem,
    });

    const { result } = renderHook(() => usePhysicalLayoutModules(), {
      wrapper,
    });

    await waitFor(() => expect(mockCallRPC).toHaveBeenCalled());

    expect(result.current.isAvailable).toBe(true);
    expect(ZMKCustomSubsystem).toHaveBeenCalledWith(connection, 7);
    expect(findSubsystem).toHaveBeenCalledWith(PHYSICAL_LAYOUTS_IDENTIFIER);
    expect(findSubsystem).not.toHaveBeenCalledWith(
      LEGACY_PHYSICAL_LAYOUTS_IDENTIFIER,
    );
  });

  it("falls back to the legacy zmk subsystem identifier", async () => {
    const connection = { isConnected: true };
    const findSubsystem = jest.fn((id: string) =>
      id === LEGACY_PHYSICAL_LAYOUTS_IDENTIFIER
        ? { index: 4, identifier: LEGACY_PHYSICAL_LAYOUTS_IDENTIFIER }
        : null,
    );

    const wrapper = createWrapper({
      state: {
        connection,
        customSubsystems: [
          { index: 4, identifier: LEGACY_PHYSICAL_LAYOUTS_IDENTIFIER },
        ],
      },
      findSubsystem,
    });

    const { result } = renderHook(() => usePhysicalLayoutModules(), {
      wrapper,
    });

    await waitFor(() => expect(mockCallRPC).toHaveBeenCalled());

    expect(result.current.isAvailable).toBe(true);
    expect(ZMKCustomSubsystem).toHaveBeenCalledWith(connection, 4);
    expect(findSubsystem).toHaveBeenCalledWith(PHYSICAL_LAYOUTS_IDENTIFIER);
    expect(findSubsystem).toHaveBeenCalledWith(
      LEGACY_PHYSICAL_LAYOUTS_IDENTIFIER,
    );
  });
});
