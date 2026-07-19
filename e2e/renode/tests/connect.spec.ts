import { test, expect } from "@playwright/test";
import { serialShimSource } from "../serial-shim.mjs";

const WS_URL = process.env.WS_URL || "ws://127.0.0.1:8788";

// Name the DUT firmware advertises via GetDeviceInfo. The POC ships the
// zmk-west-commands renode-studio-uart DUT ("Module Test"); override for a
// real dya build.
const DEVICE_NAME = process.env.DEVICE_NAME || "Module Test";

test("dya-studio (real app) talks to the real firmware in Renode over WebSerial", async ({
  page,
}) => {
  const logs: string[] = [];
  page.on("console", (m) => {
    const line = `[${m.type()}] ${m.text()}`;
    logs.push(line);
    if (process.env.POC_DEBUG) console.log("PAGE " + line);
  });
  page.on("pageerror", (e) => {
    if (process.env.POC_DEBUG) console.log("PAGE ERROR " + e.message);
  });

  // 1) install the fake navigator.serial (backed by the WS bridge -> Renode UART)
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
  //    bridge -> Renode UART -> the real ZMK firmware.
  const usbButton = page.getByRole("button", { name: /Connect via USB/i });
  await expect(usbButton).toBeVisible();
  await usbButton.click({ force: true });

  // 4) PROOF of the end-to-end loop: the real firmware's GetDeviceInfo reply,
  //    which carries the device's own name, must arrive back in the browser's
  //    (shimmed) WebSerial stream. This is a full protobuf RPC round-trip:
  //    the app framed+encoded a real Request, the emulated firmware decoded it,
  //    ran the real handler, and framed+encoded a real Response that the app
  //    received. Asserting on the received bytes (rather than the fully-
  //    connected UI) is deliberate -- see the KNOWN LIMITATION below.
  await expect
    .poll(() => page.evaluate(() => (window as any).__SHIM_RX__ || ""), {
      timeout: 60_000,
      message: `firmware GetDeviceInfo reply ("${DEVICE_NAME}") never reached the browser over WebSerial`,
    })
    .toContain(DEVICE_NAME);

  // KNOWN LIMITATION (documented, pre-existing, NOT a browser-integration bug):
  // the app's full connect handshake then issues GetCustomSubsystems, whose
  // reply is >30 bytes. Renode's nRF52840 UARTE TX-IRQ model stalls partway
  // through any Studio response of ~>=30 framed bytes (confirmed: raising
  // CONFIG_ZMK_STUDIO_RPC_TX_BUF_SIZE 64->2048 did NOT change the stall point,
  // ruling out buffer size and pointing at the emulator's UARTE TX-IRQ model).
  // So the UI does not reach the fully-connected screen under Renode today.
  // On real hardware, or once zmk-west-commands' Renode UARTE model drains
  // large TX bursts, this same test can assert the connected UI instead.
});
