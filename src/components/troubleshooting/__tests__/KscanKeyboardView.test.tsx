/**
 * Tests for KscanKeyboardView: pin hover/click highlighting, suspect/no-
 * record markers, and tooltip content.
 */
import { render, screen, fireEvent } from "@testing-library/react";
import { KscanKeyboardView } from "../KscanKeyboardView";
import { KscanDriverType } from "../../../lib/kscanTopology";
import type { KeyWiringInfo } from "../../../lib/kscanTopology";
import type { PositionStats } from "../../../proto/cormoran/kscan_diagnostics/kscan_diagnostics";
import type { PhysicalLayout } from "@zmkfirmware/zmk-studio-ts-client/keymap";

function attrs(x: number, y: number) {
  return { width: 100, height: 100, x, y, r: 0, rx: 0, ry: 0 };
}

const layout: PhysicalLayout = {
  name: "test",
  keys: [attrs(0, 0), attrs(100, 0), attrs(200, 0)],
};

const device = {
  deviceIndex: 0,
  nodeName: "kscan0",
  type: KscanDriverType.MATRIX,
  rows: 1,
  columns: 3,
  inputs: 0,
  debouncePressMs: 5,
  debounceReleaseMs: 5,
  debounceScanPeriodMs: 1,
  pollPeriodMs: 0,
  diodeRow2col: true,
  toggleMode: false,
  gpioLinesByKind: {} as never,
};

function makeWiring(): Map<number, KeyWiringInfo> {
  return new Map<number, KeyWiringInfo>([
    [
      0,
      {
        position: 0,
        row: 0,
        column: 0,
        device,
        rowLine: { port: "gpio0", pin: 4 },
        colLine: { port: "gpio1", pin: 0 },
      },
    ],
    [
      1,
      {
        position: 1,
        row: 0,
        column: 1,
        device,
        rowLine: { port: "gpio0", pin: 4 },
        colLine: { port: "gpio1", pin: 1 },
      },
    ],
    // Position 2 has no wiring info (e.g. split peripheral half).
  ]);
}

function stat(overrides: Partial<PositionStats> = {}): PositionStats {
  return {
    position: 0,
    presses: 10,
    releases: 10,
    minPressDurationMs: 30,
    minRepressGapMs: 150,
    repressLt5: 0,
    repressLt10: 0,
    repressLt20: 0,
    repressLt50: 0,
    lastSource: 0,
    ...overrides,
  };
}

describe("KscanKeyboardView", () => {
  it("renders one keycap per physical-layout key", () => {
    render(
      <KscanKeyboardView
        layout={layout}
        wiring={makeWiring()}
        statsByPosition={new Map()}
      />,
    );

    expect(screen.getByTestId("kscan-key-0")).toBeInTheDocument();
    expect(screen.getByTestId("kscan-key-1")).toBeInTheDocument();
    expect(screen.getByTestId("kscan-key-2")).toBeInTheDocument();
  });

  it("renders one pin button per unique row/col GPIO line", () => {
    render(
      <KscanKeyboardView
        layout={layout}
        wiring={makeWiring()}
        statsByPosition={new Map()}
      />,
    );

    // Row line gpio0:4 is shared by both mapped keys -> one button.
    expect(screen.getByTestId("pin-gpio0:4")).toBeInTheDocument();
    // Two distinct column lines.
    expect(screen.getByTestId("pin-gpio1:0")).toBeInTheDocument();
    expect(screen.getByTestId("pin-gpio1:1")).toBeInTheDocument();
  });

  it("highlights keys on a line when its pin button is hovered", () => {
    render(
      <KscanKeyboardView
        layout={layout}
        wiring={makeWiring()}
        statsByPosition={new Map()}
      />,
    );

    const rowPin = screen.getByTestId("pin-gpio0:4");
    fireEvent.mouseEnter(rowPin);

    const key0 = screen.getByTestId("kscan-key-0");
    const key1 = screen.getByTestId("kscan-key-1");
    // Both keys share the gpio0:4 row line, so both get a highlight boxShadow.
    expect(key0.style.boxShadow).not.toBe("");
    expect(key1.style.boxShadow).not.toBe("");

    fireEvent.mouseLeave(rowPin);
    expect(key0.style.boxShadow).toBe("");
  });

  it("toggles a persistent pin on click and shows a Clear button", () => {
    render(
      <KscanKeyboardView
        layout={layout}
        wiring={makeWiring()}
        statsByPosition={new Map()}
      />,
    );

    expect(screen.queryByText("Clear")).not.toBeInTheDocument();

    const colPin = screen.getByTestId("pin-gpio1:0");
    fireEvent.click(colPin);

    expect(colPin).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Clear")).toBeInTheDocument();
    // Only key 0 is on column gpio1:0.
    expect(screen.getByTestId("kscan-key-0").style.boxShadow).not.toBe("");
    expect(screen.getByTestId("kscan-key-1").style.boxShadow).toBe("");

    // Click again to unpin.
    fireEvent.click(colPin);
    expect(colPin).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByText("Clear")).not.toBeInTheDocument();
  });

  it("clicking Clear removes all pinned lines", () => {
    render(
      <KscanKeyboardView
        layout={layout}
        wiring={makeWiring()}
        statsByPosition={new Map()}
      />,
    );

    fireEvent.click(screen.getByTestId("pin-gpio1:0"));
    fireEvent.click(screen.getByTestId("pin-gpio1:1"));
    expect(screen.getByText("Clear")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Clear"));
    expect(screen.queryByText("Clear")).not.toBeInTheDocument();
    expect(screen.getByTestId("pin-gpio1:0")).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("supports keyboard focus for hover-equivalent highlighting", () => {
    render(
      <KscanKeyboardView
        layout={layout}
        wiring={makeWiring()}
        statsByPosition={new Map()}
      />,
    );

    const rowPin = screen.getByTestId("pin-gpio0:4");
    fireEvent.focus(rowPin);
    expect(screen.getByTestId("kscan-key-0").style.boxShadow).not.toBe("");
    fireEvent.blur(rowPin);
    expect(screen.getByTestId("kscan-key-0").style.boxShadow).toBe("");
  });

  it("renders a no-record marker for a key with zero presses", () => {
    const stats = new Map([
      [0, stat({ position: 0, presses: 0, releases: 0 })],
    ]);
    const { container } = render(
      <KscanKeyboardView
        layout={layout}
        wiring={makeWiring()}
        statsByPosition={stats}
      />,
    );
    const key0 = screen.getByTestId("kscan-key-0");
    expect(key0.querySelector("svg.tabler-icon-circle-dashed")).not.toBeNull();
    void container;
  });

  it("renders a suspect marker for a chattery key", () => {
    const stats = new Map([
      [0, stat({ position: 0, presses: 10, releases: 10, repressLt10: 3 })],
    ]);
    render(
      <KscanKeyboardView
        layout={layout}
        wiring={makeWiring()}
        statsByPosition={stats}
      />,
    );
    const key0 = screen.getByTestId("kscan-key-0");
    expect(key0.querySelector("svg.tabler-icon-alert-triangle")).not.toBeNull();
  });

  it("renders the legend", () => {
    render(
      <KscanKeyboardView
        layout={layout}
        wiring={makeWiring()}
        statsByPosition={new Map()}
      />,
    );
    expect(screen.getByText("Untested")).toBeInTheDocument();
    expect(screen.getByText("No record (0 presses)")).toBeInTheDocument();
    expect(
      screen.getByText("Suspect (chatter or mismatch)"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("No wiring info (split peripheral half)"),
    ).toBeInTheDocument();
  });
});
