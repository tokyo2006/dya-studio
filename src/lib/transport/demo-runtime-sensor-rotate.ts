/**
 * Demo Runtime Sensor Rotate Custom Subsystem Handler
 *
 * Provides mock runtime sensor rotate data for demo mode.
 * Simulates 2 rotary encoders (left and right) with configurable bindings per layer.
 */

import {
  type Request,
  type Response,
  type SensorInfo,
  type LayerBindings,
  type Binding,
} from "../../proto/zmk/runtime_sensor_rotate/runtime_sensor_rotate";

export const RUNTIME_SENSOR_ROTATE_IDENTIFIER = "cormoran_rsr";

/**
 * Mock sensor data
 * Simulates 2 rotary encoders: left and right
 */
const MOCK_SENSORS: SensorInfo[] = [
  {
    index: 0,
    name: "Left Encoder",
  },
  {
    index: 1,
    name: "Right Encoder",
  },
];

/**
 * Helper to create a binding
 */
function createBinding(
  behaviorId: number,
  param1: number,
  param2: number,
  tapMs = 5,
): Binding {
  return {
    behaviorId,
    param1,
    param2,
    tapMs,
  };
}

/**
 * Helper to create HID usage code for consumer page
 * Consumer page is 0x0c, shifted left 16 bits, OR'd with usage ID
 */
function createConsumerCode(usageId: number): number {
  return (0x0c << 16) | usageId;
}

// Keypress behavior ID (from behaviors.ts)
const BEHAVIOR_KEY_PRESS = 10;

// Consumer keycodes
const VOL_UP = createConsumerCode(0xe9);
const VOL_DOWN = createConsumerCode(0xea);
const BRIGHTNESS_UP = createConsumerCode(0x6f);
const BRIGHTNESS_DOWN = createConsumerCode(0x70);

/**
 * Mock layer bindings for each sensor
 * Left encoder: Volume control on base layer, brightness on layer 1
 * Right encoder: Brightness control on base layer, volume on layer 1
 */
const MOCK_BINDINGS: Map<number, LayerBindings[]> = new Map([
  [
    0, // Left Encoder
    [
      {
        layer: 0, // Base layer
        cwBinding: createBinding(BEHAVIOR_KEY_PRESS, VOL_UP, 0),
        ccwBinding: createBinding(BEHAVIOR_KEY_PRESS, VOL_DOWN, 0),
      },
      {
        layer: 1, // Lower layer
        cwBinding: createBinding(BEHAVIOR_KEY_PRESS, BRIGHTNESS_UP, 0),
        ccwBinding: createBinding(BEHAVIOR_KEY_PRESS, BRIGHTNESS_DOWN, 0),
      },
      {
        layer: 2, // Raise layer
        cwBinding: createBinding(BEHAVIOR_KEY_PRESS, VOL_UP, 0),
        ccwBinding: createBinding(BEHAVIOR_KEY_PRESS, VOL_DOWN, 0),
      },
    ],
  ],
  [
    1, // Right Encoder
    [
      {
        layer: 0, // Base layer
        cwBinding: createBinding(BEHAVIOR_KEY_PRESS, BRIGHTNESS_UP, 0),
        ccwBinding: createBinding(BEHAVIOR_KEY_PRESS, BRIGHTNESS_DOWN, 0),
      },
      {
        layer: 1, // Lower layer
        cwBinding: createBinding(BEHAVIOR_KEY_PRESS, VOL_UP, 0),
        ccwBinding: createBinding(BEHAVIOR_KEY_PRESS, VOL_DOWN, 0),
      },
      {
        layer: 2, // Raise layer
        cwBinding: createBinding(BEHAVIOR_KEY_PRESS, BRIGHTNESS_UP, 0),
        ccwBinding: createBinding(BEHAVIOR_KEY_PRESS, BRIGHTNESS_DOWN, 0),
      },
    ],
  ],
]);

/**
 * Runtime Sensor Rotate Handler
 */
export class RuntimeSensorRotateHandler {
  private callbacks: ((data: Uint8Array) => void)[] = [];
  private bindings: Map<number, LayerBindings[]> = new Map(
    [...MOCK_BINDINGS].map(([key, value]) => [
      key,
      value.map((binding) => ({
        layer: binding.layer,
        cwBinding: binding.cwBinding
          ? { ...binding.cwBinding }
          : binding.cwBinding,
        ccwBinding: binding.ccwBinding
          ? { ...binding.ccwBinding }
          : binding.ccwBinding,
      })),
    ]),
  );

  process(request: Request): Response {
    // Get sensors
    if (request.getSensors !== undefined) {
      return {
        getSensors: {
          sensors: MOCK_SENSORS,
        },
      };
    }

    // Get all layer bindings for a sensor
    if (request.getAllLayerBindings !== undefined) {
      const { sensorIndex } = request.getAllLayerBindings;
      const bindings = this.bindings.get(sensorIndex);

      if (bindings) {
        return {
          getAllLayerBindings: {
            bindings,
          },
        };
      }

      return { error: { message: `Sensor not found: ${sensorIndex}` } };
    }

    // Set clockwise binding for a sensor/layer
    if (request.setLayerCwBinding !== undefined) {
      const { sensorIndex, layer, binding } = request.setLayerCwBinding;
      const sensorBindings = this.bindings.get(sensorIndex);

      if (!sensorBindings) {
        return { error: { message: `Sensor not found: ${sensorIndex}` } };
      }

      // Find or create layer bindings
      let layerBindings = sensorBindings.find((b) => b.layer === layer);
      if (!layerBindings) {
        layerBindings = {
          layer,
          cwBinding: undefined,
          ccwBinding: undefined,
        };
        sensorBindings.push(layerBindings);
      }

      // Update binding
      if (binding) {
        layerBindings.cwBinding = binding;
      }

      return {
        setLayerCwBinding: {
          success: true,
        },
      };
    }

    // Set counter-clockwise binding for a sensor/layer
    if (request.setLayerCcwBinding !== undefined) {
      const { sensorIndex, layer, binding } = request.setLayerCcwBinding;
      const sensorBindings = this.bindings.get(sensorIndex);

      if (!sensorBindings) {
        return { error: { message: `Sensor not found: ${sensorIndex}` } };
      }

      // Find or create layer bindings
      let layerBindings = sensorBindings.find((b) => b.layer === layer);
      if (!layerBindings) {
        layerBindings = {
          layer,
          cwBinding: undefined,
          ccwBinding: undefined,
        };
        sensorBindings.push(layerBindings);
      }

      // Update binding
      if (binding) {
        layerBindings.ccwBinding = binding;
      }

      return {
        setLayerCcwBinding: {
          success: true,
        },
      };
    }

    return { error: { message: "Not implemented" } };
  }

  notify(callback: (data: Uint8Array) => void) {
    this.callbacks.push(callback);
  }
}
