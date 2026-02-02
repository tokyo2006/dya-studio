/**
 * Tests for Demo Battery History Handler
 */

import { BatteryHistoryHandler } from "../demo-battery";
import { Request, Notification } from "../../../proto/zmk/battery_history/battery_history";

describe("BatteryHistoryHandler", () => {
  let handler: BatteryHistoryHandler;

  beforeEach(() => {
    handler = new BatteryHistoryHandler();
  });

  describe("getHistory request", () => {
    it("should return success response for getHistory request", () => {
      const request = Request.create({
        getHistory: {},
      });

      const response = handler.process(request);

      expect(response.getHistory).toBeDefined();
      expect(response.error).toBeUndefined();
    });

    it("should send battery history notifications via callback", (done) => {
      const notifications: Notification[] = [];
      
      handler.notify((payload: Uint8Array) => {
        const notification = Notification.decode(payload);
        notifications.push(notification);
      });

      const request = Request.create({
        getHistory: {},
      });

      handler.process(request);

      // Wait for notifications to be sent
      setTimeout(() => {
        // Should have notifications for both central and peripheral
        expect(notifications.length).toBeGreaterThan(0);
        
        // Check that we have notifications from different sources
        const sourceIds = new Set(notifications.map(n => n.batteryHistory?.sourceId));
        expect(sourceIds.has(0)).toBe(true); // Central
        expect(sourceIds.has(1)).toBe(true); // Peripheral

        // Verify notification structure
        const firstNotification = notifications[0];
        expect(firstNotification.batteryHistory).toBeDefined();
        expect(firstNotification.batteryHistory?.entry).toBeDefined();
        expect(firstNotification.batteryHistory?.entry?.timestamp).toBeGreaterThan(0);
        expect(firstNotification.batteryHistory?.entry?.batteryLevel).toBeGreaterThanOrEqual(0);
        expect(firstNotification.batteryHistory?.entry?.batteryLevel).toBeLessThanOrEqual(100);

        // Verify isLast flag is set correctly
        const lastNotifications = notifications.filter(n => n.batteryHistory?.isLast);
        expect(lastNotifications.length).toBeGreaterThan(0);

        done();
      }, 500);
    });
  });

  describe("clearHistory request", () => {
    it("should return success response for clearHistory request", () => {
      const request = Request.create({
        clearHistory: {},
      });

      const response = handler.process(request);

      expect(response.clearHistory).toBeDefined();
      expect(response.clearHistory?.entriesCleared).toBeGreaterThan(0);
      expect(response.error).toBeUndefined();
    });
  });

  describe("invalid request", () => {
    it("should return error for empty request", () => {
      const request = Request.create({});

      const response = handler.process(request);

      expect(response.error).toBeDefined();
      expect(response.error?.message).toBe("Not implemented");
    });
  });

  describe("notify callback", () => {
    it("should register notify callback", (done) => {
      let callbackCalled = false;
      
      handler.notify(() => {
        callbackCalled = true;
      });

      const request = Request.create({
        getHistory: {},
      });

      handler.process(request);

      // Wait for notifications
      setTimeout(() => {
        expect(callbackCalled).toBe(true);
        done();
      }, 300);
    });
  });
});
