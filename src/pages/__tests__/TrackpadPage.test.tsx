import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TrackpadPage } from "../TrackpadPage";
import { useCirque, type UseCirqueReturn } from "../../hooks/useCirque";
import { useTps43, type UseTps43Return } from "../../hooks/useTps43";
import { CIRQUE_DEFAULT_STATE } from "../../lib/transport/demo-cirque";
import { TPS43_DEFAULT_STATE } from "../../lib/transport/demo-tps43";

jest.mock("../../hooks/useCirque", () => ({
  ...jest.requireActual("../../hooks/useCirque"),
  useCirque: jest.fn(),
}));

jest.mock("../../hooks/useTps43", () => ({
  ...jest.requireActual("../../hooks/useTps43"),
  useTps43: jest.fn(),
}));

const mockUseCirque = useCirque as jest.MockedFunction<typeof useCirque>;
const mockUseTps43 = useTps43 as jest.MockedFunction<typeof useTps43>;

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
    refresh: jest.fn().mockResolvedValue(undefined),
    state: null,
    values: null,
    isLoading: false,
    isResetting: false,
    error: null,
    writeState: "idle",
    load: jest.fn(),
    update: jest.fn(),
    reset: jest.fn().mockResolvedValue(true),
    ...overrides,
  };
  mockUseTps43.mockReturnValue(value);
  return value;
}

beforeEach(() => {
  // TrackpadPage renders the Cirque panel unless a TPS43 subsystem is present.
  mockTps43Hook({ isAvailable: false });
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

  it("renders the TPS43 panel when the TPS43 subsystem is present", async () => {
    const hook = mockTps43Hook({
      isAvailable: true,
      state: TPS43_DEFAULT_STATE,
      values: TPS43_DEFAULT_STATE,
    });
    render(<TrackpadPage />);

    expect(screen.getByText("Gestures")).toBeInTheDocument();
    expect(screen.getByText("Filtering")).toBeInTheDocument();
    expect(
      screen.getByRole("switch", { name: "One-finger Tap" }),
    ).not.toBeChecked();

    await userEvent.click(screen.getByRole("switch", { name: "Flip X" }));
    expect(hook.update).toHaveBeenCalledWith({ flipX: true });

    expect(screen.getByRole("slider", { name: "Bottom Beta" })).toHaveValue(
      "5",
    );
  });
});
