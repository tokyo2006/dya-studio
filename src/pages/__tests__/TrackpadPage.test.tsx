import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TrackpadPage } from "../TrackpadPage";
import { useCirque, type UseCirqueReturn } from "../../hooks/useCirque";
import { useTps43, type UseTps43Return } from "../../hooks/useTps43";
import {
  useRuntimeInputProcessor,
  type InputProcessor,
  type UseRuntimeInputProcessorReturn,
} from "../../hooks/useRuntimeInputProcessor";
import { CIRQUE_DEFAULT_STATE } from "../../lib/transport/demo-cirque";
import { TPS43_DEFAULT_STATE } from "../../lib/transport/demo-tps43";
import { AxisSnapMode } from "../../proto/zmk/runtime_input_processor/runtime_input_processor";

jest.mock("../../hooks/useCirque", () => ({
  ...jest.requireActual("../../hooks/useCirque"),
  useCirque: jest.fn(),
}));

jest.mock("../../hooks/useTps43", () => ({
  ...jest.requireActual("../../hooks/useTps43"),
  useTps43: jest.fn(),
}));

jest.mock("../../hooks/useRuntimeInputProcessor", () => ({
  ...jest.requireActual("../../hooks/useRuntimeInputProcessor"),
  useRuntimeInputProcessor: jest.fn(),
}));

const mockUseCirque = useCirque as jest.MockedFunction<typeof useCirque>;
const mockUseTps43 = useTps43 as jest.MockedFunction<typeof useTps43>;
const mockUseInputProcessor = useRuntimeInputProcessor as jest.MockedFunction<
  typeof useRuntimeInputProcessor
>;

function mockHook(overrides: Partial<UseCirqueReturn> = {}): UseCirqueReturn {
  const value: UseCirqueReturn = {
    isAvailable: true,
    state: CIRQUE_DEFAULT_STATE,
    values: CIRQUE_DEFAULT_STATE,
    isLoading: false,
    isResetting: false,
    error: null,
    writeState: "idle",
    load: jest.fn(),
    update: jest.fn(),
    reset: jest.fn().mockResolvedValue(true),
    ...overrides,
  };
  mockUseCirque.mockReturnValue(value);
  return value;
}

function mockTps43Hook(
  overrides: Partial<UseTps43Return> = {},
): UseTps43Return {
  const value: UseTps43Return = {
    isAvailable: false,
    sources: [],
    selectedSource: 0,
    selectSource: jest.fn(),
    hasDiscovered: false,
    refresh: jest.fn().mockResolvedValue(undefined),
    state: null,
    values: null,
    isLoading: false,
    isResetting: false,
    error: null,
    writeState: "idle",
    load: jest.fn().mockResolvedValue(undefined),
    update: jest.fn(),
    reset: jest.fn().mockResolvedValue(true),
    ...overrides,
  };
  mockUseTps43.mockReturnValue(value);
  return value;
}

const PROCESSOR: InputProcessor = {
  inertia: undefined,
  inertiaNotificationsEnabled: false,
  inertiaActive: false,
  inertiaFastInput: false,
  inertiaStopReason: 0,
  id: 7,
  name: "TPS43 pointer",
  scaleMultiplier: 1,
  scaleDivisor: 1,
  rotationDegrees: 0,
  tempLayerEnabled: false,
  tempLayerLayer: 0,
  tempLayerActivationDelayMs: 0,
  tempLayerDeactivationDelayMs: 0,
  activeLayers: 0,
  axisSnapMode: AxisSnapMode.AXIS_SNAP_MODE_NONE,
  axisSnapThreshold: 0,
  axisSnapTimeoutMs: 0,
  xInvert: false,
  yInvert: false,
  xyToScrollEnabled: false,
  xySwapEnabled: false,
};

function mockInputProcessor(
  overrides: Partial<UseRuntimeInputProcessorReturn> = {},
): UseRuntimeInputProcessorReturn {
  const noop = jest.fn().mockResolvedValue(undefined);
  const value: UseRuntimeInputProcessorReturn = {
    setInertia: noop,
    setInertiaNotifications: noop,
    isAvailable: false,
    processors: [],
    layers: [],
    isLoading: false,
    error: null,
    loadProcessors: noop,
    loadLayers: noop,
    setScaling: noop,
    setRotation: noop,
    setTempLayerEnabled: noop,
    setTempLayerLayer: noop,
    setTempLayerActivationDelay: noop,
    setTempLayerDeactivationDelay: noop,
    setActiveLayers: noop,
    setAxisSnapMode: noop,
    setAxisSnapThreshold: noop,
    setAxisSnapTimeout: noop,
    setXInvert: noop,
    setYInvert: noop,
    setXyToScrollEnabled: noop,
    setXySwapEnabled: noop,
    ...overrides,
  };
  mockUseInputProcessor.mockReturnValue(value);
  return value;
}

