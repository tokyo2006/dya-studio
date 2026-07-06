/**
 * Demo Watchdog (Stability) Custom Subsystem Handler
 *
 * Provides mock incident/status data for demo mode. Mirrors the firmware's
 * pagination (<=4 incidents per page) and the source==0 (local/central) vs
 * source>0 (split peripheral, relayed) split described in
 * proto/cormoran/watchdog/watchdog.proto.
 */

import {
  type Request,
  type Response,
  type Incident,
  IncidentType,
} from "../../proto/cormoran/watchdog/watchdog";

export const WATCHDOG_IDENTIFIER = "cormoran__watchdog";

const PAGE_SIZE = 4;
const CAPACITY = 16;

function initialIncidents(): Incident[] {
  return [
    {
      id: 1,
      source: 0,
      type: IncidentType.FREEZE,
      bootOrdinal: 3,
      uptimeS: 1200,
      freeze: { channelId: 0, queueName: "sysworkq" },
    },
    {
      id: 2,
      source: 0,
      type: IncidentType.RESET_CAUSE,
      bootOrdinal: 4,
      uptimeS: 0,
      reset: { causeBits: 1 << 3 },
    },
  ];
}

export class WatchdogHandler {
  private incidents: Incident[] = initialIncidents();
  private droppedSinceBoot = 0;
  private callbacks: ((data: Uint8Array) => void)[] = [];

  process(request: Request): Response {
    if (request.getStatus !== undefined) {
      const { source } = request.getStatus;
      if (source > 0) {
        return {
          error: { message: "Demo keyboard has no peripheral relay" },
        };
      }
      return {
        status: {
          capacity: CAPACITY,
          stored: this.incidents.length,
          droppedSinceBoot: this.droppedSinceBoot,
          recordingStopped: this.incidents.length >= CAPACITY,
        },
      };
    }

    if (request.listIncidents !== undefined) {
      const { startIndex, source } = request.listIncidents;
      if (source > 0) {
        return {
          error: { message: "Demo keyboard has no peripheral relay" },
        };
      }
      const page = this.incidents.slice(startIndex, startIndex + PAGE_SIZE);
      return {
        incidentPage: {
          incidents: page,
          total: this.incidents.length,
          startIndex,
        },
      };
    }

    if (request.deleteIncidents !== undefined) {
      const { ids, all, source } = request.deleteIncidents;
      if (source > 0) {
        return {
          error: { message: "Demo keyboard has no peripheral relay" },
        };
      }
      let deleted = 0;
      if (all) {
        deleted = this.incidents.length;
        this.incidents = [];
      } else {
        const idSet = new Set(ids);
        const before = this.incidents.length;
        this.incidents = this.incidents.filter((i) => !idSet.has(i.id));
        deleted = before - this.incidents.length;
      }
      return { deleteResult: { deleted } };
    }

    return { error: { message: "Not implemented" } };
  }

  notify(callback: (data: Uint8Array) => void) {
    this.callbacks.push(callback);
  }
}
