/**
 * Demo Key Switches (KScan Diagnostics) Custom Subsystem Handler
 *
 * Provides mock per-key press/release statistics and full wiring topology
 * for demo mode, following the firmware's paginated protocol
 * (proto/cormoran/kscan_diagnostics/kscan_diagnostics.proto).
 *
 * The single MATRIX device models a 5x12 matrix (60 cells) covering the
 * demo keyboard's DYA_DASH physical layout (59 keys, src/lib/layouts.ts) —
 * the last cell is intentionally left unmapped (0 in the position map) so
 * the interactive keyboard preview also exercises the "no wiring info"
 * path. Row lines live on "gpio0" pins 4..8, column lines on "gpio1" pins
 * 0..11.
 *
 * A simulated split peripheral (source=1) is also provided: a 4x6 DIRECT
 * half that answers QueryPeripheral requests via a notification. The
 * peripheral's wiring uses "gpio2" for its 24 direct input pins.
 */

import {
  GpioLineKind,
  PeripheralEvent,
  Request,
  Response,
  type GpioPin,
  type PositionStats,
  KscanDriverType,
} from "../../proto/cormoran/kscan_diagnostics/kscan_diagnostics";

export const KSCAN_DIAGNOSTICS_IDENTIFIER = "cormoran__kscan_diagnostics";

const STATS_PAGE_SIZE = 12;
const GPIO_PAGE_SIZE = 16;
const POSITION_MAP_PAGE_SIZE = 16;

const ROWS = 5;
const COLUMNS = 12;
// One cell (the last one, row-major) is intentionally left unmapped.
const POSITION_COUNT = ROWS * COLUMNS - 1;

// Position that intentionally exhibits chatter, so the demo UI always shows
// exactly one suspect-key row.
const CHATTERY_POSITION = 21;
// Position that intentionally has zero presses, so the demo UI always shows
// an "untested key" example.
const UNTESTED_POSITION = 40;

const ROW_PORT = "gpio0";
const ROW_PIN_BASE = 4;
const COL_PORT = "gpio1";
const COL_PIN_BASE = 0;

// Simulated peripheral: a 4x6 matrix for the right half.
const PERIPH_ROWS = 4;
const PERIPH_COLS = 6;
const PERIPH_POSITION_COUNT = PERIPH_ROWS * PERIPH_COLS;
const PERIPH_PIN_PORT = "gpio2";
const PERIPH_ROW_PIN_BASE = 0;
const PERIPH_COL_PORT = "gpio3";
const PERIPH_COL_PIN_BASE = 0;
const PERIPH_SOURCE = 1;

function buildPositionMap(): number[] {
  // Row-major over ROWS x COLUMNS; cell value is `position + 1`, or 0 for
  // unmapped (proto convention — see kscan_diagnostics.proto's PositionMap).
  const cells: number[] = [];
  let position = 0;
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLUMNS; col++) {
      if (position < POSITION_COUNT) {
        cells.push(position + 1);
        position++;
      } else {
        cells.push(0);
      }
    }
  }
  return cells;
}

function buildRowPins(): GpioPin[] {
  return Array.from({ length: ROWS }, (_, i) => ({
    index: i,
    port: ROW_PORT,
    pin: ROW_PIN_BASE + i,
    activeLow: i % 2 === 0,
    dtFlags: 0,
  }));
}

function buildColPins(): GpioPin[] {
  return Array.from({ length: COLUMNS }, (_, i) => ({
    index: i,
    port: COL_PORT,
    pin: COL_PIN_BASE + i,
    activeLow: false,
    dtFlags: 0,
  }));
}

function generateStats(): PositionStats[] {
  const entries: PositionStats[] = [];
  for (let position = 0; position < POSITION_COUNT; position++) {
    const isChattery = position === CHATTERY_POSITION;
    const isUntested = position === UNTESTED_POSITION;
    // Realistic-looking, varying press counts.
    const presses = isUntested ? 0 : 40 + ((position * 7) % 60);
    entries.push({
      position,
      presses,
      releases: presses,
      minPressDurationMs: isUntested ? 0 : 30 + (position % 10),
      minRepressGapMs: isChattery ? 4 : isUntested ? 0 : 120 + (position % 50),
      repressLt5: 0,
      repressLt10: isChattery ? 3 : 0,
      repressLt20: isChattery ? 3 : 0,
      repressLt50: isChattery ? 3 : 0,
      lastSource: 0,
    });
  }
  return entries;
}

