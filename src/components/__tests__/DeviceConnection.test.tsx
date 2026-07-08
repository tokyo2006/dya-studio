import {
  render,
  screen,
  waitFor,
  renderHook,
  act,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  DeviceConnectionProvider,
  ConnectionContext,
} from "../DeviceConnection";
import { useContext } from "react";
import { useZMKApp } from "@cormoran/zmk-studio-react-hook";
import { setupZMKMocks } from "@cormoran/zmk-studio-react-hook/testing";

// Mock the ZMK Studio client
jest.mock("@zmkfirmware/zmk-studio-ts-client", () => ({
  create_rpc_connection: jest.fn(),
  call_rpc: jest.fn(),
}));

// Mock the serial transport
jest.mock("@zmkfirmware/zmk-studio-ts-client/transport/serial", () => ({
  connect: jest.fn(),
}));

// Mock the app-level USB transport selector
jest.mock("../../lib/transport/usb", () => ({
  connect: jest.fn(),
}));

// Mock the BLE transport
jest.mock("@zmkfirmware/zmk-studio-ts-client/transport/gatt", () => ({
  connect: jest.fn(),
}));

// Test component to verify ConnectionContext values
function TestComponent() {
  const connection = useContext(ConnectionContext);

  return (
    <div>
      <div data-testid="connection-status">
        {connection.isConnected ? "Connected" : "Disconnected"}
      </div>
      {connection.deviceName && (
        <div data-testid="device-name">{connection.deviceName}</div>
      )}
      {connection.isLoading && <div data-testid="loading">Loading...</div>}
      {connection.error && <div data-testid="error">{connection.error}</div>}
      {connection.isReconnecting && (
        <div data-testid="reconnecting">Reconnecting...</div>
      )}
      <button
        onClick={() => connection.onConnect("serial")}
        data-testid="connect-button"
      >
        Connect
      </button>
      <button onClick={connection.onDisconnect} data-testid="disconnect-button">
        Disconnect
      </button>
      <button
        onClick={connection.onCancelReconnect}
        data-testid="cancel-reconnect-button"
      >
        Cancel Reconnect
      </button>
    </div>
  );
}

/** Builds a mock `SerialPort`-like object suitable for the auto-reconnect flow. */
function createMockSerialPort(overrides: Record<string, unknown> = {}) {
  return {
    open: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
    getInfo: jest
      .fn()
      .mockReturnValue({ usbVendorId: 0x1234, usbProductId: 0x5678 }),
    readable: { cancel: jest.fn().mockResolvedValue(undefined) },
    writable: { close: jest.fn().mockResolvedValue(undefined) },
    ...overrides,
  };
}

/** Makes `navigator.serial.getPorts()` resolve to the given paired ports. */
function setPairedSerialPorts(ports: unknown[]) {
  Object.defineProperty(navigator, "serial", {
    configurable: true,
    value: { getPorts: jest.fn().mockResolvedValue(ports) },
  });
}

type NavigatorWithOptionalSerial = Navigator & { serial?: unknown };

