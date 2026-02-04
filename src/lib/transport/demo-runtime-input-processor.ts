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
    name: "trackpad",
    scaleMultiplier: 1,
    scaleDivisor: 1,
    rotationDegrees: 0,
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
                processorSettings: {
                  processor,
                },
              }).finish(),
            );
          });
        });
      }, 100);

      return { listProcessors: { processors: this.processors } };
    }

    if (request.getProcessor !== undefined) {
      const { name } = request.getProcessor;
      const processor = this.processors.find((p) => p.name === name);

      if (processor) {
        return { getProcessor: { processor } };
      }

      return { error: { message: `Processor not found: ${name}` } };
    }

    if (request.setScaling !== undefined) {
      const { name, scaleMultiplier, scaleDivisor } = request.setScaling;
      const processor = this.processors.find((p) => p.name === name);

      if (processor) {
        processor.scaleMultiplier = scaleMultiplier;
        processor.scaleDivisor = scaleDivisor;

        // Send notification about the update
        setTimeout(() => {
          console.log("Demo sending updated processor settings:", processor);
          this.callbacks.forEach((cb) => {
            cb(
              Notification.encode({
                processorSettings: {
                  processor,
                },
              }).finish(),
            );
          });
        }, 50);

        return { setScaling: { success: true } };
      }

      return { setScaling: { success: false } };
    }

    if (request.setRotation !== undefined) {
      const { name, rotationDegrees } = request.setRotation;
      const processor = this.processors.find((p) => p.name === name);

      if (processor) {
        processor.rotationDegrees = rotationDegrees;

        // Send notification about the update
        setTimeout(() => {
          console.log("Demo sending updated processor settings:", processor);
          this.callbacks.forEach((cb) => {
            cb(
              Notification.encode({
                processorSettings: {
                  processor,
                },
              }).finish(),
            );
          });
        }, 50);

        return { setRotation: { success: true } };
      }

      return { setRotation: { success: false } };
    }

    return { error: { message: "Not implemented" } };
  }

  notify(callback: (data: Uint8Array) => void) {
    this.callbacks.push(callback);
  }
}
