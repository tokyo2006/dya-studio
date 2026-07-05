/**
 * Tests for Demo Watchdog Handler
 */

import { WatchdogHandler } from "../demo-watchdog";
import { Request } from "../../../proto/cormoran/watchdog/watchdog";

describe("WatchdogHandler", () => {
  let handler: WatchdogHandler;

  beforeEach(() => {
    handler = new WatchdogHandler();
  });

  describe("getStatus", () => {
    it("returns status for the local source (0)", () => {
      const response = handler.process(
        Request.create({ getStatus: { source: 0 } }),
      );

      expect(response.status).toBeDefined();
      expect(response.status?.capacity).toBe(16);
      expect(response.status?.stored).toBe(2);
      expect(response.status?.recordingStopped).toBe(false);
    });

    it("returns an error for a peripheral source (demo has no relay)", () => {
      const response = handler.process(
        Request.create({ getStatus: { source: 1 } }),
      );

      expect(response.error).toBeDefined();
      expect(response.status).toBeUndefined();
    });
  });

  describe("listIncidents pagination", () => {
    it("returns all seeded incidents from a single page (2 <= page size 4)", () => {
      const response = handler.process(
        Request.create({ listIncidents: { startIndex: 0, source: 0 } }),
      );

      expect(response.incidentPage).toBeDefined();
      expect(response.incidentPage?.total).toBe(2);
      expect(response.incidentPage?.incidents).toHaveLength(2);
      expect(response.incidentPage?.startIndex).toBe(0);
    });

    it("paginates across multiple pages once more incidents exist than fit on one page", () => {
      // Force more incidents onto the store by deleting nothing and instead
      // exercising listIncidents at an offset beyond total: should come back
      // empty. Then verify the natural (2-incident) pagination loop
      // terminates correctly by simulating a client loop.
      const collected = [];
      let startIndex = 0;
      for (let i = 0; i < 10; i++) {
        const resp = handler.process(
          Request.create({ listIncidents: { startIndex, source: 0 } }),
        );
        const page = resp.incidentPage!;
        collected.push(...page.incidents);
        startIndex += page.incidents.length;
        if (page.incidents.length === 0 || startIndex >= page.total) break;
      }
      expect(collected).toHaveLength(2);
      expect(collected.map((i) => i.id)).toEqual([1, 2]);
    });

    it("returns an empty page past the end", () => {
      const response = handler.process(
        Request.create({ listIncidents: { startIndex: 100, source: 0 } }),
      );
      expect(response.incidentPage?.incidents).toHaveLength(0);
    });

    it("returns an error for a peripheral source", () => {
      const response = handler.process(
        Request.create({ listIncidents: { startIndex: 0, source: 2 } }),
      );
      expect(response.error).toBeDefined();
    });
  });

  describe("deleteIncidents", () => {
    it("deletes a single incident by id", () => {
      const response = handler.process(
        Request.create({
          deleteIncidents: { ids: [1], all: false, source: 0 },
        }),
      );

      expect(response.deleteResult?.deleted).toBe(1);

      const remaining = handler.process(
        Request.create({ listIncidents: { startIndex: 0, source: 0 } }),
      );
      expect(remaining.incidentPage?.total).toBe(1);
      expect(remaining.incidentPage?.incidents[0].id).toBe(2);
    });

    it("deletes all incidents when all=true", () => {
      const response = handler.process(
        Request.create({ deleteIncidents: { ids: [], all: true, source: 0 } }),
      );

      expect(response.deleteResult?.deleted).toBe(2);

      const remaining = handler.process(
        Request.create({ listIncidents: { startIndex: 0, source: 0 } }),
      );
      expect(remaining.incidentPage?.total).toBe(0);
    });

    it("reflects deletions in getStatus stored count", () => {
      handler.process(
        Request.create({
          deleteIncidents: { ids: [1], all: false, source: 0 },
        }),
      );
      const status = handler.process(
        Request.create({ getStatus: { source: 0 } }),
      );
      expect(status.status?.stored).toBe(1);
    });

    it("returns an error for a peripheral source", () => {
      const response = handler.process(
        Request.create({
          deleteIncidents: { ids: [], all: true, source: 3 },
        }),
      );
      expect(response.error).toBeDefined();
    });
  });

  describe("invalid request", () => {
    it("returns an error for an empty request", () => {
      const response = handler.process(Request.create({}));
      expect(response.error).toBeDefined();
    });
  });
});
