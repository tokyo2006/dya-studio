import {
  buildWiringMap,
  colorForLine,
  GpioLineKind,
  KscanDriverType,
  resolveDeviceForCell,
  resolveRowColLines,
  type KscanDevice,
  type KscanLayout,
  type Topology,
} from "../kscanTopology";
import type { GpioPin } from "../../proto/cormoran/kscan_diagnostics/kscan_diagnostics";

function gpio(port: string, pin: number): GpioPin {
  return { index: 0, port, pin, activeLow: false, dtFlags: 0 };
}

function matrixDevice(
  deviceIndex: number,
  rows: number,
  columns: number,
): KscanDevice {
  const rowLines = Array.from({ length: rows }, (_, i) => gpio("gpio0", i));
  const colLines = Array.from({ length: columns }, (_, i) => gpio("gpio1", i));
  return {
    deviceIndex,
    nodeName: `kscan${deviceIndex}`,
    type: KscanDriverType.MATRIX,
    rows,
    columns,
    inputs: 0,
    debouncePressMs: 5,
    debounceReleaseMs: 5,
    debounceScanPeriodMs: 1,
    pollPeriodMs: 0,
    diodeRow2col: true,
    toggleMode: false,
    gpioLinesByKind: {
      [GpioLineKind.KIND_UNKNOWN]: [],
      [GpioLineKind.ROW]: rowLines,
      [GpioLineKind.COL]: colLines,
      [GpioLineKind.INPUT]: [],
      [GpioLineKind.OUTPUT]: [],
      [GpioLineKind.CHARLIE]: [],
    },
  };
}

describe("resolveDeviceForCell", () => {
  it("resolves a single-device layout with no offset", () => {
    const device = matrixDevice(0, 4, 12);
    const topology: Topology = {
      protoVersion: 1,
      selectedLayout: 0,
      statsEnabled: true,
      maxPositions: 48,
      uptimeMs: 0,
      devices: [device],
      layouts: [],
    };
    const layout: KscanLayout = {
      layoutIndex: 0,
      displayName: "test",
      rows: 4,
      columns: 12,
      keyCount: 48,
      deviceIndices: [{ leafIndex: 0, rowOffset: 0, colOffset: 0 }],
      positionMap: [],
    };

    const resolved = resolveDeviceForCell(topology, layout, 2, 5);
    expect(resolved?.device.deviceIndex).toBe(0);
    expect(resolved?.localRow).toBe(2);
    expect(resolved?.localCol).toBe(5);
  });

  it("resolves a composite layout by subtracting the device's offset", () => {
    const left = matrixDevice(0, 4, 6);
    const right = matrixDevice(1, 4, 6);
    const topology: Topology = {
      protoVersion: 1,
      selectedLayout: 0,
      statsEnabled: true,
      maxPositions: 96,
      uptimeMs: 0,
      devices: [left, right],
      layouts: [],
    };
    const layout: KscanLayout = {
      layoutIndex: 0,
      displayName: "split",
      rows: 4,
      columns: 12,
      keyCount: 96,
      deviceIndices: [
        { leafIndex: 0, rowOffset: 0, colOffset: 0 },
        { leafIndex: 1, rowOffset: 0, colOffset: 6 },
      ],
      positionMap: [],
    };

    // Cell in the right half.
    const resolved = resolveDeviceForCell(topology, layout, 1, 8);
    expect(resolved?.device.deviceIndex).toBe(1);
    expect(resolved?.localRow).toBe(1);
    expect(resolved?.localCol).toBe(2);
  });

  it("returns null when no device covers the cell", () => {
    const device = matrixDevice(0, 2, 2);
    const topology: Topology = {
      protoVersion: 1,
      selectedLayout: 0,
      statsEnabled: true,
      maxPositions: 4,
      uptimeMs: 0,
      devices: [device],
      layouts: [],
    };
    const layout: KscanLayout = {
      layoutIndex: 0,
      displayName: "test",
      rows: 2,
      columns: 2,
      keyCount: 4,
      deviceIndices: [{ leafIndex: 0, rowOffset: 0, colOffset: 0 }],
      positionMap: [],
    };

    expect(resolveDeviceForCell(topology, layout, 5, 5)).toBeNull();
  });
});

