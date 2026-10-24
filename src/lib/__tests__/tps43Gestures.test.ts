import type { Tps43State } from "../../proto/tokyo2006/tps43/tps43";
import {
  classifyTps43Gesture,
  TPS43_TAP_MAX_DISTANCE,
  TPS43_TAP_MAX_DURATION_MS,
  TPS43_TWO_FINGER_TAP_MAX_DISTANCE,
  type Tps43GestureInput,
} from "../tps43Gestures";

function state(overrides: Tps43State = {}): Tps43State {
  return {
    oneFingerTap: true,
    twoFingerTap: true,
    pressAndHold: true,
    pressAndHoldTime: 250,
    scroll: true,
    ...overrides,
  };
}

function touch(
  overrides: Partial<Tps43GestureInput> &
    Pick<Tps43GestureInput, "fingerCount">,
): Tps43GestureInput {
  return {
    distance: 4,
    durationMs: 120,
    dx: 0,
    dy: 0,
    ...overrides,
  };
}

describe("classifyTps43Gesture", () => {
  it("classifies a quick small 1F touch as tap", () => {
    expect(classifyTps43Gesture(touch({ fingerCount: 1 }), state())).toEqual({
      gesture: "tap",
      enabled: true,
    });

    expect(
      classifyTps43Gesture(
        touch({
          fingerCount: 1,
          distance: TPS43_TAP_MAX_DISTANCE - 1,
          durationMs: TPS43_TAP_MAX_DURATION_MS - 1,
        }),
        state({ pressAndHoldTime: 400 }),
      ),
    ).toEqual({ gesture: "tap", enabled: true });
  });

  it("does not classify a moved or slow 1F touch as tap", () => {
    expect(
      classifyTps43Gesture(
        touch({ fingerCount: 1, distance: TPS43_TAP_MAX_DISTANCE }),
        state({ pressAndHoldTime: 400 }),
      ),
    ).toEqual({ gesture: "none", enabled: true });

    expect(
      classifyTps43Gesture(
        touch({
          fingerCount: 1,
          durationMs: TPS43_TAP_MAX_DURATION_MS,
        }),
        state({ pressAndHoldTime: 400 }),
      ),
    ).toEqual({ gesture: "none", enabled: true });
  });

  it("classifies a 1F hold at or above pressAndHoldTime", () => {
    expect(
      classifyTps43Gesture(
        touch({ fingerCount: 1, durationMs: 250 }),
        state({ pressAndHoldTime: 250 }),
      ),
    ).toEqual({ gesture: "hold", enabled: true });

    expect(
      classifyTps43Gesture(
        touch({ fingerCount: 1, durationMs: 700 }),
        state({ pressAndHoldTime: 400 }),
      ),
    ).toEqual({ gesture: "hold", enabled: true });
  });

  it("uses 250 ms when pressAndHoldTime is not set", () => {
    expect(
      classifyTps43Gesture(
        touch({ fingerCount: 1, durationMs: 300 }),
        state({ pressAndHoldTime: undefined }),
      ),
    ).toEqual({ gesture: "hold", enabled: true });
  });

  it("classifies a 2F drag as scroll and reports the dominant axis", () => {
    expect(
      classifyTps43Gesture(
        touch({
          fingerCount: 2,
          distance: TPS43_TWO_FINGER_TAP_MAX_DISTANCE,
          durationMs: 400,
          dx: -12,
          dy: 30,
        }),
        state(),
      ),
    ).toEqual({
      gesture: "scroll",
      detail: { axis: "vertical" },
      enabled: true,
    });

    expect(
      classifyTps43Gesture(
        touch({
          fingerCount: 2,
          distance: 40,
          durationMs: 100,
          dx: 0,
          dy: -40,
        }),
        state(),
      ),
    ).toEqual({
      gesture: "scroll",
      detail: { axis: "vertical" },
      enabled: true,
    });

    expect(
      classifyTps43Gesture(
        touch({
          fingerCount: 2,
          distance: 40,
          durationMs: 400,
          dx: 30,
          dy: 12,
        }),
        state(),
      ),
    ).toEqual({
      gesture: "scroll",
      detail: { axis: "horizontal" },
      enabled: true,
    });
  });

  it("classifies a quick small 2F touch as two-finger-tap", () => {
    expect(
      classifyTps43Gesture(
        touch({
          fingerCount: 2,
          distance: TPS43_TWO_FINGER_TAP_MAX_DISTANCE - 1,
          durationMs: 259,
        }),
        state(),
      ),
    ).toEqual({ gesture: "two-finger-tap", enabled: true });
  });

  it("does not classify a slow small 2F touch", () => {
    expect(
      classifyTps43Gesture(
        touch({ fingerCount: 2, distance: 4, durationMs: 400 }),
        state(),
      ),
    ).toEqual({ gesture: "none", enabled: true });
  });

  it("marks a gesture disabled when its toggle is off", () => {
    const tap = () => classifyTps43Gesture(touch({ fingerCount: 1 }), state());
    const hold = () =>
      classifyTps43Gesture(touch({ fingerCount: 1, durationMs: 500 }), state());
    const twoFingerTap = () =>
      classifyTps43Gesture(touch({ fingerCount: 2 }), state());
    const scroll = () =>
      classifyTps43Gesture(
        touch({ fingerCount: 2, distance: 40, dy: 40 }),
        state(),
      );

    expect(
      classifyTps43Gesture(
        touch({ fingerCount: 1 }),
        state({ oneFingerTap: false }),
      ).enabled,
    ).toBe(false);
    expect(tap().enabled).toBe(true);

    expect(
      classifyTps43Gesture(
        touch({ fingerCount: 1, durationMs: 500 }),
        state({ pressAndHold: false }),
      ).enabled,
    ).toBe(false);
    expect(hold().enabled).toBe(true);

    expect(
      classifyTps43Gesture(
        touch({ fingerCount: 2 }),
        state({ twoFingerTap: false }),
      ).enabled,
    ).toBe(false);
    expect(twoFingerTap().enabled).toBe(true);

    expect(
      classifyTps43Gesture(
        touch({ fingerCount: 2, distance: 40, dy: 40 }),
        state({ scroll: false }),
      ).enabled,
    ).toBe(false);
    expect(scroll().enabled).toBe(true);
  });
});
