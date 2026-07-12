/**
 * Tests for KscanDiagnosticsSection: summary badge, lazy topology fetch on
 * first expand, and the interactive keyboard preview wiring.
 */
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { KscanDiagnosticsSection } from "../KscanDiagnosticsSection";
import { useOfficialLayouts } from "../../../hooks/useOfficialLayouts";
import type { UseKscanDiagnosticsReturn } from "../../../hooks/useKscanDiagnostics";
import { KscanDriverType } from "../../../proto/cormoran/kscan_diagnostics/kscan_diagnostics";

jest.mock("../../../hooks/useOfficialLayouts");

const mockUseOfficialLayouts = useOfficialLayouts as jest.MockedFunction<
  typeof useOfficialLayouts
>;

function baseKscan(
  overrides: Partial<UseKscanDiagnosticsReturn> = {},
): UseKscanDiagnosticsReturn {
  return {
    isAvailable: true,
    info: {
      protoVersion: 1,
      layoutCount: 1,
      selectedLayout: 0,
      deviceCount: 1,
      statsEnabled: true,
      maxPositions: 4,
      uptimeMs: 1000,
    },
    devices: [
      {
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
    ],
    stats: [],
    isLoading: false,
    error: null,
    refresh: jest.fn(),
    resetStats: jest.fn(),
    topology: null,
    isLoadingTopology: false,
    topologyError: null,
    loadTopology: jest.fn(),
    peripheralTopologies: new Map(),
    isLoadingPeripheralTopologies: false,
    peripheralTopologyErrors: new Map(),
    peripheralDiscoveryError: null,
    loadPeripheralTopologies: jest.fn(),
    ...overrides,
  };
}

function mockOfficialLayoutsReturn(
  overrides: Partial<ReturnType<typeof useOfficialLayouts>> = {},
) {
  mockUseOfficialLayouts.mockReturnValue({
    physicalLayouts: null,
    isLoading: false,
    unlockRequired: false,
    error: null,
    load: jest.fn(),
    ...overrides,
  });
}

describe("KscanDiagnosticsSection", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOfficialLayoutsReturn();
  });

  it("shows an OK summary badge with no suspect keys", () => {
    render(
      <KscanDiagnosticsSection
        kscan={baseKscan({
          stats: [
            {
              position: 0,
              presses: 5,
              releases: 5,
              minPressDurationMs: 20,
              minRepressGapMs: 200,
              repressLt5: 0,
              repressLt10: 0,
              repressLt20: 0,
              repressLt50: 0,
              lastSource: 0,
            },
          ],
        })}
      />,
    );
    expect(screen.getByText("OK")).toBeInTheDocument();
  });

  it("shows a suspect-keys summary badge when stats.json has chatter", () => {
    render(
      <KscanDiagnosticsSection
        kscan={baseKscan({
          stats: [
            {
              position: 0,
              presses: 5,
              releases: 5,
              minPressDurationMs: 20,
              minRepressGapMs: 3,
              repressLt5: 0,
              repressLt10: 2,
              repressLt20: 2,
              repressLt50: 2,
              lastSource: 0,
            },
          ],
        })}
      />,
    );
    expect(screen.getByText("1 suspect keys")).toBeInTheDocument();
  });

  it("does not call loadTopology before the section is expanded", () => {
    const loadTopology = jest.fn();
    render(<KscanDiagnosticsSection kscan={baseKscan({ loadTopology })} />);
    expect(loadTopology).not.toHaveBeenCalled();
  });

  it("calls loadTopology, loadPeripheralTopologies, and the official layouts loader on first expand", async () => {
    const loadTopology = jest.fn();
    const loadPeripheralTopologies = jest.fn();
    const load = jest.fn();
    mockOfficialLayoutsReturn({ load });

    render(
      <KscanDiagnosticsSection
        kscan={baseKscan({ loadTopology, loadPeripheralTopologies })}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Key Switches" }));

    await waitFor(() => expect(loadTopology).toHaveBeenCalledTimes(1));
    expect(loadPeripheralTopologies).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("does not re-fetch topology on subsequent expand/collapse cycles", async () => {
    const loadTopology = jest.fn();
    render(<KscanDiagnosticsSection kscan={baseKscan({ loadTopology })} />);

    const header = screen.getByRole("button", { name: "Key Switches" });
    fireEvent.click(header); // expand
    await waitFor(() => expect(loadTopology).toHaveBeenCalledTimes(1));
    fireEvent.click(header); // collapse
    fireEvent.click(header); // expand again
    expect(loadTopology).toHaveBeenCalledTimes(1);
  });

  it("renders the keyboard preview once topology and physical layout are loaded", () => {
    mockOfficialLayoutsReturn({
      physicalLayouts: {
        activeLayoutIndex: 0,
        layouts: [
          {
            name: "test",
            keys: [{ width: 100, height: 100, x: 0, y: 0, r: 0, rx: 0, ry: 0 }],
          },
        ],
      },
    });

    render(
      <KscanDiagnosticsSection
        kscan={baseKscan({
          topology: {
            protoVersion: 1,
            selectedLayout: 0,
            statsEnabled: true,
            maxPositions: 1,
            uptimeMs: 0,
            devices: [
              {
                deviceIndex: 0,
                nodeName: "kscan0",
                type: KscanDriverType.MATRIX,
                rows: 1,
                columns: 1,
                inputs: 0,
                debouncePressMs: 5,
                debounceReleaseMs: 5,
                debounceScanPeriodMs: 1,
                pollPeriodMs: 0,
                diodeRow2col: true,
                toggleMode: false,
                gpioLinesByKind: {} as never,
              },
            ],
            layouts: [
              {
                layoutIndex: 0,
                displayName: "test",
                rows: 1,
                columns: 1,
                keyCount: 1,
                deviceIndices: [{ leafIndex: 0, rowOffset: 0, colOffset: 0 }],
                positionMap: [0],
              },
            ],
          },
        })}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Key Switches" }));
    expect(screen.getByTestId("kscan-key-0")).toBeInTheDocument();
  });

  it("shows an unlock hint when the official layout requires unlocking", () => {
    mockOfficialLayoutsReturn({ unlockRequired: true });
    render(<KscanDiagnosticsSection kscan={baseKscan()} />);
    fireEvent.click(screen.getByRole("button", { name: "Key Switches" }));
    expect(
      screen.getByText("Unlock your keyboard to show the interactive key map."),
    ).toBeInTheDocument();
  });

  it("does not render the external diagnostics link (removed)", () => {
    render(<KscanDiagnosticsSection kscan={baseKscan()} />);
    fireEvent.click(screen.getByRole("button", { name: "Key Switches" }));
    expect(
      screen.queryByText("Open the dedicated diagnostics UI for deep analysis"),
    ).not.toBeInTheDocument();
  });
});
