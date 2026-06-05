import type { RpcTransport } from "@zmkfirmware/zmk-studio-ts-client/transport/index";
import { connect as connectSerial } from "@zmkfirmware/zmk-studio-ts-client/transport/serial";
import { connect as connectWebUsb } from "./webUsb";

export function shouldUseWebUsbForUsbConnection(
  userAgent = navigator.userAgent,
) {
  return /\bAndroid\b/i.test(userAgent) && /\bChrome\//i.test(userAgent);
}

export function isUsbConnectionAvailable() {
  return (
    "serial" in navigator ||
    (shouldUseWebUsbForUsbConnection() && "usb" in navigator)
  );
}

export async function connect(): Promise<RpcTransport> {
  if (shouldUseWebUsbForUsbConnection()) {
    return connectWebUsb();
  }
  return connectSerial();
}
