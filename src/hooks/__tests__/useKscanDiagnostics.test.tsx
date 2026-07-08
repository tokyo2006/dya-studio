import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import {
  ZMKAppContext,
  ZMKCustomSubsystem,
} from "@cormoran/zmk-studio-react-hook";
import { useKscanDiagnostics } from "../useKscanDiagnostics";
import {
  GpioLineKind,
  KscanDriverType,
  Request,
  Response,
} from "../../proto/cormoran/kscan_diagnostics/kscan_diagnostics";

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

function createWrapper() {
  const zmkAppValue = {
    state: { connection: {}, customSubsystems: [] },
    findSubsystem: () => ({
      index: 11,
      identifier: "cormoran__kscan_diagnostics",
    }),
    onNotification: () => () => {},
  };
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <ZMKAppContext.Provider value={zmkAppValue as never}>
        {children}
      </ZMKAppContext.Provider>
    );
  };
}

function encodeResponse(response: Parameters<typeof Response.create>[0]) {
  return Response.encode(Response.create(response)).finish();
}

describe("useKscanDiagnostics topology loading", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Auto-fetch on mount (refresh()): GetInfo -> no devices needed since
    // deviceCount is 0 for this simplified scenario, then GetStats.
    mockCallRPC.mockImplementation(async (payload: Uint8Array) => {
      const req = Request.decode(payload);
      if (req.getInfo !== undefined) {
        return encodeResponse({
          info: {
            protoVersion: 1,
            layoutCount: 1,
            selectedLayout: 0,
            deviceCount: 1,
            statsEnabled: false,
            maxPositions: 4,
            uptimeMs: 100,
          },
        });
      }
      if (req.getDevice !== undefined) {
        return encodeResponse({
          device: {
            deviceIndex: 0,
            nodeName: "kscan0",
            type: KscanDriverType.MATRIX,
            rows: 2,
            columns: 2,
            inputs: 0,
            debouncePressMs: 5,
            debounceReleaseMs: 5,
            debounceScanPeriodMs: 1,
            pollPeriodMs: 0,
            diodeRow2col: true,
            toggleMode: false,
          },
        });
      }
      if (req.getLayout !== undefined) {
        return encodeResponse({
          layout: {
            layoutIndex: 0,
            displayName: "test",
            rows: 2,
            columns: 2,
            keyCount: 4,
            deviceIndices: [{ leafIndex: 0, rowOffset: 0, colOffset: 0 }],
          },
        });
      }
      if (req.getPositionMap !== undefined) {
        return encodeResponse({
          positionMap: { total: 4, offset: 0, cells: [1, 2, 3, 4] },
        });
      }
      if (req.getGpioPins !== undefined) {
        const { kind } = req.getGpioPins;
        if (kind === GpioLineKind.ROW) {
          return encodeResponse({
            gpioPins: {
              total: 2,
              offset: 0,
              pins: [
                {
                  index: 0,
                  port: "gpio0",
                  pin: 4,
                  activeLow: false,
                  dtFlags: 0,
                },
                {
                  index: 1,
                  port: "gpio0",
                  pin: 5,
                  activeLow: false,
                  dtFlags: 0,
                },
              ],
            },
          });
        }
        if (kind === GpioLineKind.COL) {
          return encodeResponse({
            gpioPins: {
              total: 2,
              offset: 0,
              pins: [
                {
                  index: 0,
                  port: "gpio1",
                  pin: 0,
                  activeLow: false,
                  dtFlags: 0,
                },
                {
                  index: 1,
                  port: "gpio1",
                  pin: 1,
                  activeLow: false,
                  dtFlags: 0,
                },
              ],
            },
          });
        }
        return encodeResponse({ gpioPins: { total: 0, offset: 0, pins: [] } });
      }
      if (req.getStats !== undefined) {
        return encodeResponse({ stats: { total: 0, offset: 0, entries: [] } });
      }
      return encodeResponse({ error: { message: "unhandled" } });
    });
  });

  it("does not fetch topology automatically (lazy)", async () => {
    const { result } = renderHook(() => useKscanDiagnostics(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.info).not.toBeNull());
    expect(result.current.topology).toBeNull();
  });

  it("loadTopology assembles layouts, devices, and gpio lines", async () => {
    const { result } = renderHook(() => useKscanDiagnostics(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.info).not.toBeNull());

    await act(async () => {
      await result.current.loadTopology();
    });

    expect(result.current.topology).not.toBeNull();
    const topology = result.current.topology!;
    expect(topology.layouts).toHaveLength(1);
    expect(topology.layouts[0].positionMap).toEqual([0, 1, 2, 3]);
    expect(topology.devices).toHaveLength(1);
    expect(topology.devices[0].gpioLinesByKind[GpioLineKind.ROW]).toHaveLength(
      2,
    );
    expect(topology.devices[0].gpioLinesByKind[GpioLineKind.COL]).toHaveLength(
      2,
    );
    expect(result.current.isLoadingTopology).toBe(false);
    expect(result.current.topologyError).toBeNull();
  });

  it("reports a topology error without clobbering info/stats state", async () => {
    mockCallRPC.mockImplementation(async (payload: Uint8Array) => {
      const req = Request.decode(payload);
      if (req.getInfo !== undefined) {
        return encodeResponse({
          info: {
            protoVersion: 1,
            layoutCount: 1,
            selectedLayout: 0,
            deviceCount: 0,
            statsEnabled: false,
            maxPositions: 0,
            uptimeMs: 0,
          },
        });
      }
      if (req.getLayout !== undefined) {
        return encodeResponse({ error: { message: "boom" } });
      }
      if (req.getStats !== undefined) {
        return encodeResponse({ stats: { total: 0, offset: 0, entries: [] } });
      }
      return encodeResponse({ error: { message: "unhandled" } });
    });

    const { result } = renderHook(() => useKscanDiagnostics(), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.info).not.toBeNull());

    await act(async () => {
      await result.current.loadTopology();
    });

    expect(result.current.topology).toBeNull();
    expect(result.current.topologyError).toBe("boom");
    // The unrelated info state is untouched.
    expect(result.current.info?.deviceCount).toBe(0);
  });
});

// Keep ZMKCustomSubsystem import referenced (mocked above) to satisfy
// lint's no-unused-vars for the mocked module import.
void ZMKCustomSubsystem;
