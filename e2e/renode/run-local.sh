#!/usr/bin/env bash
# Local (and CI) driver for the WebSerial<->Renode e2e:
#   Renode(real fw, Studio over emulated USB CDC) <- TCP - bridge - WS ->
#   shimmed navigator.serial in headless Chromium running the built dya-studio,
#   driven by Playwright.
#
# Requirements:
#   - Renode 1.16.1 at ~/.renode/1.16.1 (RENODE_BIN to override)
#   - ZMK_WC_RENODE_LIB -> a checkout of cormoran/zmk-west-commands'
#     scripts/lib/renode (the Renode harness + platforms)
#   - DIST_DIR -> a built dya-studio dist (defaults to <repo>/dist)
#   - a real studio-rpc-usb-uart DUT ELF (arg $1)
set -euo pipefail
cd "$(dirname "$0")"
REPO_ROOT="$(cd ../.. && pwd)"

ELF="${1:?usage: run-local.sh <studio-rpc-usb-uart.elf>}"
export DIST_DIR="${DIST_DIR:-$REPO_ROOT/dist}"
export ZMK_WC_RENODE_LIB="${ZMK_WC_RENODE_LIB:?set ZMK_WC_RENODE_LIB to zmk-west-commands/scripts/lib/renode}"
export WS_PORT="${WS_PORT:-8788}"
export WS_URL="ws://127.0.0.1:${WS_PORT}"
export DEVICE_NAME="${DEVICE_NAME:-Renode}"

pids=()
cleanup() {
  for p in "${pids[@]:-}"; do kill "$p" 2>/dev/null || true; done
  # kill only our own Renode instance (scoped to this ELF), never a broad pkill
  pgrep -af '\.renode/1\.16\.1/renode' | grep -F "$ELF" | awk '{print $1}' | xargs -r kill -9 2>/dev/null || true
}
trap cleanup EXIT

echo ">>> [1/3] booting Renode with $ELF (real image; Studio over USB CDC)"
python3 renode_serve.py "$ELF" > renode_serve.out 2> renode_serve.err &
pids+=($!)

# Booting the real image, enumerating USB and wiring the CDC bridge is slower
# than a bare UART boot -- and Renode's mono cold-start can take ~20s on a loaded
# box -- so allow generous time for RENODE_READY.
RPC_PORT=""
for _ in $(seq 1 "${RENODE_READY_TIMEOUT:-180}"); do
  RPC_PORT="$(sed -n 's/^RPC_PORT=//p' renode_serve.out | head -1)"
  [ -n "$RPC_PORT" ] && grep -q RENODE_READY renode_serve.out && break
  sleep 1
done
[ -n "$RPC_PORT" ] || { echo "!! Renode never reported RPC_PORT"; cat renode_serve.err; exit 1; }
echo ">>> Renode Studio USB CDC relayed on TCP :$RPC_PORT"

echo ">>> [2/3] starting WS bridge on $WS_URL"
RPC_PORT="$RPC_PORT" WS_PORT="$WS_PORT" node bridge.mjs > bridge.out 2>&1 &
pids+=($!)
for _ in $(seq 1 20); do grep -q BRIDGE_READY bridge.out && break; sleep 0.5; done
grep -q BRIDGE_READY bridge.out || { echo "!! bridge never ready"; cat bridge.out; exit 1; }

echo ">>> [3/3] running Playwright (DEVICE_NAME=$DEVICE_NAME)"
shift || true
npx playwright test "$@" || { echo "renode log tail:"; tail -20 renode_serve.err; exit 1; }
