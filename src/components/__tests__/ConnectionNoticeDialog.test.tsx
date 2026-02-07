import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConnectionNoticeDialog } from "../ConnectionNoticeDialog";
import {
  hasAcceptedNotice,
  saveNoticeAcceptance,
} from "../../lib/connectionNoticeStorage";

// Mock localStorage
const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, "localStorage", {
  value: mockLocalStorage,
});

describe("ConnectionNoticeDialog", () => {
  beforeEach(() => {
    mockLocalStorage.clear();
  });

  test("renders USB connection dialog", () => {
    const onAgree = jest.fn();
    const onCancel = jest.fn();

    render(
      <ConnectionNoticeDialog
        open={true}
        method="serial"
        onAgree={onAgree}
        onCancel={onCancel}
      />,
    );

    expect(screen.getByText("Connect via USB")).toBeInTheDocument();
    expect(screen.getByText("Data Collection Notice")).toBeInTheDocument();
    expect(screen.getByText("How to Connect")).toBeInTheDocument();
  });

  test("renders BLE connection dialog", () => {
    const onAgree = jest.fn();
    const onCancel = jest.fn();

    render(
      <ConnectionNoticeDialog
        open={true}
        method="ble"
        onAgree={onAgree}
        onCancel={onCancel}
      />,
    );

    expect(screen.getByText("Connect via Bluetooth")).toBeInTheDocument();
    expect(screen.getByText(/For iOS users/)).toBeInTheDocument();
    expect(screen.getByText(/studio unlock/)).toBeInTheDocument();
  });

  test("calls onAgree and saves acceptance when agree button is clicked", async () => {
    const user = userEvent.setup();
    const onAgree = jest.fn();
    const onCancel = jest.fn();

    render(
      <ConnectionNoticeDialog
        open={true}
        method="serial"
        onAgree={onAgree}
        onCancel={onCancel}
      />,
    );

    await user.click(screen.getByText("Agree to start"));

    expect(onAgree).toHaveBeenCalledTimes(1);
    expect(hasAcceptedNotice()).toBe(true);
  });

  test("calls onCancel when cancel button is clicked", async () => {
    const user = userEvent.setup();
    const onAgree = jest.fn();
    const onCancel = jest.fn();

    render(
      <ConnectionNoticeDialog
        open={true}
        method="serial"
        onAgree={onAgree}
        onCancel={onCancel}
      />,
    );

    await user.click(screen.getByText("Cancel"));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onAgree).not.toHaveBeenCalled();
    expect(hasAcceptedNotice()).toBe(false);
  });

  test("does not render when open is false", () => {
    const onAgree = jest.fn();
    const onCancel = jest.fn();

    render(
      <ConnectionNoticeDialog
        open={false}
        method="serial"
        onAgree={onAgree}
        onCancel={onCancel}
      />,
    );

    expect(screen.queryByText("Connect via USB")).not.toBeInTheDocument();
  });
});

describe("hasAcceptedNotice", () => {
  beforeEach(() => {
    mockLocalStorage.clear();
  });

  test("returns false when notice has not been accepted", () => {
    expect(hasAcceptedNotice()).toBe(false);
  });

  test("returns true when current version has been accepted", () => {
    saveNoticeAcceptance();
    expect(hasAcceptedNotice()).toBe(true);
  });

  test("returns false when different version has been accepted", () => {
    mockLocalStorage.setItem("dya-studio-connection-notice-accepted", "0.9.0");
    expect(hasAcceptedNotice()).toBe(false);
  });
});

describe("saveNoticeAcceptance", () => {
  beforeEach(() => {
    mockLocalStorage.clear();
  });

  test("saves acceptance to localStorage", () => {
    saveNoticeAcceptance();
    expect(
      mockLocalStorage.getItem("dya-studio-connection-notice-accepted"),
    ).toBeTruthy();
  });
});
