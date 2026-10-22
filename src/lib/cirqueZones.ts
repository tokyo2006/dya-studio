/**
 * Trackpad zone geometry and gesture classification for the Cirque Pinnacle
 * driver (`cirque-input-module`).
 *
 * This is a 1:1 port of the firmware logic:
 *   - include/zmk/cirque_zone_math.h        (axisPercent / ring / wedge)
 *   - drivers/input/input_pinnacle.c        (absolute mode state machine)
 *
 * Coordinates are "normalized percent" (-100..100 on each axis, 0 at the pad
 * centre, +/-100 on the active-range border). Because the semi-axes are
 * normalized, an angle in this space equals the physical angle on a round pad.
 *
 * The calibration block below mirrors the shield's cirque.dtsi. Keep it in sync
 * when the devicetree changes.
 */

export const CALIBRATION = {
  /** Active range 262..1786 x 170..1366, symmetric around the centre. */
  halfX: 762,
  halfY: 598,
  activeRange: { xMin: 262, xMax: 1786, yMin: 170, yMax: 1366 },
  /** Secondary-tap wedge centre; fixed by the thumb-cluster mounting. */
  wedgeCenterDeg: 42.5,
  /** No secondary tap inside this radius. */
  wedgeInnerPct: 30,
  /** Right-edge scroll needs nx >= this. */
  ringMinAxisPct: 15,
  /** Ring latch at this percentage of the radius. */
  ringPct: 70,
  /** Measured reachable radius on the test unit. */
  reachablePct: 90,
} as const;

export interface ZoneParams {
  wedgeWidthDeg?: number;
  ringPct?: number;
  divisor?: number;
  /** Vertical movement in raw units before a rim touch becomes a scroll. */
  intent?: number;
  tapMaxMs?: number;
  tapMove?: number;
  invertScroll?: boolean;
  tapDragEnabled?: boolean;
  tapDragTimeoutMs?: number;
  tapDragMaxMovement?: number;
}

const DEFAULTS = {
  wedgeWidthDeg: 25,
  ringPct: CALIBRATION.ringPct,
  divisor: 50,
  intent: 60,
  tapMaxMs: 250,
  tapMove: 180,
  invertScroll: false,
  tapDragEnabled: true,
  tapDragTimeoutMs: 300,
  tapDragMaxMovement: 200,
};

const withDefaults = (p: ZoneParams) => ({ ...DEFAULTS, ...p });

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const deg2rad = (d: number) => (d * Math.PI) / 180;

export const wedgeAngles = (p: ZoneParams = {}) => {
  const { wedgeWidthDeg } = withDefaults(p);
  return {
    min: CALIBRATION.wedgeCenterDeg - wedgeWidthDeg / 2,
    max: CALIBRATION.wedgeCenterDeg + wedgeWidthDeg / 2,
  };
};

const minSlope = (p: ZoneParams) =>
  Math.round(Math.tan(deg2rad(wedgeAngles(p).min)) * 1000);
const maxSlope = (p: ZoneParams) =>
  Math.round(Math.tan(deg2rad(wedgeAngles(p).max)) * 1000);

/** Raw x coordinate units for a normalized percent (same as the firmware). */
export const rawX = (nx: number) => (nx / 100) * CALIBRATION.halfX;
export const rawY = (ny: number) => (ny / 100) * CALIBRATION.halfY;

/** zmk_cirque_in_outer_ring(): true inside the outer ring of the ellipse. */
export function inOuterRing(nx: number, ny: number, ringPct: number): boolean {
  if (ringPct <= 0) return false;
  const r = Math.min(ringPct, 100);
  return nx * nx + ny * ny >= r * r;
}

/** zmk_cirque_in_bottom_right_wedge(): angular wedge, 3 -> 6 o'clock. */
export function inBottomRightWedge(
  nx: number,
  ny: number,
  slopeMin: number,
  slopeMax: number,
): boolean {
  if (nx <= 0 || ny <= 0) return false;
  if (ny * 1000 < nx * slopeMin) return false;
  if (ny * 1000 > nx * slopeMax) return false;
  return (
    nx * nx + ny * ny >= CALIBRATION.wedgeInnerPct * CALIBRATION.wedgeInnerPct
  );
}

