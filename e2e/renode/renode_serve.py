#!/usr/bin/env python3
"""Boot a Studio-on-UART ZMK ELF under Renode and hold the emulation running,
exposing the Studio-RPC UART as a plain TCP server socket (Renode's own
CreateServerSocketTerminal). Prints `RPC_PORT=<n>` on stdout once ready, then
blocks until killed.

Design (see POC README): Python attaches ONLY to the console UART (drains it so
the firmware never back-pressures on logs, and so we capture a boot log for
debugging). It deliberately does NOT connect to the Studio-RPC UART -- Renode's
ServerSocketTerminal only serves its first client for the life of the process,
so we leave that socket free for the Node WebSocket bridge, which becomes the
single RPC client. Losing the unsolicited boot notification that the firmware
emits before the bridge attaches is harmless: the real ts-client re-issues
GetDeviceInfo itself.
"""
import os
import socket
import sys
import threading
import time
from pathlib import Path

HARNESS = Path(
    os.environ.get(
        "ZMK_WC_RENODE_LIB",
        str(Path.home() / "zmk-west-commands" / "scripts" / "lib" / "renode"),
    )
)
sys.path.insert(0, str(HARNESS))

from renode_harness import RenodeSession, PLATFORMS_DIR  # noqa: E402


def main() -> None:
    elf = Path(sys.argv[1]).resolve()
    if not elf.exists():
        raise SystemExit(f"ELF not found: {elf}")
    renode = os.environ.get("RENODE_BIN", str(Path.home() / ".renode" / "1.16.1" / "renode"))

    import random

    port_base = int(os.environ.get("RENODE_PORT_BASE", "0")) or random.randint(26000, 40000)
    console_port = port_base + 1
    rpc_port = port_base + 2

    session = RenodeSession(
        renode,
        PLATFORMS_DIR / "single.resc",
        monitor_port=port_base,
        variables={
            "bin": f"@{elf}",
            "console_port": console_port,
            "rpc_port": rpc_port,
        },
        cwd=HARNESS,
    )
    # Renode's mono cold-start can take ~15-20s on a loaded box before the
    # monitor port opens; start()'s deadline is boot_wait + 10s, so give margin.
    session.start(boot_wait=float(os.environ.get("RENODE_BOOT_WAIT", "20")))

    # Attach to the console UART with a RAW socket and drain it continuously in
    # the background. This is essential, not just for logs: a client that
    # connects to Renode's console ServerSocketTerminal but never reads will
    # back-pressure the firmware's log writes and stall it before it can service
    # RPC. (We deliberately do NOT touch the RPC UART socket -- that is left free
    # for the Node bridge, which becomes its single client.)
    deadline = time.monotonic() + 20.0
    console = None
    while time.monotonic() < deadline:
        try:
            console = socket.create_connection(("127.0.0.1", console_port), timeout=2.0)
            break
        except OSError:
            time.sleep(0.3)
    if console is None:
        raise SystemExit("could not connect to console UART socket")
    console.settimeout(1.0)

    def _drain_console() -> None:
        while True:
            try:
                chunk = console.recv(4096)
                if not chunk:
                    time.sleep(0.2)
                    continue
                sys.stderr.buffer.write(chunk)
                sys.stderr.flush()
            except socket.timeout:
                continue
            except OSError:
                return

    threading.Thread(target=_drain_console, daemon=True).start()

    session.go()  # start the emulation

    print(f"RPC_PORT={rpc_port}", flush=True)
    print(f"CONSOLE_PORT={console_port}", flush=True)
    print("RENODE_READY", flush=True)

    try:
        while True:
            time.sleep(3600)
    except KeyboardInterrupt:
        pass
    finally:
        session.stop()


if __name__ == "__main__":
    main()
