import { fireEvent, render, screen } from "@testing-library/react";
import { Tps43GestureMap } from "../Tps43GestureMap";
import type { Tps43State } from "../../proto/tokyo2006/tps43/tps43";

function state(overrides: Tps43State = {}): Tps43State {
  return {
    oneFingerTap: true,
    twoFingerTap: true,
    pressAndHold: true,
    pressAndHoldTime: 250,
    scroll: true,
    palmReject: true,
    ...overrides,
  };
}

describe("Tps43GestureMap", () => {
  // jsdom has no PointerEvent; MouseEvent carries the coordinates and button
  // that the pointer handlers read. Same shim as the combo drag tests.
  const originalPointerEvent = window.PointerEvent;

  beforeEach(() => {
    window.PointerEvent = MouseEvent as typeof PointerEvent;
  });

  afterEach(() => {
    window.PointerEvent = originalPointerEvent;
  });

  it("renders the 43x40 pad and the enabled gesture layers", () => {
    render(<Tps43GestureMap values={state()} />);

    const map = screen.getByTestId("tps43-gesture-map");
    expect(map).toHaveAttribute("viewBox", "0 0 430 400");

    const pad = screen.getByTestId("tps43-pad");
    expect(pad).toHaveAttribute("width", "420");
    expect(pad).toHaveAttribute("height", "390");
    expect(pad).toHaveAttribute("rx", "30");
    expect(screen.getByText("43 × 40 mm")).toBeInTheDocument();

    for (const layer of ["tap", "scroll", "hold", "palm"]) {
      expect(screen.getByTestId(`tps43-layer-${layer}`)).toHaveAttribute(
        "data-enabled",
        "true",
      );
      expect(screen.getByTestId(`tps43-layer-${layer}`)).toHaveAttribute(
        "data-tone",
        "electric",
      );
    }
    expect(screen.getByTestId("tps43-layer-tap")).toHaveStyle({
      opacity: "0.78",
    });

    expect(
      screen.getByText(
        "Recognition is approximate; IQS572 does the real gesture detection.",
      ),
    ).toBeInTheDocument();
  });

  it("shows disabled gestures as muted", () => {
    render(
      <Tps43GestureMap
        values={state({
          oneFingerTap: false,
          scroll: false,
          pressAndHold: false,
          palmReject: false,
        })}
      />,
    );

    for (const layer of ["tap", "scroll", "hold", "palm"]) {
      const node = screen.getByTestId(`tps43-layer-${layer}`);
      expect(node).toHaveAttribute("data-enabled", "false");
      expect(node).toHaveAttribute("data-tone", "muted");
      expect(node).toHaveStyle({ opacity: "0.38" });
    }
  });

  it("updates the hold ring from pressAndHoldTime", () => {
    const { rerender } = render(
      <Tps43GestureMap values={state({ pressAndHoldTime: 250 })} />,
    );

    const ring = screen.getByTestId("tps43-hold-ring");
    const shortDash = ring.getAttribute("stroke-dasharray") ?? "";
    expect(shortDash).toBeTruthy();
    expect(ring).toHaveAttribute("data-hold-ms", "250");
    expect(screen.getByText("Hold 250 ms")).toBeInTheDocument();

    rerender(<Tps43GestureMap values={state({ pressAndHoldTime: 800 })} />);

    expect(screen.getByTestId("tps43-hold-ring")).not.toHaveAttribute(
      "stroke-dasharray",
      shortDash,
    );
    expect(screen.getByTestId("tps43-hold-ring")).toHaveAttribute(
      "data-hold-ms",
      "800",
    );
    expect(screen.getByText("Hold 800 ms")).toBeInTheDocument();
  });

  it("falls back to 250 ms when pressAndHoldTime is absent", () => {
    render(<Tps43GestureMap values={state({ pressAndHoldTime: undefined })} />);

    expect(screen.getByTestId("tps43-hold-ring")).toHaveAttribute(
      "data-hold-ms",
      "250",
    );
    expect(screen.getByText("Hold 250 ms")).toBeInTheDocument();
  });

  it("shows the try-it result after a drag", () => {
    render(<Tps43GestureMap values={state()} />);

    const result = screen.getByTestId("tps43-result");
    expect(result).toHaveTextContent("Drag on the pad to try a gesture.");

    fireEvent.click(screen.getByRole("button", { name: "2F" }));

    const map = screen.getByTestId("tps43-gesture-map");
    fireEvent.pointerDown(map, {
      button: 0,
      clientX: 200,
      clientY: 200,
      pointerId: 1,
    });
    fireEvent.pointerMove(map, { clientX: 260, clientY: 205, pointerId: 1 });
    fireEvent.pointerUp(map, { clientX: 320, clientY: 210, pointerId: 1 });

    expect(screen.getByTestId("tps43-result")).toHaveAttribute(
      "data-gesture",
      "scroll",
    );
    expect(screen.getByTestId("tps43-result")).toHaveAttribute(
      "data-axis",
      "horizontal",
    );
    expect(screen.getByTestId("tps43-result")).toHaveTextContent(
      "Scroll · horizontal",
    );
    expect(screen.getByTestId("tps43-trail")).toBeInTheDocument();
  });

  it("marks a classified gesture that is switched off", () => {
    render(<Tps43GestureMap values={state({ oneFingerTap: false })} />);

    const map = screen.getByTestId("tps43-gesture-map");
    fireEvent.pointerDown(map, {
      button: 0,
      clientX: 200,
      clientY: 200,
      pointerId: 1,
    });
    fireEvent.pointerUp(map, {
      button: 0,
      clientX: 202,
      clientY: 201,
      pointerId: 1,
    });

    expect(screen.getByTestId("tps43-result")).toHaveAttribute(
      "data-gesture",
      "tap",
    );
    expect(screen.getByTestId("tps43-result")).toHaveAttribute(
      "data-enabled",
      "false",
    );
    expect(screen.getByTestId("tps43-result")).toHaveTextContent(
      "Tap · disabled",
    );
  });
});
