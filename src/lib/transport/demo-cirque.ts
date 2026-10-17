/**
 * Demo Cirque Trackpad Custom Subsystem Handler
 *
 * Simulates the tokyo2006__cirque subsystem for demo mode. Defaults mirror
 * the firmware's CIRQUE_*_DEFAULT values (include/zmk/cirque_state.h).
 */

import {
  type CirqueState,
  type Request,
  type Response,
} from "../../proto/tokyo2006/cirque/cirque";

export const CIRQUE_IDENTIFIER = "tokyo2006__cirque";

export const CIRQUE_DEFAULT_STATE: Required<CirqueState> = {
  dataMode: 0,
  sensitivity: 0,
  invertX: false,
  invertY: false,
  swapXy: false,
  rotateDegrees: 0,
  primaryTapEnable: true,
  secondaryTapEnable: false,
  auxTapEnable: false,
  tapMaxMs: 250,
  tapMaxMovement: 200,
  tapClickMs: 30,
  tapDragEnable: false,
  tapDragTimeoutMs: 350,
  tapDragMaxMovement: 150,
  secondaryTapAreaWidth: 0,
  secondaryTapAreaHeight: 0,
  auxTapAreaWidth: 0,
  auxTapAreaHeight: 0,
  edgeMotionEnable: false,
  edgeMotionZone: 100,
  edgeMotionSpeed: 5,
  edgeMotionIntervalMs: 50,
  edgeMotionStartMs: 300,
  rightEdgeScrollEnable: false,
  topEdgeScrollEnable: false,
  scrollZone: 80,
  scrollDivisor: 8,
  invertScroll: false,
  relativeMultiplier: 1,
  relativeDivisor: 1,
  absoluteRelativeMultiplier: 1,
  absoluteRelativeDivisor: 1,
  sleepModeEnable: true,
  dragScrollEnabled: false,
  pointerSpeedPosition: 50,
  scrollSpeedPosition: 50,
};

// Fields the firmware's reset does not touch (they mirror other modules).
const MIRROR_FIELDS = [
  "dragScrollEnabled",
  "pointerSpeedPosition",
  "scrollSpeedPosition",
] as const;

function validate(key: keyof CirqueState, value: unknown): boolean {
  if (key === "rotateDegrees")
    return [0, 90, 180, 270].includes(value as number);
  if (key === "scrollDivisor") return (value as number) >= 1;
  return true;
}

export class CirqueHandler {
  private state: Required<CirqueState> = { ...CIRQUE_DEFAULT_STATE };

  process(request: Request): Response {
    if (request.getState !== undefined) {
      return { getState: { state: { ...this.state } } };
    }

    if (request.setState !== undefined) {
      const patch = request.setState.state ?? {};
      let firstError: string | null = null;
      // Apply every valid field and report the first failure, like firmware.
      for (const [key, value] of Object.entries(patch) as [
        keyof CirqueState,
        unknown,
      ][]) {
        if (value === undefined) continue;
        if (!validate(key, value)) {
          firstError ??= `${key} failed (-22)`;
          continue;
        }
        (this.state as Record<string, unknown>)[key] = key.endsWith("Position")
          ? Math.min(value as number, 100)
          : value;
      }
      if (firstError) return { error: { message: firstError } };
      return {
        setState: {
          state: { ...this.state },
          persisted: request.setState.persist,
        },
      };
    }

    if (request.reset !== undefined) {
      const mirrors = Object.fromEntries(
        MIRROR_FIELDS.map((key) => [key, this.state[key]]),
      );
      this.state = { ...CIRQUE_DEFAULT_STATE, ...mirrors };
      return { reset: { state: { ...this.state } } };
    }

    return { error: { message: "Not implemented" } };
  }
}
