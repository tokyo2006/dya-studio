/**
 * Tests for TrackballPage component
 */
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TrackballPage } from "../TrackballPage";
import { useRuntimeInputProcessor } from "../../hooks/useRuntimeInputProcessor";
import { useKeymap } from "../../hooks/useKeymap";

// Mock the useRuntimeInputProcessor hook
jest.mock("../../hooks/useRuntimeInputProcessor");

// Mock the useKeymap hook
jest.mock("../../hooks/useKeymap");

const mockUseRuntimeInputProcessor =
  useRuntimeInputProcessor as jest.MockedFunction<
    typeof useRuntimeInputProcessor
  >;

const mockUseKeymap = useKeymap as jest.MockedFunction<typeof useKeymap>;

// Helper to create default mock processor
const createMockProcessor = (overrides = {}) => ({
  id: 0,
  name: "trackpad",
  scaleMultiplier: 1,
  scaleDivisor: 1,
  rotationDegrees: 0,
  tempLayerEnabled: false,
  tempLayerLayer: 0,
  tempLayerActivationDelayMs: 100,
  tempLayerDeactivationDelayMs: 500,
  ...overrides,
});

// Helper to create default runtime input processor hook return value
const createMockHookReturn = (overrides = {}) => ({
  processors: [],
  isLoading: false,
  error: null,
  loadProcessors: jest.fn(),
  setScaling: jest.fn(),
  setRotation: jest.fn(),
  setTempLayerEnabled: jest.fn(),
  setTempLayerLayer: jest.fn(),
  setTempLayerActivationDelay: jest.fn(),
  setTempLayerDeactivationDelay: jest.fn(),
  ...overrides,
});

