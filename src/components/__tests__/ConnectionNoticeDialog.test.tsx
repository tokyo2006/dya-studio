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
    Object.defineProperty(navigator, "serial", {
      writable: true,
      configurable: true,
      value: undefined,
    });
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

    await user.click(screen.getByLabelText("Never show again"));
    await user.click(screen.getByText("Agree to start"));

    expect(onAgree).toHaveBeenCalledTimes(1);
    expect(hasAcceptedNotice("serial")).toBe(true);
  });

  test("calls onAgree but skips saving acceptance when agree button is clicked without checkbox", async () => {
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
    expect(hasAcceptedNotice("serial")).toBe(false);
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
    expect(hasAcceptedNotice("serial")).toBe(false);
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

  test("allows USB connection on Android Chrome when WebUSB is available", () => {
    const onAgree = jest.fn();
    const onCancel = jest.fn();
    const userAgentSpy = jest
      .spyOn(navigator, "userAgent", "get")
      .mockReturnValue(
        "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
      );

    Object.defineProperty(navigator, "serial", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(navigator, "usb", {
      configurable: true,
      value: { requestDevice: jest.fn() },
    });

    render(
      <ConnectionNoticeDialog
        open={true}
        method="serial"
        onAgree={onAgree}
        onCancel={onCancel}
      />,
    );

    expect(screen.getByText("Data Collection Notice")).toBeInTheDocument();
    expect(screen.getByText("Agree to start")).toBeInTheDocument();

    userAgentSpy.mockRestore();
  });
});

describe("hasAcceptedNotice", () => {
  beforeEach(() => {
    mockLocalStorage.clear();
  });

  test("returns false when notice has not been accepted", () => {
    expect(hasAcceptedNotice("serial")).toBe(false);
  });

  test("returns true when current version has been accepted", () => {
    saveNoticeAcceptance("serial");
    expect(hasAcceptedNotice("serial")).toBe(true);
    expect(hasAcceptedNotice("ble")).toBe(false);
  });

  test("returns false when different version has been accepted", () => {
    saveNoticeAcceptance("serial");
    expect(hasAcceptedNotice("serial")).toBe(true);
    mockLocalStorage.setItem(
      "dya-studio-connection-notice-accepted-serial",
      "0.9.0",
    );
    expect(hasAcceptedNotice("serial")).toBe(false);
  });
});

describe("saveNoticeAcceptance", () => {
  beforeEach(() => {
    mockLocalStorage.clear();
  });

  test("saves acceptance to localStorage", () => {
    saveNoticeAcceptance("ble");
    expect(
      mockLocalStorage.getItem("dya-studio-connection-notice-accepted-ble"),
    ).toBeTruthy();
  });
});