/** Which button a tap at this position reports. */
export function zoneAt(
  nx: number,
  ny: number,
  p: ZoneParams = {},
): "primary" | "secondary" {
  return inBottomRightWedge(nx, ny, minSlope(p), maxSlope(p))
    ? "secondary"
    : "primary";
}

function scrollModeForPoint(
  nx: number,
  ny: number,
  p: ZoneParams,
): "none" | "vertical" {
  if (!inOuterRing(nx, ny, p.ringPct ?? CALIBRATION.ringPct)) return "none";
  return nx >= CALIBRATION.ringMinAxisPct ? "vertical" : "none";
}

export type GestureType = "pointer" | "tap" | "scroll" | "drag";

export interface GestureResult {
  type: GestureType;
  ticks: number;
  click: "left" | "right" | "left-hold" | null;
  moveX: number;
  moveY: number;
}

interface GestureState {
  touching: boolean;
  start: { nx: number; ny: number };
  prev: { nx: number; ny: number };
  startT: number;
  scrollMode: "none" | "vertical";
  scrollCandidate: "none" | "vertical";
  motionStarted: boolean;
  tapDragCandidate: boolean;
  dragging: boolean;
  ticks: number;
  remainder: number;
  movedX: number;
  movedY: number;
}

export interface LastTap {
  t: number;
  nx: number;
  ny: number;
  code: 0 | 1;
}

export function beginGesture(
  nx: number,
  ny: number,
  t: number,
  lastTap: LastTap | null,
  params: ZoneParams = {},
): GestureState {
  const p = withDefaults(params);
  const near =
    lastTap && lastTap.code === 0
      ? {
          dt: t - lastTap.t,
          dx: Math.abs(nx - lastTap.nx),
          dy: Math.abs(ny - lastTap.ny),
        }
      : null;

  const tapDragCandidate = !!(
    p.tapDragEnabled &&
    near &&
    near.dt <= p.tapDragTimeoutMs &&
    rawX(near.dx) <= p.tapDragMaxMovement &&
    rawY(near.dy) <= p.tapDragMaxMovement
  );

  return {
    touching: true,
    start: { nx, ny },
    prev: { nx, ny },
    startT: t,
    scrollMode: "none",
    scrollCandidate: tapDragCandidate ? "none" : scrollModeForPoint(nx, ny, p),
    motionStarted: false,
    tapDragCandidate,
    dragging: false,
    ticks: 0,
    remainder: 0,
    movedX: 0,
    movedY: 0,
  };
}

export function stepGesture(
  g: GestureState,
  nx: number,
  ny: number,
  params: ZoneParams = {},
): void {
  const p = withDefaults(params);
  if (!g.touching) return;

  if (g.scrollMode !== "none") {
    const dxRaw = rawX(nx - g.prev.nx);
    const dyRaw = rawY(g.prev.ny - ny); // firmware: delta = prev_y - cur_y
    if (Math.abs(dyRaw) * 5 >= Math.abs(dxRaw) * 3) {
      g.remainder += dyRaw;
      const ticks = Math.trunc(g.remainder / p.divisor);
      g.remainder -= ticks * p.divisor;
      g.ticks += ticks;
    }
    g.prev = { nx, ny };
    return;
  }

  const mx = Math.abs(rawX(nx - g.start.nx));
  const my = Math.abs(rawY(ny - g.start.ny));

  if (g.scrollCandidate !== "none" && !g.motionStarted) {
    if (my >= p.intent && my * 5 >= mx * 3) {
      g.scrollMode = g.scrollCandidate;
      g.scrollCandidate = "none";
      g.motionStarted = true;
      g.remainder = 0;
      g.prev = { nx, ny };
      return;
    }
    if (mx >= p.intent && mx * 5 >= my * 3) {
      g.scrollCandidate = "none";
    }
  }

  if (g.tapDragCandidate) {
    if (mx <= p.tapMove && my <= p.tapMove) {
      g.prev = { nx, ny };
      return;
    }
    g.dragging = true;
    g.tapDragCandidate = false;
    g.motionStarted = true;
  }

  if (!g.motionStarted) {
    if (mx <= p.tapMove && my <= p.tapMove) {
      g.prev = { nx, ny };
      return;
    }
    g.motionStarted = true;
  }

  g.movedX += rawX(nx - g.prev.nx);
  g.movedY += rawY(ny - g.prev.ny);
  g.prev = { nx, ny };
}

