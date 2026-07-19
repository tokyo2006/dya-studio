# WebSerial ⇄ Renode end-to-end (POC)

Run the **real dya-studio** in a headless browser and have it talk to **real ZMK
firmware** running in the [Renode](https://renode.io) emulator over the
**WebSerial** API — with no hardware, in CI.

## What this proves

The built dya-studio app, in headless Chromium, using the real
`@zmkfirmware/zmk-studio-ts-client` serial transport (unchanged), performs a full
protobuf `GetDeviceInfo` round-trip against real firmware emulated in Renode, and
the device's own name comes back over the (shimmed) WebSerial stream.

```
dya-studio (dist, headless Chromium)
   │  navigator.serial  ← injected shim: real API surface, ts-client unchanged
   ▼  WebSocket
bridge.mjs (Node)  ──raw TCP (transparent bytes)──▶  Renode ServerSocketTerminal (uart1)
                                                          │
                                                   renode_serve.py  holds real fw.elf running
```

Everything except the browser↔OS serial-driver layer is real: the app, the
transport, the RPC/protobuf framing, and the firmware. Only the last-mile serial
driver is replaced by a WebSocket — there is no serial device in CI anyway.

## Known limitation (why only `GetDeviceInfo` is asserted)

A full app connect next issues `GetCustomSubsystems`, whose reply is >30 bytes.
Renode's nRF52840 **UARTE TX-IRQ model stalls partway through any Studio reply of
~≥30 framed bytes** (confirmed: raising `CONFIG_ZMK_STUDIO_RPC_TX_BUF_SIZE`
64→2048 does not move the stall point → it's the emulator's UARTE model, not
buffer size). So the UI does not reach the connected screen under Renode today.
This is a Renode-fidelity issue in
[zmk-west-commands](https://github.com/cormoran/zmk-west-commands), orthogonal to
the browser integration — on real hardware, or once that TX model drains large
bursts, the same test can assert the connected UI instead.

## Files

| file                    | role                                                                                                                                                                                                                                                                                                                                    |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `renode_serve.py`       | boots the DUT ELF via the zmk-west-commands Renode harness and holds it running; exposes the Studio-RPC UART as a TCP socket. Drains the console UART on a raw socket (an unread console terminal back-pressures the firmware and stalls it); leaves the RPC UART free for the bridge (Renode serves only the first client per socket). |
| `bridge.mjs`            | transparent WebSocket ⇄ Renode-UART-TCP byte pipe (the browser can't open raw TCP).                                                                                                                                                                                                                                                     |
| `serial-shim.mjs`       | injects a `navigator.serial` shim implementing only the SerialPort surface the ts-client uses, bridged to the WebSocket.                                                                                                                                                                                                                |
| `serve.mjs`             | dependency-free static server for the built `dist/`.                                                                                                                                                                                                                                                                                    |
| `tests/connect.spec.ts` | Playwright: clicks the real "Connect via USB" button and asserts the device name round-trips.                                                                                                                                                                                                                                           |
| `run-local.sh`          | orchestrates renode_serve → bridge → Playwright.                                                                                                                                                                                                                                                                                        |

## Run locally

```bash
# prerequisites:
#   - Renode 1.16.1 at ~/.renode/1.16.1
#   - a checkout of cormoran/zmk-west-commands (for the Renode harness)
#   - a built dist/ (npm run build at the repo root)
#   - a Studio-on-UART DUT ELF (CONFIG_ZMK_STUDIO=y + the renode-studio-uart snippet)
cd e2e/renode
npm install && npx playwright install chromium
ZMK_WC_RENODE_LIB=/path/to/zmk-west-commands/scripts/lib/renode \
DEVICE_NAME=Renode \
  bash run-local.sh /path/to/studio-on-uart.elf
POC_DEBUG=1 ...   # verbose page/shim/bridge byte logging
```

CI wiring lives in `.github/workflows/renode-webserial-e2e.yml` (builds the DUT
from zmk-west-commands' Renode fixtures, then runs this). To point at a real dya
keyboard, build its firmware with the `renode-studio-uart` snippet and set
`DEVICE_NAME` to its keyboard name.

## Toward the real flashable image over real USB-CDC (next step)

This POC uses the UART path (the only one a browser can reach). Driving the exact
hardware-flashable image over **real** USB-CDC would require wiring Renode's
`NRF_USBD` and exporting it to the host as `/dev/ttyACM*` via USB/IP → real
WebSerial (untested; a zmk-west-commands concern), plus resolving the ≥30B UARTE
stall above.
