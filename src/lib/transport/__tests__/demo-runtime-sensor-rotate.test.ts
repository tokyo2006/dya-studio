/**
 * Tests for demo-runtime-sensor-rotate.ts
 */

import { RuntimeSensorRotateHandler } from "../demo-runtime-sensor-rotate";
import { Request } from "../../../proto/zmk/runtime_sensor_rotate/runtime_sensor_rotate";

describe("RuntimeSensorRotateHandler", () => {
  let handler: RuntimeSensorRotateHandler;

  beforeEach(() => {
    handler = new RuntimeSensorRotateHandler();
  });

  describe("getSensors", () => {
    it("should return 2 sensors (left and right encoders)", () => {
      const request = Request.create({
        getSensors: {},
      });

      const response = handler.process(request);

      expect(response.getSensors).toBeDefined();
      expect(response.getSensors?.sensors).toHaveLength(2);
      expect(response.getSensors?.sensors[0]).toMatchObject({
        index: 0,
        name: "Left Encoder",
      });
      expect(response.getSensors?.sensors[1]).toMatchObject({
        index: 1,
        name: "Right Encoder",
      });
    });
  });

  describe("getAllLayerBindings", () => {
    it("should return layer bindings for left encoder (sensor 0)", () => {
      const request = Request.create({
        getAllLayerBindings: {
          sensorIndex: 0,
        },
      });

      const response = handler.process(request);

      expect(response.getAllLayerBindings).toBeDefined();
      expect(response.getAllLayerBindings?.bindings).toBeDefined();
      const bindings = response.getAllLayerBindings?.bindings || [];
      expect(bindings.length).toBeGreaterThan(0);

      // Check layer 0 (base layer) has volume bindings
      const layer0 = bindings.find((b) => b.layer === 0);
      expect(layer0).toBeDefined();
      expect(layer0?.cwBinding).toBeDefined();
      expect(layer0?.ccwBinding).toBeDefined();
      // Behavior ID 10 is Key Press
      expect(layer0?.cwBinding?.behaviorId).toBe(10);
      expect(layer0?.ccwBinding?.behaviorId).toBe(10);
    });

    it("should return layer bindings for right encoder (sensor 1)", () => {
      const request = Request.create({
        getAllLayerBindings: {
          sensorIndex: 1,
        },
      });

      const response = handler.process(request);

      expect(response.getAllLayerBindings).toBeDefined();
      expect(response.getAllLayerBindings?.bindings).toBeDefined();
      const bindings = response.getAllLayerBindings?.bindings || [];
      expect(bindings.length).toBeGreaterThan(0);

      // Check layer 0 (base layer) exists
      const layer0 = bindings.find((b) => b.layer === 0);
      expect(layer0).toBeDefined();
      expect(layer0?.cwBinding).toBeDefined();
      expect(layer0?.ccwBinding).toBeDefined();
    });

    it("should return error for invalid sensor index", () => {
      const request = Request.create({
        getAllLayerBindings: {
          sensorIndex: 99,
        },
      });

      const response = handler.process(request);

      expect(response.error).toBeDefined();
      expect(response.error?.message).toContain("Sensor not found");
    });
  });

  describe("setLayerCwBinding", () => {
    it("should set clockwise binding for a sensor/layer", () => {
      const request = Request.create({
        setLayerCwBinding: {
          sensorIndex: 0,
          layer: 0,
          binding: {
            behaviorId: 10,
            param1: 100,
            param2: 0,
            tapMs: 5,
          },
        },
      });

      const response = handler.process(request);

      expect(response.setLayerCwBinding).toBeDefined();
      expect(response.setLayerCwBinding?.success).toBe(true);

      // Verify the binding was updated
      const getRequest = Request.create({
        getAllLayerBindings: {
          sensorIndex: 0,
        },
      });
      const getResponse = handler.process(getRequest);
      const layer0 = getResponse.getAllLayerBindings?.bindings.find(
        (b) => b.layer === 0,
      );
      expect(layer0?.cwBinding?.param1).toBe(100);
    });

    it("should return error for invalid sensor index", () => {
      const request = Request.create({
        setLayerCwBinding: {
          sensorIndex: 99,
          layer: 0,
          binding: {
            behaviorId: 10,
            param1: 100,
            param2: 0,
            tapMs: 5,
          },
        },
      });

      const response = handler.process(request);

      expect(response.error).toBeDefined();
      expect(response.error?.message).toContain("Sensor not found");
    });

    it("should create new layer bindings if layer doesn't exist", () => {
      const request = Request.create({
        setLayerCwBinding: {
          sensorIndex: 0,
          layer: 5, // Non-existent layer
          binding: {
            behaviorId: 10,
            param1: 200,
            param2: 0,
            tapMs: 5,
          },
        },
      });

      const response = handler.process(request);

      expect(response.setLayerCwBinding).toBeDefined();
      expect(response.setLayerCwBinding?.success).toBe(true);

      // Verify new layer was created
      const getRequest = Request.create({
        getAllLayerBindings: {
          sensorIndex: 0,
        },
      });
      const getResponse = handler.process(getRequest);
      const layer5 = getResponse.getAllLayerBindings?.bindings.find(
        (b) => b.layer === 5,
      );
      expect(layer5).toBeDefined();
      expect(layer5?.cwBinding?.param1).toBe(200);
    });
  });

  describe("setLayerCcwBinding", () => {
    it("should set counter-clockwise binding for a sensor/layer", () => {
      const request = Request.create({
        setLayerCcwBinding: {
          sensorIndex: 1,
          layer: 1,
          binding: {
            behaviorId: 10,
            param1: 300,
            param2: 0,
            tapMs: 5,
          },
        },
      });

      const response = handler.process(request);

      expect(response.setLayerCcwBinding).toBeDefined();
      expect(response.setLayerCcwBinding?.success).toBe(true);

      // Verify the binding was updated
      const getRequest = Request.create({
        getAllLayerBindings: {
          sensorIndex: 1,
        },
      });
      const getResponse = handler.process(getRequest);
      const layer1 = getResponse.getAllLayerBindings?.bindings.find(
        (b) => b.layer === 1,
      );
      expect(layer1?.ccwBinding?.param1).toBe(300);
    });

    it("should return error for invalid sensor index", () => {
      const request = Request.create({
        setLayerCcwBinding: {
          sensorIndex: 99,
          layer: 0,
          binding: {
            behaviorId: 10,
            param1: 100,
            param2: 0,
            tapMs: 5,
          },
        },
      });

      const response = handler.process(request);

      expect(response.error).toBeDefined();
      expect(response.error?.message).toContain("Sensor not found");
    });
  });

  describe("unimplemented requests", () => {
    it("should return error for unimplemented request", () => {
      const request = Request.create({});

      const response = handler.process(request);

      expect(response.error).toBeDefined();
      expect(response.error?.message).toContain("Not implemented");
    });
  });

  describe("notify", () => {
    it("should register notification callback", () => {
      const callback = jest.fn();
      handler.notify(callback);

      // Notification callback should be registered but not called yet
      expect(callback).not.toHaveBeenCalled();
    });
  });
});
