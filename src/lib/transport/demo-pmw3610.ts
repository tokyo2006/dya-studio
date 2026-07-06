/**
 * Demo Trackball Sensor (PMW3610) Custom Subsystem Handler
 *
 * Provides mock sensor info/diagnostics plus a synthetic frame
 * capture/streaming implementation for demo mode, following
 * proto/cormoran/pmw3610/pmw3610.proto's CaptureFrame/GetFrameChunk/
 * SetFrameStream protocol so the Troubleshooting page's "Live sensor view"
 * has something to render without real hardware.
 */

import {
  Notification,
  type Request,
  type Response,
} from "../../proto/cormoran/pmw3610/pmw3610";

export const PMW3610_IDENTIFIER = "cormoran__pmw3610";

const DEFAULT_SIDE = 22;
const CHUNK_SIZE = 128;
const STREAM_INTERVAL_MS = 200; // ~5 fps

/** Synthesize a frame: a radial gradient (bright center, dark edges) with
 * bit7 (PG_VALID) set on every byte, animated by `counter` so streamed
 * frames visibly move. */
function synthesizeFrame(side: number, counter: number): Uint8Array {
  const bytes = new Uint8Array(side * side);
  const center = (side - 1) / 2;
  const maxDist = Math.sqrt(center * center * 2) || 1;
  for (let y = 0; y < side; y++) {
    for (let x = 0; x < side; x++) {
      const dx = x - center;
      const dy = y - center;
      const dist = Math.sqrt(dx * dx + dy * dy);
      // Animate by shifting the gradient's phase with `counter`.
      const wave = (Math.sin(dist - counter * 0.5) + 1) / 2;
      const brightness = Math.round(
        (1 - dist / maxDist) * 0.7 * 127 + wave * 0.3 * 127,
      );
      const clamped = Math.max(0, Math.min(127, brightness));
      bytes[y * side + x] = 0x80 | clamped; // bit7 set = valid
    }
  }
  return bytes;
}

function chunkOffsets(totalLength: number, chunkSize: number): number[] {
  const offsets: number[] = [];
  for (let offset = 0; offset < totalLength; offset += chunkSize) {
    offsets.push(offset);
  }
  return offsets;
}

export class Pmw3610Handler {
  private frames = new Map<number, Uint8Array>();
  private nextFrameId = 1;
  private streaming = false;
  private streamCounter = 0;
  private streamTimer: ReturnType<typeof setInterval> | null = null;
  private callbacks: ((data: Uint8Array) => void)[] = [];

  process(request: Request): Response {
    if (request.getInfo !== undefined) {
      return {
        getInfo: {
          devices: [
            {
              ready: true,
              productId: 0x3610,
              revisionId: 0x01,
              initError: 0,
              runtimeConfig: {
                cpi: 800,
                swapXy: false,
                invertX: false,
                invertY: false,
                forceAwake: false,
                smartAlgorithm: true,
                runDownshiftMs: 128,
                rest1DownshiftMs: 40,
                rest2DownshiftMs: 9,
                rest1SampleMs: 10,
                rest2SampleMs: 40,
                rest3SampleMs: 100,
                reportIntervalMinMs: 0,
              },
            },
          ],
        },
      };
    }

    if (request.readDiagnostics !== undefined) {
      const { deviceIndex } = request.readDiagnostics;
      if (deviceIndex !== 0) {
        return { error: { message: "Unknown device index" } };
      }
      return {
        readDiagnostics: {
          squal: 45,
          shutter: 600,
          pixMin: 30,
          pixAvg: 55,
          pixMax: 90,
        },
      };
    }

    if (request.captureFrame !== undefined) {
      if (this.streaming) {
        return {
          error: {
            message: "Cannot capture while frame streaming is active",
          },
        };
      }
      const { deviceIndex, pixelCount } = request.captureFrame;
      if (deviceIndex !== 0) {
        return { error: { message: "Unknown device index" } };
      }
      const side =
        pixelCount > 0 ? Math.round(Math.sqrt(pixelCount)) : DEFAULT_SIDE;
      const totalLength = side * side;
      const frameId = this.nextFrameId++;
      const bytes = synthesizeFrame(side, 0);
      this.frames.set(frameId, bytes);
      return {
        captureFrame: {
          frameId,
          pixelCount: totalLength,
          chunkSize: CHUNK_SIZE,
          complete: true,
          durationMs: 8,
        },
      };
    }

    if (request.getFrameChunk !== undefined) {
      const { frameId, offset } = request.getFrameChunk;
      const bytes = this.frames.get(frameId);
      if (!bytes) {
        return { error: { message: "Unknown frame id" } };
      }
      const data = bytes.slice(offset, offset + CHUNK_SIZE);
      return { getFrameChunk: { frameId, offset, data } };
    }

    if (request.setFrameStream !== undefined) {
      const { deviceIndex, enable, pixelCount } = request.setFrameStream;
      if (deviceIndex !== 0) {
        return { error: { message: "Unknown device index" } };
      }
      if (enable) {
        this.startStreaming(
          pixelCount > 0 ? Math.round(Math.sqrt(pixelCount)) : DEFAULT_SIDE,
        );
      } else {
        this.stopStreaming();
      }
      return { setFrameStream: { streaming: this.streaming } };
    }

    return { error: { message: "Not implemented in demo" } };
  }

  private startStreaming(side: number) {
    this.stopStreaming();
    this.streaming = true;
    this.streamCounter = 0;
    this.streamTimer = setInterval(() => {
      this.emitStreamedFrame(side);
    }, STREAM_INTERVAL_MS);
  }

  private stopStreaming() {
    this.streaming = false;
    if (this.streamTimer !== null) {
      clearInterval(this.streamTimer);
      this.streamTimer = null;
    }
  }

  private emitStreamedFrame(side: number) {
    const frameId = this.nextFrameId++;
    const bytes = synthesizeFrame(side, this.streamCounter++);
    const totalSize = bytes.length;
    const offsets = chunkOffsets(totalSize, CHUNK_SIZE);
    for (const offset of offsets) {
      const data = bytes.slice(offset, offset + CHUNK_SIZE);
      const payload = Notification.encode({
        frameStreamChunk: {
          frameId,
          offset,
          data,
          totalSize,
          complete: true,
        },
      }).finish();
      for (const callback of this.callbacks) {
        callback(payload);
      }
    }
  }

  /** Stop any active stream — called on disconnect so jest (and real
   * browser tabs) don't leak a running interval. */
  disconnect() {
    this.stopStreaming();
  }

  notify(callback: (data: Uint8Array) => void) {
    this.callbacks.push(callback);
  }
}
