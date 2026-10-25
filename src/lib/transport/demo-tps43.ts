/**
 * Demo TPS43 (Azoteq IQS5xx) Trackpad Custom Subsystem Handler
 *
 * Simulates the tokyo2006__tps43 subsystem for demo mode, including the split
 * relay shape: source 0 is the Studio central's own trackpad and source 1 is a
 * peripheral half's. Local requests answer synchronously. `GetInfo{ALL}` adds a
 * `relayRequestId` to the local answer, and every request addressed to source 1
 * answers with `DeferredResponse`; the half's actual answer follows as a
 * `PeripheralResponse` notification, exactly like the firmware relay
 * (proto/tokyo2006/tps43/tps43.proto).
 *
 * Defaults mirror the firmware's TPS43_*_DEFAULT values
 * (include/zmk/tps43_state.h): battery saver Balanced (1) and sensitivity
 * Medium (3).
 */

import {
  Notification,
  type Tps43State,
  type Request,
  type Response,
} from "../../proto/tokyo2006/tps43/tps43";
import { TPS43_SOURCE_ALL } from "../tps43Relay";

export const TPS43_IDENTIFIER = "tokyo2006__tps43";

/** The Studio central itself (a dongle may have no local trackpad). */
export const TPS43_SOURCE_LOCAL = 0;
/** The single simulated peripheral half. */
export const TPS43_SOURCE_PERIPHERAL = 1;

/** Round-trip time of a simulated relay answer over the split link. */
export const TPS43_DEMO_RELAY_DELAY_MS = 20;

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
  palmReject: true,
  batterySaver: 1,
  sensitivity: 3,
};

function requestSource(request: Request): number {
  return (
    request.getState?.source ??
    request.setState?.source ??
    request.reset?.source ??
    TPS43_SOURCE_LOCAL
  );
}

export class Tps43Handler {
  /**
   * Per-source state, indexed by TPS43 source id: 0 local, 1 the peripheral.
   * They are independent, like two physical trackpads.
   */
  private states: Required<Tps43State>[] = [
    { ...TPS43_DEFAULT_STATE },
    { ...TPS43_DEFAULT_STATE },
  ];

  private nextRelayRequestId = 1;
  private callbacks: ((data: Uint8Array) => void)[] = [];
  private pendingTimers = new Set<ReturnType<typeof setTimeout>>();

  /**
   * Answer a request the way the Studio central's firmware would: the local
   * source (0) answers inline, a peripheral source (1) answers with
   * `DeferredResponse` and its real response arrives as a notification.
   */
  process(request: Request): Response {
    if (request.getInfo !== undefined) {
      return this.getInfo(request.getInfo.source);
    }

    const source = requestSource(request);
    if (source === TPS43_SOURCE_ALL) {
      return {
        error: { message: "Broadcast is only supported for GetInfo" },
      };
    }
    if (this.states[source] === undefined) {
      return { error: { message: `Unknown TPS43 source ${source}` } };
    }

    const response = this.processLocal(source, request);
    return source === TPS43_SOURCE_LOCAL
      ? response
      : this.deferToPeripheral(source, response);
  }

  /**
   * Apply and answer a request as `source` itself would, without relaying.
   *
   * The demo uses it to compute the peripheral's relayed answer; tests model a
   * half's own state machine with it. Writes apply immediately (the relay
   * notification only carries the result), so a follow-up read always sees the
   * new state.
   */
  processLocal(source: number, request: Request): Response {
    const state = this.states[source];
    if (state === undefined) {
      return { error: { message: `Unknown TPS43 source ${source}` } };
    }

    if (request.getInfo !== undefined) {
      return { getInfo: { trackpads: [{ source }], relayRequestId: 0 } };
    }

    if (request.getState !== undefined) {
      return { getState: { state: { ...state } } };
    }

    if (request.setState !== undefined) {
      const patch = request.setState.state ?? {};
      for (const [key, value] of Object.entries(patch) as [
        keyof Tps43State,
        unknown,
      ][]) {
        if (value === undefined) continue;
        (state as Record<string, unknown>)[key] = value;
      }
      return {
        setState: {
          state: { ...state },
          persisted: request.setState.persist,
        },
      };
    }

    if (request.reset !== undefined) {
      Object.assign(state, TPS43_DEFAULT_STATE);
      return { reset: { state: { ...state } } };
    }

    return { error: { message: "Not implemented" } };
  }

  private getInfo(source: number): Response {
    if (source === TPS43_SOURCE_ALL) {
      const requestId = this.allocateRelayRequestId();
      // A half reports its trackpad as local (source 0) on the wire; the
      // central stamps the answering half's source, so the demo emits the
      // stamped form (source 1) directly.
      this.schedulePeripheralResponse(TPS43_SOURCE_PERIPHERAL, requestId, {
        getInfo: {
          trackpads: [{ source: TPS43_SOURCE_PERIPHERAL }],
          relayRequestId: 0,
        },
      });
      return {
        getInfo: {
          trackpads: [{ source: TPS43_SOURCE_LOCAL }],
          relayRequestId: requestId,
        },
      };
    }

    if (this.states[source] === undefined) {
      return { error: { message: `Unknown TPS43 source ${source}` } };
    }

    const response: Response = {
      getInfo: { trackpads: [{ source }], relayRequestId: 0 },
    };
    return source === TPS43_SOURCE_LOCAL
      ? response
      : this.deferToPeripheral(source, response);
  }

  private deferToPeripheral(source: number, response: Response): Response {
    const requestId = this.allocateRelayRequestId();
    this.schedulePeripheralResponse(source, requestId, response);
    return { deferred: { requestId } };
  }

  private allocateRelayRequestId(): number {
    const requestId = this.nextRelayRequestId;
    // Match the firmware's uint32 counter; 0 means "no relay id" to the client.
    this.nextRelayRequestId = (this.nextRelayRequestId + 1) >>> 0;
    if (this.nextRelayRequestId === 0) {
      this.nextRelayRequestId = 1;
    }
    return requestId;
  }

  private schedulePeripheralResponse(
    source: number,
    requestId: number,
    response: Response,
  ) {
    const timer = setTimeout(() => {
      this.pendingTimers.delete(timer);
      const payload = Notification.encode(
        Notification.create({
          peripheralResponse: { source, requestId, response },
        }),
      ).finish();
      for (const callback of this.callbacks) {
        callback(payload);
      }
    }, TPS43_DEMO_RELAY_DELAY_MS);
    this.pendingTimers.add(timer);
  }

  notify(callback: (data: Uint8Array) => void) {
    this.callbacks.push(callback);
  }

  /** Drop queued relay answers so a torn-down transport leaks no timers. */
  disconnect() {
    for (const timer of this.pendingTimers) {
      clearTimeout(timer);
    }
    this.pendingTimers.clear();
  }
}
