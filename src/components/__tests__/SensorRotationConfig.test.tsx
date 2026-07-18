import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SensorRotationConfig } from "../SensorRotationConfig";
import {
  useRuntimeSensorRotate,
  type UseRuntimeSensorRotateReturn,
} from "../../hooks/useRuntimeSensorRotate";
import type { BehaviorDefinition } from "../../hooks/useKeymap";

// Mock the hooks
jest.mock("../../hooks/useRuntimeSensorRotate");

const mockUseRuntimeSensorRotate =
  useRuntimeSensorRotate as jest.MockedFunction<typeof useRuntimeSensorRotate>;

// Helper to create mock return value
const createMockReturn = (
  overrides: Partial<UseRuntimeSensorRotateReturn>,
): UseRuntimeSensorRotateReturn => ({
  isAvailable: false,
  isLoading: false,
  sensors: [],
  error: null,
  loadSensors: jest.fn(),
  getAllLayerBindings: jest.fn(),
  setLayerCwBindings: jest.fn(),
  setLayerCcwBindings: jest.fn(),
  ...overrides,
});

describe("SensorRotationConfig", () => {
  const mockBehaviors = new Map<number, BehaviorDefinition>([
    [
      1,
      {
        id: 1,
        displayName: "Key Press",
        param1Display: "keycode",
        param2Display: null,
      },
    ],
  ]);

  const mockLayers = [
    { id: 0, name: "Default" },
    { id: 1, name: "Lower" },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe("Tap Time Debouncing", () => {
    test("debounces tap time changes", async () => {
      const user = userEvent.setup({ delay: null }); // Disable delay for test
      const mockSetLayerCwBindings = jest.fn().mockResolvedValue(true);
      const mockSetLayerCcwBindings = jest.fn().mockResolvedValue(true);
      const mockGetAllLayerBindings = jest.fn().mockResolvedValue([
        {
          layer: 0,
          cwBinding: { behaviorId: 1, param1: 0, param2: 0, tapMs: 5 },
          ccwBinding: { behaviorId: 1, param1: 0, param2: 0, tapMs: 5 },
        },
      ]);

      mockUseRuntimeSensorRotate.mockReturnValue(
        createMockReturn({
          isAvailable: true,
          sensors: [{ index: 0, name: "Encoder 1" }],
          getAllLayerBindings: mockGetAllLayerBindings,
          setLayerCwBindings: mockSetLayerCwBindings,
          setLayerCcwBindings: mockSetLayerCcwBindings,
        }),
      );

      render(
        <SensorRotationConfig
          selectedLayerId={0}
          behaviors={mockBehaviors}
          layers={mockLayers}
        />,
      );

      // Wait for initial load
      await waitFor(() => {
        expect(mockGetAllLayerBindings).toHaveBeenCalled();
      });

      // Find the tap time input
      const tapTimeInput = screen.getByDisplayValue("5");

      // Change the value multiple times quickly
      await user.clear(tapTimeInput);
      await user.type(tapTimeInput, "10");

      // API should not be called immediately
      expect(mockSetLayerCwBindings).not.toHaveBeenCalled();
      expect(mockSetLayerCcwBindings).not.toHaveBeenCalled();

      // Wait for debounce (3 seconds)
      jest.advanceTimersByTime(1500);

      // Now API should be called
      await waitFor(() => {
        expect(mockSetLayerCwBindings).toHaveBeenCalledWith(0, 0, {
          behaviorId: 1,
          param1: 0,
          param2: 0,
          tapMs: 10,
        });
        expect(mockSetLayerCcwBindings).toHaveBeenCalledWith(0, 0, {
          behaviorId: 1,
          param1: 0,
          param2: 0,
          tapMs: 10,
        });
      });
    });

    test("shows pending indicator during debounce", async () => {
      const user = userEvent.setup({ delay: null });
      const mockSetLayerCwBindings = jest.fn().mockResolvedValue(true);
      const mockSetLayerCcwBindings = jest.fn().mockResolvedValue(true);
      const mockGetAllLayerBindings = jest.fn().mockResolvedValue([
        {
          layer: 0,
          cwBinding: { behaviorId: 1, param1: 0, param2: 0, tapMs: 5 },
          ccwBinding: { behaviorId: 1, param1: 0, param2: 0, tapMs: 5 },
        },
      ]);

      mockUseRuntimeSensorRotate.mockReturnValue(
        createMockReturn({
          isAvailable: true,
          sensors: [{ index: 0, name: "Encoder 1" }],
          getAllLayerBindings: mockGetAllLayerBindings,
          setLayerCwBindings: mockSetLayerCwBindings,
          setLayerCcwBindings: mockSetLayerCcwBindings,
        }),
      );

      render(
        <SensorRotationConfig
          selectedLayerId={0}
          behaviors={mockBehaviors}
          layers={mockLayers}
        />,
      );

      // Wait for initial load
      await waitFor(() => {
        expect(mockGetAllLayerBindings).toHaveBeenCalled();
      });

      const tapTimeInput = screen.getByDisplayValue("5");

      // Change the value
      await user.clear(tapTimeInput);
      await user.type(tapTimeInput, "50");

      // Should show pending indicator
      expect(screen.getByText(/pending/i)).toBeInTheDocument();

      // Advance timers to complete debounce
      jest.advanceTimersByTime(1500);

      // Wait for the update to complete
      await waitFor(() => {
        expect(mockSetLayerCwBindings).toHaveBeenCalled();
      });

      // Pending indicator should be gone
      await waitFor(() => {
        expect(screen.queryByText(/pending/i)).not.toBeInTheDocument();
      });
    });

    test("cancels previous debounce on new change", async () => {
      const user = userEvent.setup({ delay: null });
      const mockSetLayerCwBindings = jest.fn().mockResolvedValue(true);
      const mockSetLayerCcwBindings = jest.fn().mockResolvedValue(true);
      const mockGetAllLayerBindings = jest.fn().mockResolvedValue([
        {
          layer: 0,
          cwBinding: { behaviorId: 1, param1: 0, param2: 0, tapMs: 5 },
          ccwBinding: { behaviorId: 1, param1: 0, param2: 0, tapMs: 5 },
        },
      ]);

      mockUseRuntimeSensorRotate.mockReturnValue(
        createMockReturn({
          isAvailable: true,
          sensors: [{ index: 0, name: "Encoder 1" }],
          getAllLayerBindings: mockGetAllLayerBindings,
          setLayerCwBindings: mockSetLayerCwBindings,
          setLayerCcwBindings: mockSetLayerCcwBindings,
        }),
      );

      render(
        <SensorRotationConfig
          selectedLayerId={0}
          behaviors={mockBehaviors}
          layers={mockLayers}
        />,
      );

      // Wait for initial load
      await waitFor(() => {
        expect(mockGetAllLayerBindings).toHaveBeenCalled();
      });

      const tapTimeInput = screen.getByDisplayValue("5");

      // First change
      await user.clear(tapTimeInput);
      await user.type(tapTimeInput, "10");

      // Advance timer partially (less than the 1500ms debounce)
      jest.advanceTimersByTime(750);

      // Second change before debounce completes
      await user.clear(tapTimeInput);
      await user.type(tapTimeInput, "20");

      // Advance another 750ms (only 750ms from the second change)
      jest.advanceTimersByTime(750);

      // API should not be called yet
      expect(mockSetLayerCwBindings).not.toHaveBeenCalled();

      // Advance another 750ms to complete the second debounce (1500ms total)
      jest.advanceTimersByTime(750);

      // Now API should be called only once with the final value
      await waitFor(() => {
        expect(mockSetLayerCwBindings).toHaveBeenCalledTimes(1);
        expect(mockSetLayerCwBindings).toHaveBeenCalledWith(0, 0, {
          behaviorId: 1,
          param1: 0,
          param2: 0,
          tapMs: 20,
        });
      });
    });

    test("handles multiple sensors independently", async () => {
      const user = userEvent.setup({ delay: null });
      const mockSetLayerCwBindings = jest.fn().mockResolvedValue(true);
      const mockSetLayerCcwBindings = jest.fn().mockResolvedValue(true);
      const mockGetAllLayerBindings = jest.fn(() =>
        Promise.resolve([
          {
            layer: 0,
            cwBinding: { behaviorId: 1, param1: 0, param2: 0, tapMs: 5 },
            ccwBinding: { behaviorId: 1, param1: 0, param2: 0, tapMs: 5 },
          },
        ]),
      );

      mockUseRuntimeSensorRotate.mockReturnValue(
        createMockReturn({
          isAvailable: true,
          sensors: [
            { index: 0, name: "Encoder 1" },
            { index: 1, name: "Encoder 2" },
          ],
          getAllLayerBindings: mockGetAllLayerBindings,
          setLayerCwBindings: mockSetLayerCwBindings,
          setLayerCcwBindings: mockSetLayerCcwBindings,
        }),
      );

      render(
        <SensorRotationConfig
          selectedLayerId={0}
          behaviors={mockBehaviors}
          layers={mockLayers}
        />,
      );

      // Wait for initial load
      await waitFor(() => {
        expect(mockGetAllLayerBindings).toHaveBeenCalledTimes(2);
      });

      // Get all tap time inputs (should be 2)
      const tapTimeInputs = screen.getAllByDisplayValue("5");
      expect(tapTimeInputs).toHaveLength(2);

      // Change first sensor
      await user.clear(tapTimeInputs[0]);
      await user.type(tapTimeInputs[0], "10");

      // Change second sensor
      await user.clear(tapTimeInputs[1]);
      await user.type(tapTimeInputs[1], "20");

      // Advance timers
      jest.advanceTimersByTime(1500);

      // Both should be called with their respective values
      await waitFor(() => {
        expect(mockSetLayerCwBindings).toHaveBeenCalledWith(0, 0, {
          behaviorId: 1,
          param1: 0,
          param2: 0,
          tapMs: 10,
        });
        expect(mockSetLayerCwBindings).toHaveBeenCalledWith(1, 0, {
          behaviorId: 1,
          param1: 0,
          param2: 0,
          tapMs: 20,
        });
      });
    });
  });

  describe("Empty State", () => {
    test("shows 'No rotary encoders detected' when no sensors", () => {
      mockUseRuntimeSensorRotate.mockReturnValue(
        createMockReturn({
          isAvailable: true,
        }),
      );

      render(
        <SensorRotationConfig
          selectedLayerId={0}
          behaviors={mockBehaviors}
          layers={mockLayers}
        />,
      );

      expect(
        screen.getByText("No rotary encoders detected"),
      ).toBeInTheDocument();
    });

    test("shows loading state", () => {
      mockUseRuntimeSensorRotate.mockReturnValue(
        createMockReturn({
          isAvailable: true,
          isLoading: true,
        }),
      );

      render(
        <SensorRotationConfig
          selectedLayerId={0}
          behaviors={mockBehaviors}
          layers={mockLayers}
        />,
      );

      expect(screen.getByText("Loading sensors...")).toBeInTheDocument();
    });
  });
});