function paginate<T>(
  items: T[],
  offset: number,
  pageSize: number,
): { total: number; offset: number; page: T[] } {
  return {
    total: items.length,
    offset,
    page: items.slice(offset, offset + pageSize),
  };
}

// ---- Peripheral simulation (source=1) ----

function buildPeriphPositionMap(): number[] {
  const cells: number[] = [];
  for (let i = 0; i < PERIPH_POSITION_COUNT; i++) {
    cells.push(i + 1);
  }
  return cells;
}

function buildPeriphRowPins(): GpioPin[] {
  return Array.from({ length: PERIPH_ROWS }, (_, i) => ({
    index: i,
    port: PERIPH_PIN_PORT,
    pin: PERIPH_ROW_PIN_BASE + i,
    activeLow: false,
    dtFlags: 0,
  }));
}

function buildPeriphColPins(): GpioPin[] {
  return Array.from({ length: PERIPH_COLS }, (_, i) => ({
    index: i,
    port: PERIPH_COL_PORT,
    pin: PERIPH_COL_PIN_BASE + i,
    activeLow: false,
    dtFlags: 0,
  }));
}

function generatePeriphStats(): PositionStats[] {
  return Array.from({ length: PERIPH_POSITION_COUNT }, (_, position) => {
    const presses = 20 + ((position * 11) % 40);
    return {
      position,
      presses,
      releases: presses,
      minPressDurationMs: 30 + (position % 8),
      minRepressGapMs: 150 + (position % 60),
      repressLt5: 0,
      repressLt10: 0,
      repressLt20: 0,
      repressLt50: 0,
      lastSource: PERIPH_SOURCE,
    };
  });
}

class PeripheralKscanHandler {
  private startedAtMs = Date.now();
  private stats: PositionStats[] = generatePeriphStats();
  private positionMap: number[] = buildPeriphPositionMap();
  private rowPins: GpioPin[] = buildPeriphRowPins();
  private colPins: GpioPin[] = buildPeriphColPins();

