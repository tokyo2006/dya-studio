/**
 * Tests for BatteryPage component
 */
import { render, screen } from "@testing-library/react";
import { BatteryPage } from "../BatteryPage";
import { useBatteryHistory } from "../../hooks/useBatteryHistory";

// Mock the useBatteryHistory hook
jest.mock("../../hooks/useBatteryHistory");

const mockUseBatteryHistory = useBatteryHistory as jest.MockedFunction<
  typeof useBatteryHistory
>;

describe("BatteryPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should render battery status header", () => {
    mockUseBatteryHistory.mockReturnValue({
      devices: [],
      isLoading: false,
      error: null,
      loadBatteryHistory: jest.fn(),
      clearBatteryHistory: jest.fn(),
    });

    render(<BatteryPage />);

    expect(screen.getByText("Battery Status")).toBeInTheDocument();
    expect(
      screen.getByText("Monitor battery levels and history"),
    ).toBeInTheDocument();
  });

  it("should show placeholder when no devices are connected", () => {
    mockUseBatteryHistory.mockReturnValue({
      devices: [],
      isLoading: false,
      error: null,
      loadBatteryHistory: jest.fn(),
      clearBatteryHistory: jest.fn(),
    });

    render(<BatteryPage />);

    const placeholderValues = screen.getAllByText(/---%/);
    expect(placeholderValues.length).toBeGreaterThan(0);
    expect(screen.getByText(/--:--/)).toBeInTheDocument();
  });

  it("should show loading state", () => {
    mockUseBatteryHistory.mockReturnValue({
      devices: [],
      isLoading: true,
      error: null,
      loadBatteryHistory: jest.fn(),
      clearBatteryHistory: jest.fn(),
    });

    render(<BatteryPage />);

    expect(screen.getByText("Loading battery history...")).toBeInTheDocument();
  });

  it("should display error message", () => {
    const errorMessage = "Failed to connect to device";
    mockUseBatteryHistory.mockReturnValue({
      devices: [],
      isLoading: false,
      error: errorMessage,
      loadBatteryHistory: jest.fn(),
      clearBatteryHistory: jest.fn(),
    });

    render(<BatteryPage />);

    expect(screen.getByText(errorMessage)).toBeInTheDocument();
  });

  it("should display battery levels for connected devices", () => {
    mockUseBatteryHistory.mockReturnValue({
      devices: [
        {
          sourceId: 0,
          deviceName: "Central",
          entries: [
            { timestamp: 1000, batteryLevel: 85 },
            { timestamp: 2000, batteryLevel: 80 },
          ],
        },
        {
          sourceId: 1,
          deviceName: "Peripheral 1",
          entries: [
            { timestamp: 1000, batteryLevel: 75 },
            { timestamp: 2000, batteryLevel: 70 },
          ],
        },
      ],
      isLoading: false,
      error: null,
      loadBatteryHistory: jest.fn(),
      clearBatteryHistory: jest.fn(),
    });

    render(<BatteryPage />);

    // Check that device names appear (may appear multiple times - in cards and charts)
    expect(screen.getAllByText("Central").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Peripheral 1").length).toBeGreaterThan(0);

    // Check battery percentages
    expect(screen.getByText("80%")).toBeInTheDocument();
    expect(screen.getByText("70%")).toBeInTheDocument();
  });

  it("should have refresh button", () => {
    const mockLoadBatteryHistory = jest.fn();

    mockUseBatteryHistory.mockReturnValue({
      devices: [],
      isLoading: false,
      error: null,
      loadBatteryHistory: mockLoadBatteryHistory,
      clearBatteryHistory: jest.fn(),
    });

    render(<BatteryPage />);

    const refreshButton = screen.getByRole("button", { name: /refresh/i });
    expect(refreshButton).toBeInTheDocument();
  });

  it("should show info box about battery history", () => {
    mockUseBatteryHistory.mockReturnValue({
      devices: [],
      isLoading: false,
      error: null,
      loadBatteryHistory: jest.fn(),
      clearBatteryHistory: jest.fn(),
    });

    render(<BatteryPage />);

    expect(
      screen.getByText(/Battery history is recorded on the keyboard/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/timestamp resets when the keyboard restarts/i),
    ).toBeInTheDocument();
  });
});