/** A ready TPS43 panel with one local source and the demo defaults. */
function mockTps43Ready(
  overrides: Partial<UseTps43Return> = {},
): UseTps43Return {
  return mockTps43Hook({
    isAvailable: true,
    hasDiscovered: true,
    sources: [{ source: 0 }],
    selectedSource: 0,
    state: TPS43_DEFAULT_STATE,
    values: TPS43_DEFAULT_STATE,
    ...overrides,
  });
}

beforeEach(() => {
  // TrackpadPage renders the Cirque panel unless a TPS43 subsystem is present.
  mockTps43Hook({ isAvailable: false });
  mockInputProcessor();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("TrackpadPage", () => {
  it("explains how to enable the module when the subsystem is missing", () => {
    mockHook({ isAvailable: false, state: null, values: null });
    render(<TrackpadPage />);

    expect(
      screen.getByText(/Trackpad subsystem is not available/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "tokyo2006/cirque-input-module" }),
    ).toHaveAttribute(
      "href",
      "https://github.com/tokyo2006/cirque-input-module",
    );
    expect(
      screen.queryByRole("button", { name: /Reset to defaults/ }),
    ).toBeNull();
  });

  it("shows device values and sends edited fields", async () => {
    const hook = mockHook();
    render(<TrackpadPage />);

    expect(screen.getByRole("switch", { name: "Tap to Click" })).toBeChecked();
    expect(
      screen.getByRole("slider", { name: "Right-click zone width" }),
    ).toHaveValue("250");

    await userEvent.click(
      screen.getByRole("switch", { name: "Secondary Tap (right click)" }),
    );
    expect(hook.update).toHaveBeenCalledWith({ secondaryTapEnable: true });

    await userEvent.click(screen.getByRole("switch", { name: "Sleep Mode" }));
    expect(hook.update).toHaveBeenCalledWith({ sleepModeEnable: false });
  });

  it("hides dependent sliders until their feature is on", () => {
    mockHook();
    render(<TrackpadPage />);
    expect(screen.queryByRole("slider", { name: "Drag Timeout" })).toBeNull();

    mockHook({ values: { ...CIRQUE_DEFAULT_STATE, tapDragEnable: true } });
    render(<TrackpadPage />);
    expect(screen.getByRole("slider", { name: "Drag Timeout" })).toHaveValue(
      "350",
    );
  });

  it("commits advanced numbers on blur, clamped, and ignores empty drafts", async () => {
    const hook = mockHook();
    render(<TrackpadPage />);
    const movement = screen.getByRole("spinbutton", {
      name: "Max Tap Movement",
    });

    // Empty draft is discarded and the value is restored.
    await userEvent.clear(movement);
    expect(movement).toHaveValue(null);
    await userEvent.tab();
    expect(hook.update).not.toHaveBeenCalled();
    expect(movement).toHaveValue(200);

    // Out-of-range drafts clamp to the field maximum.
    await userEvent.clear(movement);
    await userEvent.type(movement, "999999{Enter}");
    expect(hook.update).toHaveBeenLastCalledWith({ tapMaxMovement: 65535 });
  });

  it("shows the pending write state", () => {
    mockHook({ writeState: "queued" });
    render(<TrackpadPage />);
    expect(screen.getByRole("status")).toHaveTextContent("Pending...");
  });

  it("resets only after confirmation", async () => {
    const hook = mockHook();
    render(<TrackpadPage />);

    await userEvent.click(
      screen.getByRole("button", { name: /Reset to defaults/ }),
    );
    const dialog = screen.getByRole("dialog");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Cancel" }),
    );
    expect(hook.reset).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();

    await userEvent.click(
      screen.getByRole("button", { name: /Reset to defaults/ }),
    );
    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Reset to defaults",
      }),
    );
    expect(hook.reset).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("keeps the dialog open when reset fails", async () => {
    mockHook({ reset: jest.fn().mockResolvedValue(false), error: "boom" });
    render(<TrackpadPage />);

    await userEvent.click(
      screen.getByRole("button", { name: /Reset to defaults/ }),
    );
    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Reset to defaults",
      }),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("boom");
  });

  it("shows 'Main hand' for source 0 and hides the selector for one source", () => {
    mockTps43Ready();
    render(<TrackpadPage />);

    expect(screen.getByText("Main hand")).toBeInTheDocument();
    expect(screen.queryByTestId("tps43-source-selector")).toBeNull();
  });

  it("sends SetState for the selected peripheral source", async () => {
    const hook = mockTps43Ready({
      sources: [{ source: 0 }, { source: 1 }],
      selectedSource: 1,
    });
    render(<TrackpadPage />);

    const selector = screen.getByTestId("tps43-source-selector");
    expect(
      within(selector).getByRole("button", { name: "Off hand" }),
    ).toHaveAttribute("aria-pressed", "true");

    await userEvent.click(
      within(selector).getByRole("button", { name: "Main hand" }),
    );
    expect(hook.selectSource).toHaveBeenCalledWith(0);

    await userEvent.click(
      within(selector).getByRole("button", { name: "Off hand" }),
    );
    expect(hook.selectSource).toHaveBeenCalledWith(1);

    // The hook stamps SetState with the selected source; the page only queues
    // the field change.
    await userEvent.click(
      screen.getByRole("switch", { name: "Two-finger scroll" }),
    );
    expect(hook.update).toHaveBeenCalledWith({ scroll: true });
  });

  it("renders the gesture map and updates it when a toggle changes", async () => {
    const hook = mockTps43Ready({
      values: { ...TPS43_DEFAULT_STATE, oneFingerTap: false },
    });
    const { rerender } = render(<TrackpadPage />);

    expect(screen.getByTestId("tps43-gesture-map")).toBeInTheDocument();
    expect(screen.getByTestId("tps43-layer-tap")).toHaveAttribute(
      "data-enabled",
      "false",
    );

    await userEvent.click(screen.getByRole("switch", { name: "Tap to click" }));
    expect(hook.update).toHaveBeenCalledWith({ oneFingerTap: true });

    mockTps43Ready({
      values: { ...TPS43_DEFAULT_STATE, oneFingerTap: true },
    });
    rerender(<TrackpadPage />);
    expect(screen.getByTestId("tps43-layer-tap")).toHaveAttribute(
      "data-enabled",
      "true",
    );
  });

  it("shows unsupported when the subsystem is absent", () => {
    mockHook({ isAvailable: false, state: null, values: null });
    mockTps43Hook({ isAvailable: false });
    render(<TrackpadPage />);

    expect(
      screen.getByText(/Trackpad subsystem is not available/),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("tps43-no-trackpad")).toBeNull();
    expect(screen.queryByRole("switch", { name: "Tap to click" })).toBeNull();
  });

  it("does not show the no-trackpad state before discovery settles", () => {
    mockTps43Hook({
      isAvailable: true,
      hasDiscovered: false,
      sources: [],
      values: null,
      isLoading: true,
    });
    render(<TrackpadPage />);

    expect(screen.queryByTestId("tps43-no-trackpad")).toBeNull();
    expect(
      screen.getByText("Loading trackpad settings..."),
    ).toBeInTheDocument();
  });

  it("shows a distinct no-trackpad state without rediscovering from Reload", async () => {
    const hook = mockTps43Hook({
      isAvailable: true,
      hasDiscovered: true,
      sources: [],
      values: null,
      isLoading: false,
    });
    render(<TrackpadPage />);

    expect(screen.getByTestId("tps43-no-trackpad")).toHaveTextContent(
      "No trackpad found",
    );
    expect(screen.queryByRole("button", { name: "Reload" })).toBeNull();
    expect(hook.load).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Search again" }));
    expect(hook.refresh).toHaveBeenCalledTimes(1);
  });

  it("maps preset choices and pointing toggles to TPS43 fields", async () => {
    const hook = mockTps43Ready();
    render(<TrackpadPage />);

    await userEvent.click(
      within(screen.getByRole("group", { name: "Hold duration" })).getByRole(
        "button",
        { name: "Long" },
      ),
    );
    expect(hook.update).toHaveBeenCalledWith({ pressAndHoldTime: 400 });

    await userEvent.click(
      within(screen.getByRole("group", { name: "Battery saver" })).getByRole(
        "button",
        { name: "Max" },
      ),
    );
    expect(hook.update).toHaveBeenCalledWith({ batterySaver: 2 });

    await userEvent.click(
      within(screen.getByRole("group", { name: "Sensitivity" })).getByRole(
        "button",
        { name: "High" },
      ),
    );
    expect(hook.update).toHaveBeenCalledWith({ sensitivity: 5 });

    await userEvent.click(
      screen.getByRole("switch", { name: "Palm rejection" }),
    );
    expect(hook.update).toHaveBeenCalledWith({ palmReject: false });

    await userEvent.click(
      screen.getByRole("switch", { name: "Natural scrolling" }),
    );
    expect(hook.update).toHaveBeenCalledWith({
      naturalScrollX: true,
      naturalScrollY: true,
    });
  });

  it("shows custom hold durations that are not one of the presets", () => {
    mockTps43Ready({
      values: { ...TPS43_DEFAULT_STATE, pressAndHoldTime: 320 },
    });
    render(<TrackpadPage />);
    expect(screen.getByText("Custom (320 ms)")).toBeInTheDocument();
  });

  it("hides the speed card without a runtime input processor", () => {
    mockTps43Ready();
    mockInputProcessor({ isAvailable: false, processors: [] });
    render(<TrackpadPage />);
    expect(screen.queryByRole("slider", { name: "Pointer speed" })).toBeNull();
  });

  it("edits pointer speed through the runtime input processor", () => {
    const input = mockInputProcessor({
      isAvailable: true,
      processors: [PROCESSOR],
    });
    mockTps43Ready();
    render(<TrackpadPage />);

    const slider = screen.getByRole("slider", { name: "Pointer speed" });
    expect(slider).toHaveValue("100");
    fireEvent.change(slider, { target: { value: "150" } });
    expect(input.setScaling).toHaveBeenCalledWith(7, 150, 100);
  });

  it("maps axes toggles and rotation to the keyboard", async () => {
    const input = mockInputProcessor({
      isAvailable: true,
      processors: [PROCESSOR],
    });
    const hook = mockTps43Ready();
    render(<TrackpadPage />);

    await userEvent.click(screen.getByRole("switch", { name: "Flip Y" }));
    expect(hook.update).toHaveBeenCalledWith({ flipY: true });

    const rotation = screen.getByRole("slider", {
      name: "Rotation (degrees)",
    });
    expect(rotation).toHaveValue("0");
    fireEvent.change(rotation, { target: { value: "12" } });
    expect(input.setRotation).toHaveBeenCalledWith(7, 12);
  });

  it("hides controls the main-branch driver does not provide", () => {
    const mainDriverState = {
      ...TPS43_DEFAULT_STATE,
      palmReject: undefined,
      batterySaver: undefined,
      sensitivity: undefined,
    };
    mockTps43Ready({ state: mainDriverState, values: mainDriverState });
    mockInputProcessor({
      isAvailable: true,
      processors: [PROCESSOR],
    });
    render(<TrackpadPage />);

    expect(screen.queryByRole("switch", { name: "Palm rejection" })).toBeNull();
    expect(screen.queryByText("Comfort")).toBeNull();
    expect(screen.getByRole("switch", { name: "Flip X" })).toBeInTheDocument();
    expect(
      screen.getByRole("slider", { name: "Rotation (degrees)" }),
    ).toBeInTheDocument();
  });

  it("Reset confirms and sends factoryDefaults", async () => {
    const confirm = jest.spyOn(window, "confirm").mockReturnValue(true);
    const hook = mockTps43Ready();
    render(<TrackpadPage />);

    await userEvent.click(
      screen.getByRole("button", { name: /Reset to defaults/ }),
    );

    expect(confirm).toHaveBeenCalledWith(
      expect.stringContaining("firmware defaults"),
    );
    await waitFor(() => expect(hook.reset).toHaveBeenCalledTimes(1));
  });

  it("does not reset pointer speed from the TPS43 reset", async () => {
    jest.spyOn(window, "confirm").mockReturnValue(true);
    const input = mockInputProcessor({
      isAvailable: true,
      processors: [PROCESSOR],
    });
    const hook = mockTps43Ready();
    render(<TrackpadPage />);

    await userEvent.click(
      screen.getByRole("button", { name: /Reset to defaults/ }),
    );

    await waitFor(() => expect(hook.reset).toHaveBeenCalledTimes(1));
    expect(input.setScaling).not.toHaveBeenCalled();
  });

  it("shows the pending write state for the TPS43 panel", () => {
    mockTps43Ready({ writeState: "saving" });
    render(<TrackpadPage />);
    expect(screen.getByText("Saving...")).toBeInTheDocument();
  });
});