  process(request: Request): Response {
    if (request.getInfo !== undefined) {
      return {
        info: {
          protoVersion: 1,
          layoutCount: 1,
          selectedLayout: 0,
          deviceCount: 1,
          statsEnabled: true,
          maxPositions: PERIPH_POSITION_COUNT,
          uptimeMs: Date.now() - this.startedAtMs,
        },
      };
    }

    if (request.getLayout !== undefined) {
      const { layoutIndex } = request.getLayout;
      if (layoutIndex !== 0) {
        return { error: { message: "Unknown layout index" } };
      }
      return {
        layout: {
          layoutIndex: 0,
          displayName: "Right half",
          rows: PERIPH_ROWS,
          columns: PERIPH_COLS,
          keyCount: PERIPH_POSITION_COUNT,
          deviceIndices: [{ leafIndex: 0, rowOffset: 0, colOffset: 0 }],
        },
      };
    }

    if (request.getPositionMap !== undefined) {
      const { layoutIndex, offset } = request.getPositionMap;
      if (layoutIndex !== 0) {
        return { error: { message: "Unknown layout index" } };
      }
      const { total, page } = paginate(
        this.positionMap,
        offset,
        POSITION_MAP_PAGE_SIZE,
      );
      return { positionMap: { total, offset, cells: page } };
    }

    if (request.getDevice !== undefined) {
      const { deviceIndex } = request.getDevice;
      if (deviceIndex !== 0) {
        return { error: { message: "Unknown device index" } };
      }
      return {
        device: {
          deviceIndex: 0,
          nodeName: "kscan_right",
          type: KscanDriverType.MATRIX,
          rows: PERIPH_ROWS,
          columns: PERIPH_COLS,
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

    if (request.getGpioPins !== undefined) {
      const { deviceIndex, kind, offset } = request.getGpioPins;
      if (deviceIndex !== 0) {
        return { error: { message: "Unknown device index" } };
      }
      let lines: GpioPin[];
      switch (kind) {
        case GpioLineKind.ROW:
          lines = this.rowPins;
          break;
        case GpioLineKind.COL:
          lines = this.colPins;
          break;
        default:
          lines = [];
      }
      const { total, page } = paginate(lines, offset, GPIO_PAGE_SIZE);
      return { gpioPins: { total, offset, pins: page } };
    }

    if (request.getStats !== undefined) {
      const { offset } = request.getStats;
      const { total, page } = paginate(this.stats, offset, STATS_PAGE_SIZE);
      return { stats: { total, offset, entries: page } };
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

// ---- Main handler ----

export class KscanDiagnosticsHandler {
  private startedAtMs = Date.now();
  private stats: PositionStats[] = generateStats();
  private positionMap: number[] = buildPositionMap();
  private rowPins: GpioPin[] = buildRowPins();
  private colPins: GpioPin[] = buildColPins();
  private peripheralHandler = new PeripheralKscanHandler();
  private notifyCallbacks: ((data: Uint8Array) => void)[] = [];

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

    if (request.getLayout !== undefined) {
      const { layoutIndex } = request.getLayout;
      if (layoutIndex !== 0) {
        return { error: { message: "Unknown layout index" } };
      }
      return {
        layout: {
          layoutIndex: 0,
          displayName: "DYA Dash",
          rows: ROWS,
          columns: COLUMNS,
          keyCount: POSITION_COUNT,
          deviceIndices: [{ leafIndex: 0, rowOffset: 0, colOffset: 0 }],
        },
      };
    }

    if (request.getPositionMap !== undefined) {
      const { layoutIndex, offset } = request.getPositionMap;
      if (layoutIndex !== 0) {
        return { error: { message: "Unknown layout index" } };
      }
      const { total, page } = paginate(
        this.positionMap,
        offset,
        POSITION_MAP_PAGE_SIZE,
      );
      return { positionMap: { total, offset, cells: page } };
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
          rows: ROWS,
          columns: COLUMNS,
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

    if (request.getGpioPins !== undefined) {
      const { deviceIndex, kind, offset } = request.getGpioPins;
      if (deviceIndex !== 0) {
        return { error: { message: "Unknown device index" } };
      }
      let lines: GpioPin[];
      switch (kind) {
        case GpioLineKind.ROW:
          lines = this.rowPins;
          break;
        case GpioLineKind.COL:
          lines = this.colPins;
          break;
        default:
          lines = [];
      }
      const { total, page } = paginate(lines, offset, GPIO_PAGE_SIZE);
      return { gpioPins: { total, offset, pins: page } };
    }

    if (request.getStats !== undefined) {
      const { offset } = request.getStats;
      const { total, page } = paginate(this.stats, offset, STATS_PAGE_SIZE);
      return { stats: { total, offset, entries: page } };
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

    if (request.queryPeripheral !== undefined) {
      const { reqId, payload } = request.queryPeripheral;
      // Schedule the simulated peripheral notification asynchronously.
      setTimeout(() => {
        this.sendPeripheralEvent(reqId, payload);
      }, 50);
      return { ok: {} };
    }

    return { error: { message: "Not implemented" } };
  }

  private sendPeripheralEvent(reqId: number, encodedRequest: Uint8Array) {
    try {
      const innerRequest = Request.decode(encodedRequest);
      const innerResponse = this.peripheralHandler.process(innerRequest);
      const eventPayload = PeripheralEvent.encode(
        PeripheralEvent.create({
          source: PERIPH_SOURCE,
          reqId,
          payload: Response.encode(innerResponse).finish(),
        }),
      ).finish();
      for (const cb of this.notifyCallbacks) {
        cb(eventPayload);
      }
    } catch {
      // ignore simulation errors
    }
  }

  notify(callback: (data: Uint8Array) => void) {
    this.notifyCallbacks.push(callback);
  }
}
