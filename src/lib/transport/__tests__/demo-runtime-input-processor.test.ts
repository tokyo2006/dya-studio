/**
 * Tests for Demo Runtime Input Processor Handler
 */

import { RuntimeInputProcessorHandler } from "../demo-runtime-input-processor";
import {
  Request,
  Notification,
} from "../../../proto/zmk/runtime_input_processor/runtime_input_processor";

describe("RuntimeInputProcessorHandler", () => {
  let handler: RuntimeInputProcessorHandler;

  beforeEach(() => {
    handler = new RuntimeInputProcessorHandler();
  });

  describe("listProcessors request", () => {
    it("should return success response for listProcessors request", () => {
      const request = Request.create({
        listProcessors: {},
      });

      const response = handler.process(request);

      expect(response.listProcessors).toBeDefined();
      expect(response.error).toBeUndefined();
    });

    it("should send processor notifications via callback", (done) => {
      const notifications: Notification[] = [];

      handler.notify((payload: Uint8Array) => {
        const notification = Notification.decode(payload);
        notifications.push(notification);
      });

      const request = Request.create({
        listProcessors: {},
      });

      handler.process(request);

      // Wait for notifications to be sent
      setTimeout(() => {
        // Should have at least one processor notification
        expect(notifications.length).toBeGreaterThan(0);

        // Verify notification structure
        const firstNotification = notifications[0];
        expect(firstNotification.processorChanged).toBeDefined();
        expect(firstNotification.processorChanged?.processor).toBeDefined();
        expect(firstNotification.processorChanged?.processor?.id).toBeDefined();
        expect(
          firstNotification.processorChanged?.processor?.name,
        ).toBeDefined();
        expect(
          firstNotification.processorChanged?.processor?.scaleMultiplier,
        ).toBeDefined();
        expect(
          firstNotification.processorChanged?.processor?.scaleDivisor,
        ).toBeDefined();
        expect(
          firstNotification.processorChanged?.processor?.rotationDegrees,
        ).toBeDefined();

        done();
      }, 300);
    });
  });

  describe("getProcessor request", () => {
    it("should return processor info for valid id", () => {
      const request = Request.create({
        getProcessor: {
          id: 0,
        },
      });

      const response = handler.process(request);

      expect(response.getProcessor).toBeDefined();
      expect(response.getProcessor?.processor).toBeDefined();
      expect(response.getProcessor?.processor?.id).toBe(0);
      expect(response.getProcessor?.processor?.name).toBe("trackpad");
      expect(response.error).toBeUndefined();
    });

    it("should return error for invalid processor id", () => {
      const request = Request.create({
        getProcessor: {
          id: 999,
        },
      });

      const response = handler.process(request);

      expect(response.error).toBeDefined();
      expect(response.error?.message).toContain("not found");
    });
  });

  describe("setScaleMultiplier request", () => {
    it("should return success response for valid setScaleMultiplier request", () => {
      const request = Request.create({
        setScaleMultiplier: {
          id: 0,
          value: 2,
        },
      });

      const response = handler.process(request);

      expect(response.setScaleMultiplier).toBeDefined();
      expect(response.error).toBeUndefined();
    });

    it("should update processor multiplier and send notification", (done) => {
      const notifications: Notification[] = [];

      handler.notify((payload: Uint8Array) => {
        const notification = Notification.decode(payload);
        notifications.push(notification);
      });

      const request = Request.create({
        setScaleMultiplier: {
          id: 0,
          value: 2,
        },
      });

      handler.process(request);

      // Wait for notification to be sent
      setTimeout(() => {
        expect(notifications.length).toBeGreaterThan(0);

        const notification = notifications[0];
        expect(notification.processorChanged?.processor?.scaleMultiplier).toBe(
          2,
        );

        done();
      }, 200);
    });

    it("should return error for invalid processor id", () => {
      const request = Request.create({
        setScaleMultiplier: {
          id: 999,
          value: 2,
        },
      });

      const response = handler.process(request);

      expect(response.error).toBeDefined();
      expect(response.error?.message).toContain("not found");
    });
  });

  describe("setRotation request", () => {
    it("should return success response for valid setRotation request", () => {
      const request = Request.create({
        setRotation: {
          id: 0,
          value: 90,
        },
      });

      const response = handler.process(request);

      expect(response.setRotation).toBeDefined();
      expect(response.error).toBeUndefined();
    });

    it("should update processor rotation and send notification", (done) => {
      const notifications: Notification[] = [];

      handler.notify((payload: Uint8Array) => {
        const notification = Notification.decode(payload);
        notifications.push(notification);
      });

      const request = Request.create({
        setRotation: {
          id: 0,
          value: 90,
        },
      });

      handler.process(request);

      // Wait for notification to be sent
      setTimeout(() => {
        expect(notifications.length).toBeGreaterThan(0);

        const notification = notifications[0];
        expect(notification.processorChanged?.processor?.rotationDegrees).toBe(
          90,
        );

        done();
      }, 200);
    });

    it("should return error for invalid processor id", () => {
      const request = Request.create({
        setRotation: {
          id: 999,
          value: 90,
        },
      });

      const response = handler.process(request);

      expect(response.error).toBeDefined();
      expect(response.error?.message).toContain("not found");
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
        listProcessors: {},
      });

      handler.process(request);

      // Wait for notifications
      setTimeout(() => {
        expect(callbackCalled).toBe(true);
        done();
      }, 200);
    });
  });
});
