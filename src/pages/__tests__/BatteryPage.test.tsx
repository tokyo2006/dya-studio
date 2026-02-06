/**
 * Tests for BatteryPage component
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

  it("should have clear history button", () => {
    mockUseBatteryHistory.mockReturnValue({
      devices: [
        {
          sourceId: 0,
          deviceName: "Central",
          entries: [{ timestamp: 1000, batteryLevel: 85 }],
        },
      ],
      isLoading: false,
      error: null,
      loadBatteryHistory: jest.fn(),
      clearBatteryHistory: jest.fn(),
    });

    render(<BatteryPage />);

    const clearButton = screen.getByRole("button", {
      name: /clear battery history/i,
    });
    expect(clearButton).toBeInTheDocument();
  });

  it("should disable clear history button when no devices", () => {
    mockUseBatteryHistory.mockReturnValue({
      devices: [],
      isLoading: false,
      error: null,
      loadBatteryHistory: jest.fn(),
      clearBatteryHistory: jest.fn(),
    });

    render(<BatteryPage />);

    const clearButton = screen.getByRole("button", {
      name: /clear battery history/i,
    });
    expect(clearButton).toBeDisabled();
  });

  it("should disable clear history button when loading", () => {
    mockUseBatteryHistory.mockReturnValue({
      devices: [
        {
          sourceId: 0,
          deviceName: "Central",
          entries: [{ timestamp: 1000, batteryLevel: 85 }],
        },
      ],
      isLoading: true,
      error: null,
      loadBatteryHistory: jest.fn(),
      clearBatteryHistory: jest.fn(),
    });

    render(<BatteryPage />);

    const clearButton = screen.getByRole("button", {
      name: /clear battery history/i,
    });
    expect(clearButton).toBeDisabled();
  });

  it("should show warning dialog when clear button is clicked", async () => {
    const user = userEvent.setup();
    mockUseBatteryHistory.mockReturnValue({
      devices: [
        {
          sourceId: 0,
          deviceName: "Central",
          entries: [{ timestamp: 1000, batteryLevel: 85 }],
        },
      ],
      isLoading: false,
      error: null,
      loadBatteryHistory: jest.fn(),
      clearBatteryHistory: jest.fn(),
    });

    render(<BatteryPage />);

    const clearButton = screen.getByRole("button", {
      name: /clear battery history/i,
    });
    await user.click(clearButton);

    expect(screen.getByText("Clear Battery History?")).toBeInTheDocument();
    expect(
      screen.getByText(/This will permanently delete all battery history/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/This action cannot be undone/i),
    ).toBeInTheDocument();
  });

  it("should close warning dialog when cancel is clicked", async () => {
    const user = userEvent.setup();
    mockUseBatteryHistory.mockReturnValue({
      devices: [
        {
          sourceId: 0,
          deviceName: "Central",
          entries: [{ timestamp: 1000, batteryLevel: 85 }],
        },
      ],
      isLoading: false,
      error: null,
      loadBatteryHistory: jest.fn(),
      clearBatteryHistory: jest.fn(),
    });

    render(<BatteryPage />);

    const clearButton = screen.getByRole("button", {
      name: /clear battery history/i,
    });
    await user.click(clearButton);

    const cancelButton = screen.getByRole("button", { name: /cancel/i });
    await user.click(cancelButton);

    expect(
      screen.queryByText("Clear Battery History?"),
    ).not.toBeInTheDocument();
  });

  it("should call clearBatteryHistory when confirm is clicked", async () => {
    const user = userEvent.setup();
    const mockClearBatteryHistory = jest.fn();

    mockUseBatteryHistory.mockReturnValue({
      devices: [
        {
          sourceId: 0,
          deviceName: "Central",
          entries: [{ timestamp: 1000, batteryLevel: 85 }],
        },
      ],
      isLoading: false,
      error: null,
      loadBatteryHistory: jest.fn(),
      clearBatteryHistory: mockClearBatteryHistory,
    });

    render(<BatteryPage />);

    const clearButton = screen.getByRole("button", {
      name: /clear battery history/i,
    });
    await user.click(clearButton);

    // Find the confirm button in the dialog (not the initial clear button)
    const dialogButtons = screen.getAllByRole("button");
    const confirmButton = dialogButtons.find(
      (button) =>
        button.textContent === "Clear History" && button !== clearButton, // Exclude the initial clear button
    );
    expect(confirmButton).toBeDefined();
    await user.click(confirmButton!);

    expect(mockClearBatteryHistory).toHaveBeenCalledTimes(1);
  });
});