describe("DeviceConnection", () => {
  let mocks: ReturnType<typeof setupZMKMocks>;

  beforeEach(() => {
    // Reset mocks using the test helper
    mocks = setupZMKMocks();
    // Auto-reconnect remembers ports in sessionStorage; start each test clean.
    window.sessionStorage.clear();
  });

  afterEach(() => {
    delete (navigator as NavigatorWithOptionalSerial).serial;
  });

  describe("Initial State", () => {
    test("renders with disconnected state initially", () => {
      render(
        <DeviceConnectionProvider>
          <TestComponent />
        </DeviceConnectionProvider>,
      );

      expect(screen.getByTestId("connection-status")).toHaveTextContent(
        "Disconnected",
      );
      expect(screen.getByTestId("connect-button")).toBeInTheDocument();
    });

    test("does not show device name when disconnected", () => {
      render(
        <DeviceConnectionProvider>
          <TestComponent />
        </DeviceConnectionProvider>,
      );

      expect(screen.queryByTestId("device-name")).not.toBeInTheDocument();
    });
  });

  describe("Connection Flow", () => {
    test("successfully connects to keyboard", async () => {
      const user = userEvent.setup();

      // Configure mocks for successful connection
      mocks.mockSuccessfulConnection({
        deviceName: "DYA Keyboard",
        subsystems: [],
      });

      render(
        <DeviceConnectionProvider>
          <TestComponent />
        </DeviceConnectionProvider>,
      );

      const connectButton = screen.getByTestId("connect-button");
      await user.click(connectButton);

      // Wait for connection to complete
      await waitFor(() => {
        expect(screen.getByTestId("connection-status")).toHaveTextContent(
          "Connected",
        );
      });

      // Verify device name is displayed
      expect(screen.getByTestId("device-name")).toHaveTextContent(
        "DYA Keyboard",
      );
    });

    test("disconnects from keyboard", async () => {
      const user = userEvent.setup();

      // Configure mocks for successful connection
      mocks.mockSuccessfulConnection({
        deviceName: "DYA Keyboard",
      });

      render(
        <DeviceConnectionProvider>
          <TestComponent />
        </DeviceConnectionProvider>,
      );

      // Connect first
      await user.click(screen.getByTestId("connect-button"));

      await waitFor(() => {
        expect(screen.getByTestId("connection-status")).toHaveTextContent(
          "Connected",
        );
      });

      // Click disconnect
      const disconnectButton = screen.getByTestId("disconnect-button");
      await user.click(disconnectButton);

      await waitFor(() => {
        expect(screen.getByTestId("connection-status")).toHaveTextContent(
          "Disconnected",
        );
      });

      expect(screen.queryByTestId("device-name")).not.toBeInTheDocument();
    });
  });

  describe("Error Handling", () => {
    test("shows error when Web Serial API is not supported", async () => {
      const user = userEvent.setup();
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

      // Mock connection failure
      mocks.mockFailedConnection(
        "Web Serial API is not supported in this browser",
      );

      render(
        <DeviceConnectionProvider>
          <TestComponent />
        </DeviceConnectionProvider>,
      );

      const connectButton = screen.getByTestId("connect-button");
      await user.click(connectButton);

      await waitFor(() => {
        const errorElement = screen.queryByTestId("error");
        expect(errorElement).toBeInTheDocument();
        expect(errorElement).toHaveTextContent(
          "Web Serial API is not supported in this browser",
        );
      });

      consoleErrorSpy.mockRestore();
    });

    test("handles connection errors", async () => {
      const user = userEvent.setup();
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

      // Mock connection error
      mocks.mockFailedConnection("Failed to open serial port");

      render(
        <DeviceConnectionProvider>
          <TestComponent />
        </DeviceConnectionProvider>,
      );

      const connectButton = screen.getByTestId("connect-button");
      await user.click(connectButton);

      await waitFor(() => {
        expect(screen.getByTestId("error")).toHaveTextContent(
          "Failed to open serial port",
        );
      });

      consoleErrorSpy.mockRestore();
    });

    test("handles device info fetch failure", async () => {
      const user = userEvent.setup();
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

      // Mock device info failure
      mocks.mockFailedDeviceInfo();

      render(
        <DeviceConnectionProvider>
          <TestComponent />
        </DeviceConnectionProvider>,
      );

      const connectButton = screen.getByTestId("connect-button");
      await user.click(connectButton);

      await waitFor(() => {
        expect(screen.queryByTestId("error")).toBeInTheDocument();
      });

      consoleErrorSpy.mockRestore();
    });

    test("handles user cancellation of port selection", async () => {
      const user = userEvent.setup();
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

      // Mock connection failure (user cancelled)
      mocks.mockFailedConnection("User cancelled port selection");

      render(
        <DeviceConnectionProvider>
          <TestComponent />
        </DeviceConnectionProvider>,
      );

      const connectButton = screen.getByTestId("connect-button");
      await user.click(connectButton);

      // Should show error when user cancels
      await waitFor(
        () => {
          expect(screen.queryByTestId("error")).toBeInTheDocument();
        },
        { timeout: 2000 },
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe("useZMKApp Integration", () => {
    test("useZMKApp hook works correctly", async () => {
      // Configure mocks for successful connection
      mocks.mockSuccessfulConnection({
        deviceName: "Test Device",
        subsystems: ["test-subsystem"],
      });

      const { result } = renderHook(() => useZMKApp());

      expect(result.current.isConnected).toBe(false);

      const connectFn = jest.fn().mockResolvedValue(mocks.mockTransport);

      await act(async () => {
        await result.current.connect(connectFn);
      });

      // Wait for connection state to update
      await waitFor(
        () => {
          expect(result.current.isConnected).toBe(true);
        },
        { timeout: 3000 },
      );
      expect(result.current.state.deviceInfo?.name).toBe("Test Device");
    });

    test("findSubsystem works after connection", async () => {
      // Configure mocks for successful connection
      mocks.mockSuccessfulConnection({
        deviceName: "Test Device",
        subsystems: ["custom-subsystem"],
      });

      const { result } = renderHook(() => useZMKApp());

      const connectFn = jest.fn().mockResolvedValue(mocks.mockTransport);

      await act(async () => {
        await result.current.connect(connectFn);
      });

      // Wait for connection to be established
      await waitFor(
        () => {
          expect(result.current.isConnected).toBe(true);
        },
        { timeout: 3000 },
      );

      const subsystem = result.current.findSubsystem("custom-subsystem");
      expect(subsystem).not.toBeNull();
      expect(subsystem?.identifier).toBe("custom-subsystem");
    });

    test("disconnect clears all state", async () => {
      // Configure mocks for successful connection
      mocks.mockSuccessfulConnection({
        deviceName: "Test Device",
        subsystems: [],
      });

      const { result } = renderHook(() => useZMKApp());

      const connectFn = jest.fn().mockResolvedValue(mocks.mockTransport);

      // Connect first
      await act(async () => {
        await result.current.connect(connectFn);
      });

      expect(result.current.isConnected).toBe(true);

      // Then disconnect
      act(() => {
        result.current.disconnect();
      });

      expect(result.current.isConnected).toBe(false);
      expect(result.current.state.deviceInfo).toBeNull();
      expect(result.current.state.connection).toBeNull();
    });
  });

  describe("ConnectionContext Values", () => {
    test("provides correct context values when disconnected", () => {
      render(
        <DeviceConnectionProvider>
          <TestComponent />
        </DeviceConnectionProvider>,
      );

      expect(screen.getByTestId("connection-status")).toHaveTextContent(
        "Disconnected",
      );
      expect(screen.queryByTestId("device-name")).not.toBeInTheDocument();
      expect(screen.queryByTestId("loading")).not.toBeInTheDocument();
      expect(screen.queryByTestId("error")).not.toBeInTheDocument();
    });

    test("onConnect callback is defined and functional", () => {
      render(
        <DeviceConnectionProvider>
          <TestComponent />
        </DeviceConnectionProvider>,
      );

      const connectButton = screen.getByTestId("connect-button");
      expect(connectButton).toBeEnabled();
    });

    test("onDisconnect callback is defined and functional", () => {
      render(
        <DeviceConnectionProvider>
          <TestComponent />
        </DeviceConnectionProvider>,
      );

      const disconnectButton = screen.getByTestId("disconnect-button");
      expect(disconnectButton).toBeEnabled();
    });

    test("provides device name when connected", async () => {
      const user = userEvent.setup();

      // Configure mocks for successful connection
      mocks.mockSuccessfulConnection({
        deviceName: "My Keyboard",
        subsystems: [],
      });

      render(
        <DeviceConnectionProvider>
          <TestComponent />
        </DeviceConnectionProvider>,
      );

      await user.click(screen.getByTestId("connect-button"));

      await waitFor(() => {
        expect(screen.getByTestId("device-name")).toHaveTextContent(
          "My Keyboard",
        );
      });
    });
  });

  describe("Auto-reconnect on mount", () => {
    test("renders children in the disconnected state when there is no paired serial port", async () => {
      // jsdom has no navigator.serial by default, so the app-driven
      // auto-reconnect attempt resolves to "nothing to reconnect to" and the
      // normal connect screen shows immediately -- isReconnecting never
      // becomes true.
      render(
        <DeviceConnectionProvider reconnectMinDisplayMs={0}>
          <TestComponent />
        </DeviceConnectionProvider>,
      );

      // Let the auto-reconnect effect (and its microtasks) settle.
      await waitFor(() => {
        expect(screen.getByTestId("connection-status")).toHaveTextContent(
          "Disconnected",
        );
      });
      expect(screen.getByTestId("connect-button")).toBeInTheDocument();
      expect(screen.queryByTestId("device-name")).not.toBeInTheDocument();
      expect(screen.queryByTestId("reconnecting")).not.toBeInTheDocument();
    });

    test("transitions to connected when a previously paired serial port reconnects successfully", async () => {
      mocks.mockSuccessfulConnection({
        deviceName: "Auto Reconnected Keyboard",
      });

      const mockPort = createMockSerialPort();
      setPairedSerialPorts([mockPort]);

      render(
        <DeviceConnectionProvider reconnectMinDisplayMs={0}>
          <TestComponent />
        </DeviceConnectionProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("connection-status")).toHaveTextContent(
          "Connected",
        );
      });
      expect(screen.getByTestId("device-name")).toHaveTextContent(
        "Auto Reconnected Keyboard",
      );
      expect(mockPort.open).toHaveBeenCalledWith({ baudRate: 12500 });
      expect(screen.queryByTestId("reconnecting")).not.toBeInTheDocument();
    });

    test("exposes isReconnecting while the attempt is in flight, then clears it once connected", async () => {
      mocks.mockSuccessfulConnection({ deviceName: "Slow Reconnect" });

      // Keep `port.open()` pending until the test explicitly resolves it, so
      // we can observe the in-between isReconnecting: true state.
      let resolveOpen: () => void = () => {};
      const openPromise = new Promise<void>((resolve) => {
        resolveOpen = resolve;
      });
      const mockPort = createMockSerialPort({
        open: jest.fn().mockReturnValue(openPromise),
      });
      setPairedSerialPorts([mockPort]);

      render(
        <DeviceConnectionProvider reconnectMinDisplayMs={0}>
          <TestComponent />
        </DeviceConnectionProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("reconnecting")).toBeInTheDocument();
      });
      expect(screen.getByTestId("connection-status")).toHaveTextContent(
        "Disconnected",
      );

      resolveOpen();

      await waitFor(() => {
        expect(screen.queryByTestId("reconnecting")).not.toBeInTheDocument();
      });
      await waitFor(() => {
        expect(screen.getByTestId("connection-status")).toHaveTextContent(
          "Connected",
        );
      });
      expect(screen.getByTestId("device-name")).toHaveTextContent(
        "Slow Reconnect",
      );
    });

    test("cancelling a pending reconnect stays disconnected even if the transport later resolves", async () => {
      const user = userEvent.setup();
      mocks.mockSuccessfulConnection({ deviceName: "Should Not Connect" });

      let resolveOpen: () => void = () => {};
      const openPromise = new Promise<void>((resolve) => {
        resolveOpen = resolve;
      });
      const mockPort = createMockSerialPort({
        open: jest.fn().mockReturnValue(openPromise),
      });
      setPairedSerialPorts([mockPort]);

      render(
        <DeviceConnectionProvider reconnectMinDisplayMs={0}>
          <TestComponent />
        </DeviceConnectionProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("reconnecting")).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("cancel-reconnect-button"));

      // Cancelling returns to the non-reconnecting disconnected state
      // immediately, without waiting for the transport.
      expect(screen.queryByTestId("reconnecting")).not.toBeInTheDocument();
      expect(screen.getByTestId("connection-status")).toHaveTextContent(
        "Disconnected",
      );

      // Now let the (cancelled) transport resolve -- the app must not
      // become connected even though a transport was obtained.
      resolveOpen();
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(screen.getByTestId("connection-status")).toHaveTextContent(
        "Disconnected",
      );
      expect(screen.queryByTestId("device-name")).not.toBeInTheDocument();
    });

    test("keeps the reconnecting indicator visible for at least reconnectMinDisplayMs even on an instant success", async () => {
      mocks.mockSuccessfulConnection({ deviceName: "Fast Reconnect" });
      const mockPort = createMockSerialPort();
      setPairedSerialPorts([mockPort]);

      render(
        <DeviceConnectionProvider reconnectMinDisplayMs={300}>
          <TestComponent />
        </DeviceConnectionProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("reconnecting")).toBeInTheDocument();
      });

      // The underlying reconnect resolves almost instantly, but the
      // indicator must still be showing well before the minimum elapses.
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(screen.getByTestId("reconnecting")).toBeInTheDocument();
      expect(screen.getByTestId("connection-status")).toHaveTextContent(
        "Disconnected",
      );

      await waitFor(
        () => {
          expect(screen.queryByTestId("reconnecting")).not.toBeInTheDocument();
        },
        { timeout: 2000 },
      );
      expect(screen.getByTestId("connection-status")).toHaveTextContent(
        "Connected",
      );
    });
  });
});
