/**
 * Demo Runtime Input Processor Custom Subsystem Handler
 *
 * Provides mock runtime input processor data for demo mode.
 */

import {
  Notification,
  type Request,
  type Response,
  type ProcessorInfo,
} from "../../proto/zmk/runtime_input_processor/runtime_input_processor";

export const RUNTIME_INPUT_PROCESSOR_IDENTIFIER =
  "zmk__runtime_input_processor";

/**
 * Mock runtime input processor data
 * Simulates a trackball processor with default settings
 */
const MOCK_PROCESSORS: ProcessorInfo[] = [
  {
    id: 0,
    name: "trackpad",
    scaleMultiplier: 1,
    scaleDivisor: 1,
    rotationDegrees: 0,
    tempLayerEnabled: false,
    tempLayerLayer: 0,
    tempLayerActivationDelayMs: 100,
    tempLayerDeactivationDelayMs: 500,
  },
];

/**
 * Runtime Input Processor Handler
 */
export class RuntimeInputProcessorHandler {
  private callbacks: ((data: Uint8Array) => void)[] = [];
  private processors: ProcessorInfo[] = JSON.parse(
    JSON.stringify(MOCK_PROCESSORS),
  );

  process(request: Request): Response {
    if (request.listProcessors !== undefined) {
      // Send processor data via notifications
      setTimeout(() => {
        this.processors.forEach((processor) => {
          console.log("Demo sending processor settings:", processor);
          this.callbacks.forEach((cb) => {
            cb(
              Notification.encode({
                processorChanged: {
                  processor,
                },
              }).finish(),
            );
          });
        });
      }, 100);

      return { listProcessors: {} };
    }

    if (request.getProcessor !== undefined) {
      const { id } = request.getProcessor;
      const processor = this.processors.find((p) => p.id === id);

      if (processor) {
        return { getProcessor: { processor } };
      }

      return { error: { message: `Processor not found: ${id}` } };
    }

    if (request.setScaleMultiplier !== undefined) {
      const { id, value } = request.setScaleMultiplier;
      const processor = this.processors.find((p) => p.id === id);

      if (processor) {
        processor.scaleMultiplier = value;

        // Send notification about the update
        setTimeout(() => {
          console.log("Demo sending updated processor settings:", processor);
          this.callbacks.forEach((cb) => {
            cb(
              Notification.encode({
                processorChanged: {
                  processor,
                },
              }).finish(),
            );
          });
        }, 50);

        return { setScaleMultiplier: {} };
      }

      return { error: { message: `Processor not found: ${id}` } };
    }

    if (request.setScaleDivisor !== undefined) {
      const { id, value } = request.setScaleDivisor;
      const processor = this.processors.find((p) => p.id === id);

      if (processor) {
        processor.scaleDivisor = value;

        // Send notification about the update
        setTimeout(() => {
          console.log("Demo sending updated processor settings:", processor);
          this.callbacks.forEach((cb) => {
            cb(
              Notification.encode({
                processorChanged: {
                  processor,
                },
              }).finish(),
            );
          });
        }, 50);

        return { setScaleDivisor: {} };
      }

      return { error: { message: `Processor not found: ${id}` } };
    }

    if (request.setRotation !== undefined) {
      const { id, value } = request.setRotation;
      const processor = this.processors.find((p) => p.id === id);

      if (processor) {
        processor.rotationDegrees = value;

        // Send notification about the update
        setTimeout(() => {
          console.log("Demo sending updated processor settings:", processor);
          this.callbacks.forEach((cb) => {
            cb(
              Notification.encode({
                processorChanged: {
                  processor,
                },
              }).finish(),
            );
          });
        }, 50);

        return { setRotation: {} };
      }

      return { error: { message: `Processor not found: ${id}` } };
    }

    if (request.setTempLayerEnabled !== undefined) {
      const { id, enabled } = request.setTempLayerEnabled;
      const processor = this.processors.find((p) => p.id === id);

      if (processor) {
        processor.tempLayerEnabled = enabled;

        // Send notification about the update
        setTimeout(() => {
          console.log("Demo sending updated processor settings:", processor);
          this.callbacks.forEach((cb) => {
            cb(
              Notification.encode({
                processorChanged: {
                  processor,
                },
              }).finish(),
            );
          });
        }, 50);

        return { setTempLayerEnabled: {} };
      }

      return { error: { message: `Processor not found: ${id}` } };
    }

    if (request.setTempLayerLayer !== undefined) {
      const { id, layer } = request.setTempLayerLayer;
      const processor = this.processors.find((p) => p.id === id);

      if (processor) {
        processor.tempLayerLayer = layer;

        // Send notification about the update
        setTimeout(() => {
          console.log("Demo sending updated processor settings:", processor);
          this.callbacks.forEach((cb) => {
            cb(
              Notification.encode({
                processorChanged: {
                  processor,
                },
              }).finish(),
            );
          });
        }, 50);

        return { setTempLayerLayer: {} };
      }

      return { error: { message: `Processor not found: ${id}` } };
    }

    if (request.setTempLayerActivationDelay !== undefined) {
      const { id, activationDelayMs } = request.setTempLayerActivationDelay;
      const processor = this.processors.find((p) => p.id === id);

      if (processor) {
        processor.tempLayerActivationDelayMs = activationDelayMs;

        // Send notification about the update
        setTimeout(() => {
          console.log("Demo sending updated processor settings:", processor);
          this.callbacks.forEach((cb) => {
            cb(
              Notification.encode({
                processorChanged: {
                  processor,
                },
              }).finish(),
            );
          });
        }, 50);

        return { setTempLayerActivationDelay: {} };
      }

      return { error: { message: `Processor not found: ${id}` } };
    }

    if (request.setTempLayerDeactivationDelay !== undefined) {
      const { id, deactivationDelayMs } = request.setTempLayerDeactivationDelay;
      const processor = this.processors.find((p) => p.id === id);

      if (processor) {
        processor.tempLayerDeactivationDelayMs = deactivationDelayMs;

        // Send notification about the update
        setTimeout(() => {
          console.log("Demo sending updated processor settings:", processor);
          this.callbacks.forEach((cb) => {
            cb(
              Notification.encode({
                processorChanged: {
                  processor,
                },
              }).finish(),
            );
          });
        }, 50);

        return { setTempLayerDeactivationDelay: {} };
      }

      return { error: { message: `Processor not found: ${id}` } };
    }

    return { error: { message: "Not implemented" } };
  }

  notify(callback: (data: Uint8Array) => void) {
    this.callbacks.push(callback);
  }
}
