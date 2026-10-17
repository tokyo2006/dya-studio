/**
 * Demo TPS43 (Azoteq IQS5xx) Trackpad Custom Subsystem Handler
 *
 * Simulates the tokyo2006__tps43 subsystem for demo mode. Defaults mirror the
 * firmware's TPS43_*_DEFAULT values (include/zmk/tps43_state.h).
 */

import {
  type Tps43State,
  type Request,
  type Response,
} from "../../proto/tokyo2006/tps43/tps43";

export const TPS43_IDENTIFIER = "tokyo2006__tps43";

export const TPS43_DEFAULT_STATE: Required<Tps43State> = {
  oneFingerTap: false,
  pressAndHold: false,
  twoFingerTap: false,
  pressAndHoldTime: 250,
  scroll: false,
  naturalScrollX: false,
  naturalScrollY: false,
  switchXy: false,
  flipX: false,
  flipY: false,
  bottomBeta: 5,
  stationaryThreshold: 5,
};

export class Tps43Handler {
  private state: Required<Tps43State> = { ...TPS43_DEFAULT_STATE };

  process(request: Request): Response {
    if (request.getState !== undefined) {
      return { getState: { state: { ...this.state } } };
    }

    if (request.setState !== undefined) {
      const patch = request.setState.state ?? {};
      for (const [key, value] of Object.entries(patch) as [
        keyof Tps43State,
        unknown,
      ][]) {
        if (value === undefined) continue;
        (this.state as Record<string, unknown>)[key] = value;
      }
      return {
        setState: {
          state: { ...this.state },
          persisted: request.setState.persist,
        },
      };
    }

    if (request.reset !== undefined) {
      this.state = { ...TPS43_DEFAULT_STATE };
      return { reset: { state: { ...this.state } } };
    }

    return { error: { message: "Not implemented" } };
  }
}
