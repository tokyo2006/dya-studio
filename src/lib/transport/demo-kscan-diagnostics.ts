/**
 * Demo Key Switches (KScan Diagnostics) Custom Subsystem Handler
 *
 * Provides mock per-key press/release statistics for demo mode, following
 * the firmware's paginated GetStats protocol
 * (proto/cormoran/kscan_diagnostics/kscan_diagnostics.proto).
 */

import {
  type Request,
  type Response,
  type PositionStats,
  KscanDriverType,
} from "../../proto/cormoran/kscan_diagnostics/kscan_diagnostics";

export const KSCAN_DIAGNOSTICS_IDENTIFIER = "cormoran__kscan_diagnostics";

const STATS_PAGE_SIZE = 12;
const POSITION_COUNT = 48;
// Position that intentionally exhibits chatter, so the demo UI always shows
// exactly one suspect-key row.
const CHATTERY_POSITION = 21;

function generateStats(): PositionStats[] {
  const entries: PositionStats[] = [];
  for (let position = 0; position < POSITION_COUNT; position++) {
    const isChattery = position === CHATTERY_POSITION;
    // Realistic-looking, varying press counts.
    const presses = 40 + ((position * 7) % 60);
    entries.push({
      position,
      presses,
      releases: presses,
      minPressDurationMs: 30 + (position % 10),
      minRepressGapMs: isChattery ? 4 : 120 + (position % 50),
      repressLt5: 0,
      repressLt10: isChattery ? 3 : 0,
      repressLt20: isChattery ? 3 : 0,
      repressLt50: isChattery ? 3 : 0,
      lastSource: 0,
    });
  }
  return entries;
}

export class KscanDiagnosticsHandler {
  private startedAtMs = Date.now();
  private stats: PositionStats[] = generateStats();

  process(request: Request): Response {
    if (request.getInfo !== undefined) {
      return {
        info: {
          protoVersion: 1,
          layoutCount: 1,
          selectedLayout: 0,
          deviceCount: 1,
          statsEnabled: true,
          maxPositions: POSITION_COUNT,
          uptimeMs: Date.now() - this.startedAtMs,
        },
      };
    }

    if (request.getDevice !== undefined) {
      const { deviceIndex } = request.getDevice;
      if (deviceIndex !== 0) {
        return { error: { message: "Unknown device index" } };
      }
      return {
        device: {
          deviceIndex: 0,
          nodeName: "kscan0",
          type: KscanDriverType.MATRIX,
          rows: 4,
          columns: 12,
          inputs: 0,
          debouncePressMs: 5,
          debounceReleaseMs: 5,
          debounceScanPeriodMs: 1,
          pollPeriodMs: 0,
          diodeRow2col: true,
          toggleMode: false,
        },
      };
    }

    if (request.getStats !== undefined) {
      const { offset } = request.getStats;
      const page = this.stats.slice(offset, offset + STATS_PAGE_SIZE);
      return {
        stats: {
          total: this.stats.length,
          offset,
          entries: page,
        },
      };
    }

    if (request.resetStats !== undefined) {
      this.stats = this.stats.map((entry) => ({
        ...entry,
        presses: 0,
        releases: 0,
        minPressDurationMs: 0,
        minRepressGapMs: 0,
        repressLt5: 0,
        repressLt10: 0,
        repressLt20: 0,
        repressLt50: 0,
      }));
      return { ok: {} };
    }

    return { error: { message: "Not implemented" } };
  }
}