export function endGesture(
  g: GestureState,
  t: number,
  params: ZoneParams = {},
): GestureResult {
  const p = withDefaults(params);
  const dur = t - g.startT;
  const mx = Math.abs(rawX(g.prev.nx - g.start.nx));
  const my = Math.abs(rawY(g.prev.ny - g.start.ny));

  let result: GestureResult = {
    type: "pointer",
    ticks: 0,
    click: null,
    moveX: g.movedX,
    moveY: g.movedY,
  };

  if (g.dragging) {
    result = { type: "drag", ticks: 0, click: "left-hold", moveX: 0, moveY: 0 };
  } else if (g.scrollMode !== "none") {
    result = {
      type: "scroll",
      ticks: g.ticks * (p.invertScroll ? -1 : 1),
      click: null,
      moveX: 0,
      moveY: 0,
    };
  } else if (dur <= p.tapMaxMs && mx <= p.tapMove && my <= p.tapMove) {
    result = {
      type: "tap",
      ticks: 0,
      click: zoneAt(g.prev.nx, g.prev.ny, p) === "secondary" ? "right" : "left",
      moveX: 0,
      moveY: 0,
    };
  }

  g.touching = false;
  return result;
}

/** Synthetic tap, used by tests and the preview. */
export function simulateTap(
  nx: number,
  ny: number,
  params: ZoneParams = {},
  holdMs = 100,
): GestureResult {
  const g = beginGesture(nx, ny, 1000, null, params);
  stepGesture(g, nx, ny, params);
  return endGesture(g, 1000 + holdMs, params);
}

/** Synthetic stroke, used by tests and the preview. */
export function simulateDrag(
  points: Array<[number, number]>,
  params: ZoneParams = {},
  stepMs = 10,
): GestureResult {
  const [first, ...rest] = points;
  const g = beginGesture(first[0], first[1], 1000, null, params);
  for (const [nx, ny] of rest) stepGesture(g, nx, ny, params);
  return endGesture(g, 1000 + stepMs * points.length, params);
}

/** Regression cases from real device logs (see the driver docs). */
export const ZONE_CASES: Array<{ name: string; run: () => boolean }> = [
  {
    name: "5 o'clock (46 deg, 90%) tap -> right",
    run: () =>
      simulateTap(90 * Math.cos(deg2rad(46)), 90 * Math.sin(deg2rad(46)))
        .click === "right",
  },
  {
    name: "6 o'clock (67 deg, 90%) tap -> left",
    run: () =>
      simulateTap(90 * Math.cos(deg2rad(67)), 90 * Math.sin(deg2rad(67)))
        .click === "left",
  },
  {
    name: "4:30 (41 deg, 90%) tap -> right",
    run: () =>
      simulateTap(90 * Math.cos(deg2rad(41)), 90 * Math.sin(deg2rad(41)))
        .click === "right",
  },
  {
    name: "3 o'clock (20 deg, 90%) tap -> left",
    run: () =>
      simulateTap(90 * Math.cos(deg2rad(20)), 90 * Math.sin(deg2rad(20)))
        .click === "left",
  },
  {
    name: "centre tap -> left",
    run: () => simulateTap(0, 0).click === "left",
  },
  {
    name: "right edge vertical stroke -> scroll",
    run: () => {
      const r = simulateDrag([
        [75, -20],
        [75, -12],
        [75, -4],
        [75, 4],
        [75, 12],
      ]);
      return r.type === "scroll" && Math.abs(r.ticks) >= 1;
    },
  },
  {
    name: "right edge horizontal stroke -> no scroll",
    run: () => {
      const r = simulateDrag([
        [70, 10],
        [62, 10],
        [54, 10],
        [46, 10],
        [38, 10],
      ]);
      return r.type !== "scroll";
    },
  },
  {
    name: "centre vertical drag -> pointer",
    run: () => {
      const r = simulateDrag([
        [0, 0],
        [0, 20],
        [0, 40],
        [0, 60],
      ]);
      return r.type === "pointer";
    },
  },
];

export { clamp };
