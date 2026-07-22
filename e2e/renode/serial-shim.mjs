// Returns the source of an init script that installs a fake `navigator.serial`
// backed by a WebSocket: the real dya-studio app, the real
// @zmkfirmware/zmk-studio-ts-client serial transport, the real RPC/protobuf
// framing and the real firmware (in Renode) all run unchanged -- only the
// browser<->OS serial driver layer is replaced by a WebSocket to the bridge
// (there is no real serial device in CI).
//
// It implements exactly the SerialPort surface the ts-client uses
// (requestPort/getPorts, port.open/getInfo/close, port.readable/.writable as
// Web Streams) plus EventTarget so any 'connect'/'disconnect' listeners are safe.
export function serialShimSource(wsUrl) {
  return `(() => {
  const WS_URL = ${JSON.stringify(wsUrl)};
  const DEBUG = ${JSON.stringify(process.env.E2E_DEBUG ? true : false)};
  const log = (...a) => { if (DEBUG) console.log("SHIM", ...a); };

  class FakeSerialPort extends EventTarget {
    constructor() { super(); this._ws = null; this.readable = null; this.writable = null; }
    getInfo() { return { usbVendorId: 0x1d50, usbProductId: 0x615e }; }
    async open(_options) {
      const ws = new WebSocket(WS_URL);
      ws.binaryType = "arraybuffer";
      this._ws = ws;
      await new Promise((resolve, reject) => {
        ws.onopen = () => resolve();
        ws.onerror = () => reject(new DOMException("WebSocket bridge failed", "NetworkError"));
      });

      this.readable = new ReadableStream({
        start(controller) {
          ws.onmessage = (ev) => {
            const chunk = ev.data instanceof ArrayBuffer ? new Uint8Array(ev.data) : new Uint8Array(0);
            if (!chunk.byteLength) return;
            log("read", chunk.byteLength, "B");
            controller.enqueue(chunk);
            // Record raw device->host bytes so a test can prove the real
            // firmware's GetDeviceInfo reply (which carries the device name)
            // travelled the whole browser<->Renode loop.
            let s = window.__SHIM_RX__ || "";
            for (let i = 0; i < chunk.length; i++) s += String.fromCharCode(chunk[i]);
            window.__SHIM_RX__ = s;
          };
          ws.onclose = () => { try { controller.close(); } catch (_) {} };
        },
        cancel() { try { ws.close(); } catch (_) {} },
      });

      this.writable = new WritableStream({
        write(chunk) {
          if (ws.readyState !== WebSocket.OPEN) return;
          const u8 = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk);
          log("write", u8.byteLength, "B");
          ws.send(u8);
        },
        close() { /* stream close does not close the shared ws */ },
        abort() { try { ws.close(); } catch (_) {} },
      });
    }
    async close() {
      try { this._ws && this._ws.close(); } catch (_) {}
      this._ws = null; this.readable = null; this.writable = null;
    }
  }

  const sharedPort = new FakeSerialPort();
  const serial = new EventTarget();
  serial.requestPort = async () => sharedPort;
  serial.getPorts = async () => [sharedPort];

  Object.defineProperty(navigator, "serial", {
    configurable: true,
    enumerable: true,
    get() { return serial; },
  });
})();`;
}
