import {
  CALIBRATION,
  ZONE_CASES,
  beginGesture,
  endGesture,
  inBottomRightWedge,
  inOuterRing,
  simulateDrag,
  simulateTap,
  stepGesture,
  wedgeAngles,
} from "../cirqueZones";

const deg = (d: number) => (d * Math.PI) / 180;
const at = (degFrom3: number, pct: number): [number, number] => [
  pct * Math.cos(deg(degFrom3)),
  pct * Math.sin(deg(degFrom3)),
];

describe("cirque zone math", () => {
  it("uses the calibrated wedge angles", () => {
    expect(wedgeAngles({ wedgeWidthDeg: 25 })).toEqual({ min: 30, max: 55 });
  });

  it("only matches the bottom-right wedge", () => {
    // 46 deg / 90% is the measured "5 o'clock" and must be secondary.
    expect(inBottomRightWedge(...at(46, 90), 577, 1428)).toBe(true);
    // 67 deg / 90% is the measured "6 o'clock" and must stay primary.
    expect(inBottomRightWedge(...at(67, 90), 577, 1428)).toBe(false);
    // Axes and the centre circle are excluded.
    expect(inBottomRightWedge(100, 0, 577, 1428)).toBe(false);
    expect(inBottomRightWedge(0, 100, 577, 1428)).toBe(false);
    expect(inBottomRightWedge(10, 10, 577, 1428)).toBe(false);
  });

  it("matches the outer ring and the right-side gate", () => {
    expect(inOuterRing(...at(0, 100), 70)).toBe(true);
    expect(inOuterRing(...at(0, 60), 70)).toBe(false);
    expect(inOuterRing(0, 0, 70)).toBe(false);
  });

  it("classifies taps at the measured positions", () => {
    expect(simulateTap(...at(46, 90)).click).toBe("right");
    expect(simulateTap(...at(67, 90)).click).toBe("left");
    expect(simulateTap(...at(41, 90)).click).toBe("right");
    expect(simulateTap(...at(20, 90)).click).toBe("left");
    expect(simulateTap(0, 0).click).toBe("left");
  });

  it("scrolls on a vertical rim stroke but not on a horizontal one", () => {
    const vertical = simulateDrag([
      [75, -20],
      [75, -12],
      [75, -4],
      [75, 4],
      [75, 12],
    ]);
    expect(vertical.type).toBe("scroll");
    expect(Math.abs(vertical.ticks)).toBeGreaterThanOrEqual(1);

    const horizontal = simulateDrag([
      [70, 10],
      [62, 10],
      [54, 10],
      [46, 10],
      [38, 10],
    ]);
    expect(horizontal.type).not.toBe("scroll");
  });

  it("keeps a centre vertical drag as pointer movement", () => {
    const r = simulateDrag([
      [0, 0],
      [0, 20],
      [0, 40],
      [0, 60],
    ]);
    expect(r.type).toBe("pointer");
  });

  it("only turns a second nearby tap into a drag", () => {
    const p = { tapDragEnabled: true };
    const first = beginGesture(0, 0, 1000, null, p);
    endGesture(first, 1080, p);
    const t = 1080;
    // second touch 120 ms later, 10% away: drag candidate, then a real move
    const g = beginGesture(2, 2, t + 120, { t, nx: 0, ny: 0, code: 0 }, p);
    stepGesture(g, 2, 40, p);
    stepGesture(g, 2, 50, p);
    const r = endGesture(g, t + 300, p);
    expect(r.type).toBe("drag");
  });

  it("keeps the reachable edge below the module border", () => {
    expect(CALIBRATION.reachablePct).toBeLessThan(100);
    expect(CALIBRATION.wedgeInnerPct).toBeGreaterThan(0);
  });

  it("passes every regression case from the device logs", () => {
    for (const c of ZONE_CASES) {
      expect({ name: c.name, pass: c.run() }).toEqual({
        name: c.name,
        pass: true,
      });
    }
  });
});