describe("resolveRowColLines", () => {
  it("resolves matrix row/col lines independently", () => {
    const device = matrixDevice(0, 4, 12);
    const { rowLine, colLine } = resolveRowColLines(device, 1, 3);
    expect(rowLine).toEqual(gpio("gpio0", 1));
    expect(colLine).toEqual(gpio("gpio1", 3));
  });

  it("resolves charlieplex row/col from the shared CHARLIE line list", () => {
    const shared = [gpio("gpio0", 0), gpio("gpio0", 1), gpio("gpio0", 2)];
    const device: KscanDevice = {
      ...matrixDevice(0, 3, 3),
      type: KscanDriverType.CHARLIEPLEX,
      gpioLinesByKind: {
        [GpioLineKind.KIND_UNKNOWN]: [],
        [GpioLineKind.ROW]: [],
        [GpioLineKind.COL]: [],
        [GpioLineKind.INPUT]: [],
        [GpioLineKind.OUTPUT]: [],
        [GpioLineKind.CHARLIE]: shared,
      },
    };
    const { rowLine, colLine } = resolveRowColLines(device, 0, 2);
    expect(rowLine).toEqual(shared[0]);
    expect(colLine).toEqual(shared[2]);
  });

  it("resolves direct input-as-row with no column line", () => {
    const inputs = [gpio("gpio2", 0), gpio("gpio2", 1)];
    const device: KscanDevice = {
      ...matrixDevice(0, 2, 0),
      type: KscanDriverType.DIRECT,
      gpioLinesByKind: {
        [GpioLineKind.KIND_UNKNOWN]: [],
        [GpioLineKind.ROW]: [],
        [GpioLineKind.COL]: [],
        [GpioLineKind.INPUT]: inputs,
        [GpioLineKind.OUTPUT]: [],
        [GpioLineKind.CHARLIE]: [],
      },
    };
    const { rowLine, colLine } = resolveRowColLines(device, 1, 0);
    expect(rowLine).toEqual(inputs[1]);
    expect(colLine).toBeNull();
  });

  it("resolves demux input/output lines", () => {
    const inputs = [gpio("gpio3", 0)];
    const outputs = [gpio("gpio4", 0), gpio("gpio4", 1)];
    const device: KscanDevice = {
      ...matrixDevice(0, 1, 2),
      type: KscanDriverType.DEMUX,
      gpioLinesByKind: {
        [GpioLineKind.KIND_UNKNOWN]: [],
        [GpioLineKind.ROW]: [],
        [GpioLineKind.COL]: [],
        [GpioLineKind.INPUT]: inputs,
        [GpioLineKind.OUTPUT]: outputs,
        [GpioLineKind.CHARLIE]: [],
      },
    };
    const { rowLine, colLine } = resolveRowColLines(device, 0, 1);
    expect(rowLine).toEqual(inputs[0]);
    expect(colLine).toEqual(outputs[1]);
  });

  it("returns null lines for an unknown device type", () => {
    const device: KscanDevice = {
      ...matrixDevice(0, 1, 1),
      type: KscanDriverType.UNKNOWN,
    };
    const { rowLine, colLine } = resolveRowColLines(device, 0, 0);
    expect(rowLine).toBeNull();
    expect(colLine).toBeNull();
  });
});

describe("buildWiringMap", () => {
  it("maps every mapped position to its row/col lines", () => {
    const device = matrixDevice(0, 2, 2);
    const topology: Topology = {
      protoVersion: 1,
      selectedLayout: 0,
      statsEnabled: true,
      maxPositions: 4,
      uptimeMs: 0,
      devices: [device],
      layouts: [],
    };
    const layout: KscanLayout = {
      layoutIndex: 0,
      displayName: "test",
      rows: 2,
      columns: 2,
      keyCount: 4,
      deviceIndices: [{ leafIndex: 0, rowOffset: 0, colOffset: 0 }],
      // row-major: (0,0)=0, (0,1)=1, (1,0)=2, (1,1)=null (unmapped)
      positionMap: [0, 1, 2, null],
    };

    const wiring = buildWiringMap(topology, layout);
    expect(wiring.size).toBe(3);
    expect(wiring.get(0)).toEqual({
      position: 0,
      row: 0,
      column: 0,
      device,
      rowLine: { port: "gpio0", pin: 0 },
      colLine: { port: "gpio1", pin: 0 },
    });
    expect(wiring.get(2)).toEqual({
      position: 2,
      row: 1,
      column: 0,
      device,
      rowLine: { port: "gpio0", pin: 1 },
      colLine: { port: "gpio1", pin: 0 },
    });
    // Cell (1,1) is unmapped (null in positionMap), so position 3 is absent.
    expect(wiring.get(3)).toBeUndefined();
  });

  it("resolves position to null-wiring when no device covers the cell", () => {
    const device = matrixDevice(0, 1, 1);
    const topology: Topology = {
      protoVersion: 1,
      selectedLayout: 0,
      statsEnabled: true,
      maxPositions: 2,
      uptimeMs: 0,
      devices: [device],
      layouts: [],
    };
    const layout: KscanLayout = {
      layoutIndex: 0,
      displayName: "test",
      rows: 1,
      columns: 2,
      keyCount: 2,
      // Only covers column 0; column 1 has no covering device (e.g. split
      // peripheral half whose wiring is unknown to the central).
      deviceIndices: [{ leafIndex: 0, rowOffset: 0, colOffset: 0 }],
      positionMap: [0, 1],
    };

    const wiring = buildWiringMap(topology, layout);
    expect(wiring.get(1)).toEqual({
      position: 1,
      row: 0,
      column: 1,
      device: null,
      rowLine: null,
      colLine: null,
    });
  });
});

describe("colorForLine", () => {
  it("is deterministic for the same label", () => {
    expect(colorForLine("gpio0:5")).toBe(colorForLine("gpio0:5"));
  });

  it("differs for different labels (in general)", () => {
    expect(colorForLine("gpio0:5")).not.toBe(colorForLine("gpio1:3"));
  });

  it("produces a valid hsl() string", () => {
    expect(colorForLine("gpio0:5")).toMatch(/^hsl\(\d+, 70%, 55%\)$/);
  });
});
