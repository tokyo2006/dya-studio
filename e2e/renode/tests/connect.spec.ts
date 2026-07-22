import { test, expect } from "@playwright/test";
import { serialShimSource } from "../serial-shim.mjs";

const WS_URL = process.env.WS_URL || "ws://127.0.0.1:8788";

// Name the DUT firmware advertises via GetDeviceInfo. The default DUT is
// zmk-west-commands' real studio-rpc-usb-uart image (renode_tester shield → name
// "Renode"); override for a real dya build.
const DEVICE_NAME = process.env.DEVICE_NAME || "Renode";

test("dya-studio (real app) fully connects to real firmware in Renode over WebSerial", async ({
  page,
}) => {
  const logs: string[] = [];
  page.on("console", (m) => {
    const line = `[${m.type()}] ${m.text()}`;
    logs.push(line);
    if (process.env.E2E_DEBUG) console.log("PAGE " + line);
  });
  page.on("pageerror", (e) => {
    if (process.env.E2E_DEBUG) console.log("PAGE ERROR " + e.message);
  });

  // 1) install the fake navigator.serial (backed by the WS bridge -> the DUT's
  //    emulated USB CDC in Renode)
  await page.addInitScript(serialShimSource(WS_URL));
  // 2) pre-accept the connection notice + force English so the picker/notice
  //    don't get in the way (both are pure UX, unrelated to the transport).
  await page.addInitScript(() => {
    try {
      localStorage.setItem(
        "dya-studio-connection-notice-accepted-serial",
        "1.1.0",
      );
      localStorage.setItem("dya-studio-language", "en");
    } catch {
      /* ignore */
    }
  });

  // The splash screen animates continuously (framer-motion rings/opacity), which
  // keeps the connect button from ever being "stable" for a normal click in CI.
  // Reduce motion and force the click (the button is present and visible).
  await page.emulateMedia({ reducedMotion: "reduce" });

  await page.goto("/");

  // 3) click the REAL "Connect via USB" button -> the app's ts-client serial
  //    transport -> navigator.serial.requestPort()/open() -> our shim -> WS ->
  //    bridge -> the DUT's emulated USB CDC -> the real ZMK firmware.
  const usbButton = page.getByRole("button", { name: /Connect via USB/i });
  await expect(usbButton).toBeVisible();
  await usbButton.click({ force: true });

  // 4) FIRST PROOF — the loop is live: the real firmware's GetDeviceInfo reply,
  //    which carries the device's own name, arrives back in the browser's
  //    (shimmed) WebSerial stream. This is a full protobuf RPC round-trip: the
  //    app framed+encoded a real Request, the emulated firmware decoded it, ran
  //    the real handler, and framed+encoded a real Response the app received.
  await expect
    .poll(() => page.evaluate(() => (window as any).__SHIM_RX__ || ""), {
      timeout: 60_000,
      message: `firmware GetDeviceInfo reply ("${DEVICE_NAME}") never reached the browser over WebSerial`,
    })
    .toContain(DEVICE_NAME);

  // 5) SECOND PROOF — the app reaches the FULLY-CONNECTED screen. The app's
  //    connect handshake (via @cormoran/zmk-studio-react-hook's useZMKApp) does
  //    far more than GetDeviceInfo — including replies well over the ~30 bytes
  //    that Renode's UARTE TX-IRQ model stalls on. The emulated USB CDC
  //    path drains those large bursts, so `isConnected` flips true and the app
  //    swaps the splash for the connected layout: the header shows the device's
  //    own name and the splash "Connect via USB" button is gone.
  await expect(page.locator("header").getByText(DEVICE_NAME)).toBeVisible({
    timeout: 60_000,
  });
  await expect(usbButton).toBeHidden();
});
