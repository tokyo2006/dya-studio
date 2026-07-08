import { connectSerial } from "@cormoran/zmk-studio-react-hook";
import { connect as connectWebUsb } from "../webUsb";
import {
  connect,
  isUsbConnectionAvailable,
  shouldUseWebUsbForUsbConnection,
} from "../usb";

jest.mock("@cormoran/zmk-studio-react-hook", () => ({
  connectSerial: jest.fn(),
  isWebSerialSupported: jest.fn(() => "serial" in navigator),
}));

jest.mock("../webUsb", () => ({
  connect: jest.fn(),
}));

type NavigatorWithOptionalTransport = Navigator & {
  serial?: unknown;
  usb?: unknown;
};

const androidChromeUserAgent =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
const desktopChromeUserAgent =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

describe("USB transport selection", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete (navigator as NavigatorWithOptionalTransport).serial;
    delete (navigator as NavigatorWithOptionalTransport).usb;
  });

  test("uses WebUSB for Android Chrome", async () => {
    await connectWithUserAgent(androidChromeUserAgent);

    expect(connectWebUsb).toHaveBeenCalledTimes(1);
    expect(connectSerial).not.toHaveBeenCalled();
  });

  test("uses Web Serial for non-Android Chrome", async () => {
    await connectWithUserAgent(desktopChromeUserAgent);

    expect(connectSerial).toHaveBeenCalledTimes(1);
    expect(connectWebUsb).not.toHaveBeenCalled();
  });

  test("detects Android Chrome user agents", () => {
    expect(shouldUseWebUsbForUsbConnection(androidChromeUserAgent)).toBe(true);
    expect(shouldUseWebUsbForUsbConnection(desktopChromeUserAgent)).toBe(false);
  });

  test("treats Web Serial support as USB-capable", () => {
    Object.defineProperty(navigator, "serial", {
      configurable: true,
      value: { requestPort: jest.fn(), getPorts: jest.fn() },
    });

    expect(isUsbConnectionAvailable()).toBe(true);
  });

  test("treats Android Chrome WebUSB as USB-capable without Web Serial", () => {
    const userAgentSpy = jest
      .spyOn(navigator, "userAgent", "get")
      .mockReturnValue(androidChromeUserAgent);
    Object.defineProperty(navigator, "usb", {
      configurable: true,
      value: { requestDevice: jest.fn() },
    });

    expect(isUsbConnectionAvailable()).toBe(true);

    userAgentSpy.mockRestore();
  });
});

async function connectWithUserAgent(userAgent: string) {
  const userAgentSpy = jest
    .spyOn(navigator, "userAgent", "get")
    .mockReturnValue(userAgent);

  try {
    await connect();
  } finally {
    userAgentSpy.mockRestore();
  }
}
