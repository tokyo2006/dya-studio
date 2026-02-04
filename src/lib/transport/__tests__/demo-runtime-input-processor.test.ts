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
      expect(response.listProcessors?.processors).toBeDefined();
      expect(response.listProcessors?.processors?.length).toBeGreaterThan(0);
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
        expect(firstNotification.processorSettings).toBeDefined();
        expect(firstNotification.processorSettings?.processor).toBeDefined();
        expect(
          firstNotification.processorSettings?.processor?.name,
        ).toBeDefined();
        expect(
          firstNotification.processorSettings?.processor?.scaleMultiplier,
        ).toBeDefined();
        expect(
          firstNotification.processorSettings?.processor?.scaleDivisor,
        ).toBeDefined();
        expect(
          firstNotification.processorSettings?.processor?.rotationDegrees,
        ).toBeDefined();

        done();
      }, 300);
    });
  });

  describe("getProcessor request", () => {
    it("should return processor info for valid name", () => {
      const request = Request.create({
        getProcessor: {
          name: "trackpad",
        },
      });

      const response = handler.process(request);

      expect(response.getProcessor).toBeDefined();
      expect(response.getProcessor?.processor).toBeDefined();
      expect(response.getProcessor?.processor?.name).toBe("trackpad");
      expect(response.error).toBeUndefined();
    });

    it("should return error for invalid processor name", () => {
      const request = Request.create({
        getProcessor: {
          name: "nonexistent",
        },
      });

      const response = handler.process(request);

      expect(response.error).toBeDefined();
      expect(response.error?.message).toContain("not found");
    });
  });

  describe("setScaling request", () => {
    it("should return success response for valid setScaling request", () => {
      const request = Request.create({
        setScaling: {
          name: "trackpad",
          scaleMultiplier: 2,
          scaleDivisor: 1,
        },
      });

      const response = handler.process(request);

      expect(response.setScaling).toBeDefined();
      expect(response.setScaling?.success).toBe(true);
      expect(response.error).toBeUndefined();
    });

    it("should update processor scaling and send notification", (done) => {
      const notifications: Notification[] = [];

      handler.notify((payload: Uint8Array) => {
        const notification = Notification.decode(payload);
        notifications.push(notification);
      });

      const request = Request.create({
        setScaling: {
          name: "trackpad",
          scaleMultiplier: 2,
          scaleDivisor: 1,
        },
      });

      handler.process(request);

      // Wait for notification to be sent
      setTimeout(() => {
        expect(notifications.length).toBeGreaterThan(0);

        const notification = notifications[0];
        expect(notification.processorSettings?.processor?.scaleMultiplier).toBe(
          2,
        );
        expect(notification.processorSettings?.processor?.scaleDivisor).toBe(1);

        done();
      }, 200);
    });

    it("should return failure for invalid processor name", () => {
      const request = Request.create({
        setScaling: {
          name: "nonexistent",
          scaleMultiplier: 2,
          scaleDivisor: 1,
        },
      });

      const response = handler.process(request);

      expect(response.setScaling).toBeDefined();
      expect(response.setScaling?.success).toBe(false);
    });
  });

  describe("setRotation request", () => {
    it("should return success response for valid setRotation request", () => {
      const request = Request.create({
        setRotation: {
          name: "trackpad",
          rotationDegrees: 90,
        },
      });

      const response = handler.process(request);

      expect(response.setRotation).toBeDefined();
      expect(response.setRotation?.success).toBe(true);
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
          name: "trackpad",
          rotationDegrees: 90,
        },
      });

      handler.process(request);

      // Wait for notification to be sent
      setTimeout(() => {
        expect(notifications.length).toBeGreaterThan(0);

        const notification = notifications[0];
        expect(notification.processorSettings?.processor?.rotationDegrees).toBe(
          90,
        );

        done();
      }, 200);
    });

    it("should return failure for invalid processor name", () => {
      const request = Request.create({
        setRotation: {
          name: "nonexistent",
          rotationDegrees: 90,
        },
      });

      const response = handler.process(request);

      expect(response.setRotation).toBeDefined();
      expect(response.setRotation?.success).toBe(false);
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