describe("TrackballPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock useKeymap with default values
    mockUseKeymap.mockReturnValue({
      keymap: {
        layers: [
          { id: 0, name: "Default", bindings: [] },
          { id: 1, name: "Lower", bindings: [] },
          { id: 2, name: "Raise", bindings: [] },
        ],
      },
      physicalLayouts: null,
      behaviors: new Map(),
      originalBindings: new Map(),
      hasUnsavedChanges: false,
      isLoading: false,
      error: null,
      unlockRequired: false,
      loadKeymapData: jest.fn(),
      setBinding: jest.fn(),
      resetBinding: jest.fn(),
      moveLayer: jest.fn(),
      addLayer: jest.fn(),
      deleteLayer: jest.fn(),
      restoreLayer: jest.fn(),
      saveKeymap: jest.fn(),
      discardChanges: jest.fn(),
      refreshKeymap: jest.fn(),
    });
  });

  it("should render trackball settings header", () => {
    mockUseRuntimeInputProcessor.mockReturnValue(createMockHookReturn());

    render(<TrackballPage />);

    expect(screen.getByText("Trackball Settings")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Adjust sensitivity and behavior via runtime input processor",
      ),
    ).toBeInTheDocument();
  });

  it("should show loading state when initially loading", () => {
    mockUseRuntimeInputProcessor.mockReturnValue(
      createMockHookReturn({ isLoading: true }),
    );

    render(<TrackballPage />);

    expect(
      screen.getByText("Loading trackball settings..."),
    ).toBeInTheDocument();
  });

  it("should display error message", () => {
    const errorMessage = "Failed to connect to device";
    mockUseRuntimeInputProcessor.mockReturnValue(
      createMockHookReturn({ error: errorMessage }),
    );

    render(<TrackballPage />);

    expect(screen.getByText(errorMessage)).toBeInTheDocument();
  });

  it("should show no processor message when no processors found", () => {
    mockUseRuntimeInputProcessor.mockReturnValue(createMockHookReturn());

    render(<TrackballPage />);

    expect(
      screen.getByText(/No runtime input processor found/),
    ).toBeInTheDocument();
  });

  it("should display processor information when loaded", () => {
    mockUseRuntimeInputProcessor.mockReturnValue(
      createMockHookReturn({
        processors: [createMockProcessor()],
      }),
    );

    render(<TrackballPage />);

    expect(screen.getByText("Active Processor")).toBeInTheDocument();
    expect(screen.getByText("trackpad")).toBeInTheDocument();
  });

  it("should display current speed settings", () => {
    mockUseRuntimeInputProcessor.mockReturnValue(
      createMockHookReturn({
        processors: [
          createMockProcessor({
            scaleMultiplier: 2,
            scaleDivisor: 1,
          }),
        ],
      }),
    );

    render(<TrackballPage />);

    expect(screen.getByText("Pointer Speed")).toBeInTheDocument();
    // Use getAllByText since there are multiple instances (display and button)
    const speedTexts = screen.getAllByText("2.0x");
    expect(speedTexts.length).toBeGreaterThan(0);
  });

  it("should display rotation settings", () => {
    mockUseRuntimeInputProcessor.mockReturnValue(
      createMockHookReturn({
        processors: [
          createMockProcessor({
            rotationDegrees: 90,
          }),
        ],
      }),
    );

    render(<TrackballPage />);

    expect(screen.getByText("Sensor Rotation")).toBeInTheDocument();
    // Use getAllByText since there are multiple instances (display and button)
    const rotationTexts = screen.getAllByText("90°");
    expect(rotationTexts.length).toBeGreaterThan(0);
  });

  it("should call setScaling when speed button is clicked", async () => {
    jest.useFakeTimers();
    const user = userEvent.setup({ delay: null });
    const mockSetScaling = jest.fn();

    mockUseRuntimeInputProcessor.mockReturnValue(
      createMockHookReturn({
        processors: [createMockProcessor()],
        setScaling: mockSetScaling,
      }),
    );

    render(<TrackballPage />);

    // Click on 2.0x speed button in the ButtonListSelector
    const speedButtons = screen.getAllByText("2.0x");
    // The button is the one in the ButtonListSelector (not the display value)
    const speedButton = speedButtons.find(
      (el) => el.tagName === "SPAN" && el.parentElement?.tagName === "BUTTON",
    );
    if (speedButton && speedButton.parentElement) {
      await user.click(speedButton.parentElement);
    }

    // Fast-forward time to trigger debounced auto-save (1000ms)
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    expect(mockSetScaling).toHaveBeenCalledWith(0, 200, 100);

    jest.useRealTimers();
  });

  it("should call setRotation when rotation button is clicked", async () => {
    jest.useFakeTimers();
    const user = userEvent.setup({ delay: null });
    const mockSetRotation = jest.fn();

    mockUseRuntimeInputProcessor.mockReturnValue(
      createMockHookReturn({
        processors: [createMockProcessor()],
        setRotation: mockSetRotation,
      }),
    );

    render(<TrackballPage />);

    // Click on 90° rotation button in the ButtonListSelector
    const rotationButtons = screen.getAllByText("90°");
    // The button is the one in the ButtonListSelector (not the display value)
    const rotationButton = rotationButtons.find(
      (el) => el.tagName === "SPAN" && el.parentElement?.tagName === "BUTTON",
    );
    if (rotationButton && rotationButton.parentElement) {
      await user.click(rotationButton.parentElement);
    }

    // Fast-forward time to trigger debounced auto-save (1000ms)
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    expect(mockSetRotation).toHaveBeenCalledWith(0, 90);

    jest.useRealTimers();
  });

  it("should display current configuration details", () => {
    mockUseRuntimeInputProcessor.mockReturnValue(
      createMockHookReturn({
        processors: [
          createMockProcessor({
            scaleMultiplier: 3,
            scaleDivisor: 2,
            rotationDegrees: 180,
          }),
        ],
      }),
    );

    render(<TrackballPage />);

    expect(screen.getByText("Current Configuration")).toBeInTheDocument();
    expect(screen.getByText("Scale Multiplier")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("Scale Divisor")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("should display info message about runtime input processor", () => {
    mockUseRuntimeInputProcessor.mockReturnValue(
      createMockHookReturn({
        processors: [createMockProcessor()],
      }),
    );

    render(<TrackballPage />);

    expect(
      screen.getByText(/Runtime input processor allows you to adjust/),
    ).toBeInTheDocument();
  });
});
