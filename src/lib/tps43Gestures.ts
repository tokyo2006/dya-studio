import type { Tps43State } from "../proto/tokyo2006/tps43/tps43";

/**
 * Client-side approximation of the gestures the IQS572 recognizes.
 *
 * This is only a preview for the Trackpad page: the firmware performs the real
 * gesture detection, so the thresholds here are deliberately simple and
 * documented instead of mirroring the chip's tuning.
 */
export type Tps43Gesture =
  | "tap"
  | "two-finger-tap"
  | "hold"
  | "scroll"
  | "none";

/** Maximum 1F travel for a tap/hold, in CSS px. */
export const TPS43_TAP_MAX_DISTANCE = 20;
/** Maximum 2F travel for a two-finger tap, in CSS px. */
export const TPS43_TWO_FINGER_TAP_MAX_DISTANCE = 22;
/** Maximum touch duration for a tap or two-finger tap, in ms. */
export const TPS43_TAP_MAX_DURATION_MS = 260;
/** Firmware default when `pressAndHoldTime` is absent. */
export const TPS43_DEFAULT_PRESS_AND_HOLD_TIME = 250;

export type Tps43ScrollAxis = "horizontal" | "vertical";

export interface Tps43GestureInput {
  fingerCount: 1 | 2;
  /** Straight-line travel of the touch, in CSS px. */
  distance: number;
  /** Touch duration, in ms. */
  durationMs: number;
  /** Horizontal travel in CSS px; positive is right. Used for the scroll axis. */
  dx?: number;
  /** Vertical travel in CSS px; positive is down. Used for the scroll axis. */
  dy?: number;
}

export interface Tps43GestureDetail {
  /** Dominant scroll axis; vertical when no displacement is given or axes tie. */
  axis: Tps43ScrollAxis;
}

export interface Tps43GestureResult {
  gesture: Tps43Gesture;
  detail?: Tps43GestureDetail;
  /** Whether the matching toggle is on. `none` is always enabled. */
  enabled: boolean;
}

/**
 * Classifies a finished touch from its finger count, travel, and duration.
 *
 * Thresholds:
 * - 2F, distance >= 22 px: scroll, reporting the dominant axis.
 * - 2F, distance < 22 px and duration < 260 ms: two-finger tap.
 * - 1F, distance < 20 px and duration >= `pressAndHoldTime`: hold. Hold is
 *   checked before tap so the Short (150 ms) and Medium (250 ms) presets are
 *   reachable below the 260 ms tap window.
 * - 1F, distance < 20 px and duration < 260 ms: tap.
 * - Anything else: none.
 */
export function classifyTps43Gesture(
  input: Tps43GestureInput,
  settings: Tps43State,
): Tps43GestureResult {
  const { fingerCount, distance, durationMs } = input;

  if (fingerCount === 2) {
    if (distance >= TPS43_TWO_FINGER_TAP_MAX_DISTANCE) {
      return {
        gesture: "scroll",
        detail: { axis: dominantAxis(input) },
        enabled: settings.scroll === true,
      };
    }
    if (durationMs < TPS43_TAP_MAX_DURATION_MS) {
      return {
        gesture: "two-finger-tap",
        enabled: settings.twoFingerTap === true,
      };
    }
    return { gesture: "none", enabled: true };
  }

  if (distance < TPS43_TAP_MAX_DISTANCE) {
    const holdTime =
      settings.pressAndHoldTime ?? TPS43_DEFAULT_PRESS_AND_HOLD_TIME;
    if (durationMs >= holdTime) {
      return { gesture: "hold", enabled: settings.pressAndHold === true };
    }
    if (durationMs < TPS43_TAP_MAX_DURATION_MS) {
      return { gesture: "tap", enabled: settings.oneFingerTap === true };
    }
  }

  return { gesture: "none", enabled: true };
}

function dominantAxis(input: Tps43GestureInput): Tps43ScrollAxis {
  const dx = Math.abs(input.dx ?? 0);
  const dy = Math.abs(input.dy ?? 0);
  // Vertical wins ties and the omitted-displacement case, which is the safer
  // default for a trackpad.
  return dx > dy ? "horizontal" : "vertical";
}
