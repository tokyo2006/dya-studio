/**
 * Tests for KeymapPage component
 *
 * This test suite verifies the keymap editor UI,
 * including layer selection, key interaction, and save/discard operations.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KeymapPage } from "../KeymapPage";
import { ConnectionContext } from "../../components/DeviceConnection";
import {
  ZMKAppProvider,
  createConnectedMockZMKApp,
  createMockZMKApp,
} from "@cormoran/zmk-studio-react-hook/testing";
import { INPUT_STREAM_IDENTIFIER } from "../../hooks/useInputStream";

// Mock ResizeObserver for tests
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock the useKeymap hook, keeping the real getKeymapLoadingLabel helper so
// the page renders a proper loading label.
jest.mock("../../hooks/useKeymap", () => ({
  ...jest.requireActual("../../hooks/useKeymap"),
  useKeymap: jest.fn(),
}));
jest.mock("../../hooks/usePhysicalLayoutModules");
// Control the proactive lock state the page reads; default to unlocked so the
// existing tests (which expect Save/Reset) keep passing.
jest.mock("@cormoran/zmk-studio-react-hook", () => ({
  ...jest.requireActual("@cormoran/zmk-studio-react-hook"),
  useStudioLockState: jest.fn(() => ({ locked: false, lockState: "unlocked" })),
}));
import { useKeymap } from "../../hooks/useKeymap";
import { usePhysicalLayoutModules } from "../../hooks/usePhysicalLayoutModules";
import { useStudioLockState } from "@cormoran/zmk-studio-react-hook";

const mockUseKeymap = useKeymap as jest.MockedFunction<typeof useKeymap>;
const mockUseStudioLockState = useStudioLockState as jest.MockedFunction<
  typeof useStudioLockState
>;
const mockUsePhysicalLayoutModules =
  usePhysicalLayoutModules as jest.MockedFunction<
    typeof usePhysicalLayoutModules
  >;

describe("KeymapPage", () => {
  // Default mock context values
  const mockConnectionContext = {
    isConnected: false,
    deviceName: undefined,
    onConnect: jest.fn(),
    onDisconnect: jest.fn(),
    isLoading: false,
    error: null,
  };

  // Test data: mock keymap data
  const mockPhysicalLayouts = {
    activeLayoutIndex: 0,
    layouts: [
      {
        name: "Default",
        keys: [
          { width: 100, height: 100, x: 0, y: 0, r: 0, rx: 0, ry: 0 },
          { width: 100, height: 100, x: 100, y: 0, r: 0, rx: 0, ry: 0 },
          { width: 100, height: 100, x: 200, y: 0, r: 0, rx: 0, ry: 0 },
        ],
      },
    ],
  };

  const mockKeymap = {
    layers: [
      {
        id: 0,
        name: "Base",
        bindings: [
          { behaviorId: 1, param1: 0x04, param2: 0 },
          { behaviorId: 1, param1: 0x05, param2: 0 },
          { behaviorId: 1, param1: 0x06, param2: 0 },
        ],
      },
      {
        id: 1,
        name: "Lower",
        bindings: [
          { behaviorId: 2, param1: 0, param2: 0 },
          { behaviorId: 2, param1: 0, param2: 0 },
          { behaviorId: 2, param1: 0, param2: 0 },
        ],
      },
    ],
    availableLayers: 4,
    maxLayerNameLength: 32,
  };

  const mockBehaviors = new Map([
    [1, { id: 1, displayName: "kp", metadata: [] }],
    [2, { id: 2, displayName: "trans", metadata: [] }],
  ]);

  beforeEach(() => {
    jest.clearAllMocks();

    // Default to unlocked; locked-specific tests override this.
    mockUseStudioLockState.mockReturnValue({
      locked: false,
      lockState: "unlocked",
    });

    // Set default mock return value for useKeymap
    mockUseKeymap.mockReturnValue({
      physicalLayouts: null,
      keymap: null,
      behaviors: new Map(),
      originalBindings: new Map(),
      hasUnsavedChanges: false,
      isLoading: false,
      loadingProgress: null,
      error: null,
      unlockRequired: false,
      loadKeymapData: jest.fn(),
      setBinding: jest.fn().mockResolvedValue(true),
      resetBinding: jest.fn().mockResolvedValue(true),
      resetBindingToDefault: jest.fn().mockResolvedValue(true),
      moveLayer: jest.fn().mockResolvedValue(true),
      addLayer: jest.fn().mockResolvedValue({
        index: 0,
        layer: { id: 0, name: "New", bindings: [] },
      }),
      removeLayer: jest.fn().mockResolvedValue(true),
      restoreLayer: jest
        .fn()
        .mockResolvedValue({ id: 0, name: "Restored", bindings: [] }),
      availableLayers: 4,
      removedLayerIds: [],
      saveChanges: jest.fn().mockResolvedValue(true),
      discardChanges: jest.fn().mockResolvedValue(true),
      resetToDefault: jest.fn().mockResolvedValue(true),
      setActiveLayout: jest.fn().mockResolvedValue(true),
      getOriginalBinding: jest.fn().mockReturnValue(null),
      getDefaultBinding: jest.fn().mockReturnValue(null),
      isBindingModified: jest.fn().mockReturnValue(false),
      isFastKeymapAvailable: false,
      isBindingChangedFromDefault: jest.fn().mockReturnValue(false),
      getBehavior: jest.fn(),
      getBindingDisplayName: jest.fn().mockReturnValue("Key"),
      clearUnlockRequired: jest.fn(),
    });

    mockUsePhysicalLayoutModules.mockReturnValue({
      isAvailable: false,
      modules: [],
      isLoading: false,
      error: null,
      loadModules: jest.fn(),
    });
  });

  /**
   * Helper function to render the component with custom context and hook values
   */
  const renderComponent = (
    connectionOverrides = {},
    keymapOverrides = {},
    zmkApp = createMockZMKApp(),
  ) => {
    const connectionContext = {
      ...mockConnectionContext,
      ...connectionOverrides,
    };
    const keymapHookReturn = { ...mockUseKeymap(), ...keymapOverrides };
    mockUseKeymap.mockReturnValue(keymapHookReturn);

    return render(
      <ConnectionContext.Provider value={connectionContext}>
        <ZMKAppProvider value={zmkApp}>
          <KeymapPage />
        </ZMKAppProvider>
      </ConnectionContext.Provider>,
    );
  };

  const mockPhysicalLayoutModule = {
    kind: "trackball" as const,
    identifier: "trackball0",
    displayName: "Primary Trackball",
    label: "Trackball",
    enabled: true,
    attrs: {
      width: 34,
      height: 34,
      x: 350,
      y: 25,
      r: 0,
      rx: 0,
      ry: 0,
    },
    links: [
      {
        deviceIdentifier: "trackball_sensor",
        subsystemIdentifier: "zmk__trackball",
      },
    ],
  };

  describe("Disconnected State", () => {
    it("should render header correctly", () => {
      renderComponent();
      expect(screen.getByText("Keymap")).toBeInTheDocument();
      expect(
        screen.getByText("Configure key bindings and layers"),
      ).toBeInTheDocument();
    });

    it("should show connect message when not connected", () => {
      renderComponent();
      expect(
        screen.getByText("Connect your keyboard to edit keymaps"),
      ).toBeInTheDocument();
    });

    it("should not show layer tabs when disconnected", () => {
      renderComponent({ isConnected: false }, { keymap: mockKeymap });
      expect(screen.queryByText("Base")).not.toBeInTheDocument();
    });
  });

  describe("Connected State - Loading", () => {
    it("should show loading state", () => {
      renderComponent({ isConnected: true }, { isLoading: true, keymap: null });
      expect(screen.getByText("Loading keymap data...")).toBeInTheDocument();
    });
  });

  describe("Connected State - Error", () => {
    it("should show error message", () => {
      renderComponent(
        { isConnected: true },
        {
          error: "Failed to load keymap",
          keymap: mockKeymap,
          physicalLayouts: mockPhysicalLayouts,
        },
      );
      expect(screen.getByText("Failed to load keymap")).toBeInTheDocument();
    });
  });

  describe("Connected State - Loaded", () => {
    it("should render layer tabs when connected", () => {
      renderComponent(
        { isConnected: true },
        {
          keymap: mockKeymap,
          physicalLayouts: mockPhysicalLayouts,
          behaviors: mockBehaviors,
        },
      );

      expect(screen.getByText("Base")).toBeInTheDocument();
      expect(screen.getByText("Lower")).toBeInTheDocument();
    });

    it("should show unsaved changes indicator", () => {
      renderComponent(
        { isConnected: true },
        {
          keymap: mockKeymap,
          physicalLayouts: mockPhysicalLayouts,
          behaviors: mockBehaviors,
          hasUnsavedChanges: true,
        },
      );

      expect(screen.getByText("● Unsaved changes")).toBeInTheDocument();
    });

    it("should show save and reset buttons when connected", () => {
      renderComponent(
        { isConnected: true },
        {
          keymap: mockKeymap,
          physicalLayouts: mockPhysicalLayouts,
          behaviors: mockBehaviors,
        },
      );

      expect(screen.getByText("Save")).toBeInTheDocument();
      expect(screen.getByText("Discard")).toBeInTheDocument();
      expect(screen.getByText("Reset")).toBeInTheDocument();
    });

    it("disables Reset when the fast-keymap subsystem is unavailable", () => {
      renderComponent(
        { isConnected: true },
        {
          keymap: mockKeymap,
          physicalLayouts: mockPhysicalLayouts,
          behaviors: mockBehaviors,
          isFastKeymapAvailable: false,
        },
      );

      expect(screen.getByText("Reset").closest("button")).toBeDisabled();
    });

    it("resets to default via the confirmation dialog when fast-keymap is available", async () => {
      const user = userEvent.setup();
      const resetToDefault = jest.fn().mockResolvedValue(true);
      renderComponent(
        { isConnected: true },
        {
          keymap: mockKeymap,
          physicalLayouts: mockPhysicalLayouts,
          behaviors: mockBehaviors,
          isFastKeymapAvailable: true,
          resetToDefault,
        },
      );

      const resetButton = screen.getByText("Reset").closest("button");
      expect(resetButton).not.toBeDisabled();
      await user.click(resetButton!);

      // Confirmation dialog appears; reset only fires after confirming.
      expect(screen.getByText("Reset to default keymap?")).toBeInTheDocument();
      expect(resetToDefault).not.toHaveBeenCalled();

      await user.click(screen.getByText("Reset to default"));
      expect(resetToDefault).toHaveBeenCalledTimes(1);
    });

    it("shows a Locked badge instead of Save/Reset when Studio is locked", () => {
      mockUseStudioLockState.mockReturnValue({
        locked: true,
        lockState: "locked",
      });
      renderComponent(
        { isConnected: true },
        {
          keymap: mockKeymap,
          physicalLayouts: mockPhysicalLayouts,
          behaviors: mockBehaviors,
        },
      );

      expect(screen.getByText("Locked")).toBeInTheDocument();
      expect(screen.queryByText("Save")).not.toBeInTheDocument();
      expect(screen.queryByText("Discard")).not.toBeInTheDocument();
      expect(screen.queryByText("Reset")).not.toBeInTheDocument();
    });

    it("opens the unlock prompt when the Locked badge is clicked", async () => {
      const user = userEvent.setup();
      mockUseStudioLockState.mockReturnValue({
        locked: true,
        lockState: "locked",
      });
      renderComponent(
        { isConnected: true },
        {
          keymap: mockKeymap,
          physicalLayouts: mockPhysicalLayouts,
          behaviors: mockBehaviors,
        },
      );

      expect(
        screen.queryByText("Keyboard Unlock Required"),
      ).not.toBeInTheDocument();
      await user.click(screen.getByText("Locked"));
      expect(screen.getByText("Keyboard Unlock Required")).toBeInTheDocument();
    });

    it("should show stream mode toggle when input stream subsystem is available", () => {
      renderComponent(
        { isConnected: true },
        {
          keymap: mockKeymap,
          physicalLayouts: mockPhysicalLayouts,
          behaviors: mockBehaviors,
        },
        createConnectedMockZMKApp({
          subsystems: [INPUT_STREAM_IDENTIFIER],
        }),
      );

      expect(screen.getByLabelText("Toggle stream mode")).toBeInTheDocument();
    });

    it("should disable save button when no unsaved changes", () => {
      renderComponent(
        { isConnected: true },
        {
          keymap: mockKeymap,
          physicalLayouts: mockPhysicalLayouts,
          behaviors: mockBehaviors,
          hasUnsavedChanges: false,
        },
      );

      const saveButton = screen.getByText("Save").closest("button");
      expect(saveButton).toBeDisabled();
    });

    it("should enable save button when there are unsaved changes", () => {
      renderComponent(
        { isConnected: true },
        {
          keymap: mockKeymap,
          physicalLayouts: mockPhysicalLayouts,
          behaviors: mockBehaviors,
          hasUnsavedChanges: true,
        },
      );

      const saveButton = screen.getByText("Save").closest("button");
      expect(saveButton).not.toBeDisabled();
    });

    it("should render physical layout modules in the preview", () => {
      mockUsePhysicalLayoutModules.mockReturnValue({
        isAvailable: true,
        modules: [mockPhysicalLayoutModule],
        isLoading: false,
        error: null,
        loadModules: jest.fn(),
      });

      renderComponent(
        { isConnected: true },
        {
          keymap: mockKeymap,
          physicalLayouts: mockPhysicalLayouts,
          behaviors: mockBehaviors,
        },
      );

      expect(screen.getByLabelText("Primary Trackball")).toBeInTheDocument();
      expect(screen.getByText("Trackball")).toBeInTheDocument();
    });
  });

  describe("Layer Selection", () => {
    it("should switch layers when clicking layer tab", async () => {
      const user = userEvent.setup();
      renderComponent(
        { isConnected: true },
        {
          keymap: mockKeymap,
          physicalLayouts: mockPhysicalLayouts,
          behaviors: mockBehaviors,
        },
      );

      const lowerTab = screen.getByText("Lower");
      await user.click(lowerTab);

      // The Lower tab should now have the active styling
      expect(lowerTab.closest("button")).toHaveClass(
        "bg-[var(--color-electric)]/20",
      );
    });
  });

  describe("Layer Reordering", () => {
    it("should show layer reorder buttons", () => {
      renderComponent(
        { isConnected: true },
        {
          keymap: mockKeymap,
          physicalLayouts: mockPhysicalLayouts,
          behaviors: mockBehaviors,
        },
      );

      expect(
        screen.getByLabelText("Move layer up (higher priority)"),
      ).toBeInTheDocument();
      expect(
        screen.getByLabelText("Move layer down (lower priority)"),
      ).toBeInTheDocument();
    });

    it("should disable move up button for first layer", () => {
      renderComponent(
        { isConnected: true },
        {
          keymap: mockKeymap,
          physicalLayouts: mockPhysicalLayouts,
          behaviors: mockBehaviors,
        },
      );

      const moveUpButton = screen.getByLabelText(
        "Move layer up (higher priority)",
      );
      expect(moveUpButton).toBeDisabled();
    });

    it("should call moveLayer when clicking move down", async () => {
      const user = userEvent.setup();
      const mockMoveLayer = jest.fn().mockResolvedValue(true);
      renderComponent(
        { isConnected: true },
        {
          keymap: mockKeymap,
          physicalLayouts: mockPhysicalLayouts,
          behaviors: mockBehaviors,
          moveLayer: mockMoveLayer,
        },
      );

      const moveDownButton = screen.getByLabelText(
        "Move layer down (lower priority)",
      );
      await user.click(moveDownButton);

      expect(mockMoveLayer).toHaveBeenCalledWith(0, 1);
    });
  });

  describe("Unlock Prompt", () => {
    it("should not show unlock prompt by default", () => {
      renderComponent(
        { isConnected: true },
        {
          unlockRequired: false,
        },
      );

      expect(
        screen.queryByText("Keyboard Unlock Required"),
      ).not.toBeInTheDocument();
    });

    // Note: Dialog testing requires portal rendering support
    // which may not work in all test environments
  });

  describe("Help Text", () => {
    it("should show help text when connected", () => {
      renderComponent(
        { isConnected: true },
        {
          keymap: mockKeymap,
          physicalLayouts: mockPhysicalLayouts,
          behaviors: mockBehaviors,
        },
      );

      expect(
        screen.getByText(/Click on a key to modify its binding/),
      ).toBeInTheDocument();
    });

    it("should show different help text when disconnected", () => {
      renderComponent();
      expect(
        screen.getByText(
          "Connect your keyboard to edit keymaps. Click on a key to modify its binding.",
        ),
      ).toBeInTheDocument();
    });
  });
});
