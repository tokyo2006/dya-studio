/**
 * Tests for Demo KScan Diagnostics Handler
 */

import { KscanDiagnosticsHandler } from "../demo-kscan-diagnostics";
import { Request } from "../../../proto/cormoran/kscan_diagnostics/kscan_diagnostics";

describe("KscanDiagnosticsHandler", () => {
  let handler: KscanDiagnosticsHandler;

  beforeEach(() => {
    handler = new KscanDiagnosticsHandler();
  });

  describe("getInfo", () => {
    it("reports one device with stats enabled", () => {
      const response = handler.process(Request.create({ getInfo: {} }));

      expect(response.info).toBeDefined();
      expect(response.info?.deviceCount).toBe(1);
      expect(response.info?.statsEnabled).toBe(true);
      expect(response.info?.maxPositions).toBeGreaterThan(0);
    });
  });

  describe("getDevice", () => {
    it("returns the matrix device's config", () => {
      const response = handler.process(
        Request.create({ getDevice: { deviceIndex: 0 } }),
      );

      expect(response.device).toBeDefined();
      expect(response.device?.rows).toBe(4);
      expect(response.device?.columns).toBe(12);
      expect(response.device?.debouncePressMs).toBe(5);
      expect(response.device?.debounceReleaseMs).toBe(5);
    });

    it("errors for an unknown device index", () => {
      const response = handler.process(
        Request.create({ getDevice: { deviceIndex: 5 } }),
      );
      expect(response.error).toBeDefined();
    });
  });

  describe("getStats pagination", () => {
    it("paginates through all positions and finds exactly one chattery key", () => {
      const collected = [];
      let offset = 0;
      for (let i = 0; i < 20; i++) {
        const resp = handler.process(Request.create({ getStats: { offset } }));
        const chunk = resp.stats!;
        collected.push(...chunk.entries);
        offset = chunk.offset + chunk.entries.length;
        if (chunk.entries.length === 0 || offset >= chunk.total) break;
      }

      expect(collected.length).toBeGreaterThan(0);
      // Sanity check pagination actually split across multiple RPC calls.
      const firstPage = handler.process(
        Request.create({ getStats: { offset: 0 } }),
      );
      expect(firstPage.stats!.entries.length).toBeLessThan(collected.length);

      const suspects = collected.filter(
        (s) => s.repressLt10 > 0 || s.presses !== s.releases,
      );
      expect(suspects).toHaveLength(1);
    });

    it("returns an empty page past the end", () => {
      const response = handler.process(
        Request.create({ getStats: { offset: 10000 } }),
      );
      expect(response.stats?.entries).toHaveLength(0);
    });
  });

  describe("resetStats", () => {
    it("zeroes out all counters", () => {
      const resetResp = handler.process(Request.create({ resetStats: {} }));
      expect(resetResp.ok).toBeDefined();

      const statsResp = handler.process(
        Request.create({ getStats: { offset: 0 } }),
      );
      expect(
        statsResp.stats?.entries.every(
          (e) => e.presses === 0 && e.releases === 0 && e.repressLt10 === 0,
        ),
      ).toBe(true);
    });
  });

  describe("invalid request", () => {
    it("returns an error for an empty request", () => {
      const response = handler.process(Request.create({}));
      expect(response.error).toBeDefined();
    });
  });
});
