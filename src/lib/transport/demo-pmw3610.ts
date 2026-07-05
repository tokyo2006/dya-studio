/**
 * Demo Trackball Sensor (PMW3610) Custom Subsystem Handler
 *
 * Provides mock sensor info/diagnostics for demo mode. Only GetInfo and
 * ReadDiagnostics are exercised by DYA Studio's UI (register read/write and
 * frame capture are intentionally not exposed there), but this handler
 * responds to the full Request oneof for protocol completeness.
 */

import {
  type Request,
  type Response,
} from "../../proto/cormoran/pmw3610/pmw3610";

export const PMW3610_IDENTIFIER = "cormoran__pmw3610";

export class Pmw3610Handler {
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

    return { error: { message: "Not implemented in demo" } };
  }
}
