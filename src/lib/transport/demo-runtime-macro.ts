/**
 * Demo Runtime Macro Custom Subsystem Handler
 *
 * Provides mock runtime macro slots for demo mode.
 */

import {
  type MacroGlobalSettings,
  type MacroSlot,
  type MacroStep,
  type MacroSummary,
  type Request,
  type Response,
} from "../../proto/cormoran/runtime_macro/runtime_macro";
import { getRuntimeMacroEncodedSize } from "../runtimeMacroCodec";

export const RUNTIME_MACRO_IDENTIFIER = "cormoran__runtime_macro";

const BEHAVIOR_KEY_PRESS = 10;
const MAX_MACRO = 8;
const MAX_MACRO_BYTES = 64;
const MAX_NAME_LENGTH = 64;

const MOCK_GLOBAL_SETTINGS: MacroGlobalSettings = {
  tapMs: 30,
  maxMacro: MAX_MACRO,
  keyPressBehaviorId: BEHAVIOR_KEY_PRESS,
};

function createTapStep(param1: number): MacroStep {
  return {
    tap: {
      behaviorId: BEHAVIOR_KEY_PRESS,
      param1,
      param2: 0,
    },
  };
}

function createDelayStep(delayMs: number): MacroStep {
  return { delay: { delayMs } };
}

function cloneStep(step: MacroStep): MacroStep {
  if (step.down) return { down: { ...step.down } };
  if (step.up) return { up: { ...step.up } };
  if (step.delay) return { delay: { ...step.delay } };
  if (step.keyTapSequence) {
    return {
      keyTapSequence: {
        packedKeys: new Uint8Array(step.keyTapSequence.packedKeys),
      },
    };
  }
  return { tap: { ...(step.tap ?? { behaviorId: 0, param1: 0, param2: 0 }) } };
}

function cloneMacro(macro: MacroSlot): MacroSlot {
  return {
    ...macro,
    steps: macro.steps.map(cloneStep),
  };
}

function createMacro(index: number, name = "", steps: MacroStep[] = []) {
  return {
    index,
    name,
    steps,
    encodedSize: steps.length === 0 ? 0 : getRuntimeMacroEncodedSize(steps),
  };
}

function macroSummary(macro: MacroSlot): MacroSummary {
  return {
    index: macro.index,
    name: macro.name,
    encodedSize: macro.encodedSize,
  };
}

const MOCK_MACROS: MacroSlot[] = Array.from({ length: MAX_MACRO }, (_, index) =>
  createMacro(index),
);
MOCK_MACROS[0] = createMacro(0, "Hello", [
  createTapStep(0x0b),
  createTapStep(0x08),
  createTapStep(0x0f),
  createTapStep(0x0f),
  createTapStep(0x12),
]);
MOCK_MACROS[1] = createMacro(1, "Wait Enter", [
  createDelayStep(100),
  createTapStep(0x28),
]);

export class RuntimeMacroHandler {
  private persistentMacros: MacroSlot[] = MOCK_MACROS.map(cloneMacro);
  private macros: MacroSlot[] = MOCK_MACROS.map(cloneMacro);
  private persistentGlobalSettings: MacroGlobalSettings = {
    ...MOCK_GLOBAL_SETTINGS,
  };
  private globalSettings: MacroGlobalSettings = { ...MOCK_GLOBAL_SETTINGS };
  private pendingChanges = false;

  process(request: Request): Response {
    if (request.listMacros !== undefined) {
      return {
        listMacros: {
          macros: this.macros.map(macroSummary),
          maxMacroBytes: MAX_MACRO_BYTES,
          maxNameLength: MAX_NAME_LENGTH,
        },
      };
    }

    if (request.getMacro !== undefined) {
      const macro = this.macros[request.getMacro.index];
      if (!macro) {
        return {
          error: { message: `Macro not found: ${request.getMacro.index}` },
        };
      }
      return { getMacro: { macro: cloneMacro(macro) } };
    }

    if (request.getMacroGlobalSettings !== undefined) {
      return {
        getMacroGlobalSettings: {
          settings: { ...this.globalSettings },
        },
      };
    }

    if (request.setTapMs !== undefined) {
      const { tapMs, persist } = request.setTapMs;
      if (tapMs > 10000) {
        return { error: { message: "Invalid tap_ms" } };
      }
      this.globalSettings.tapMs = tapMs;
      this.markChanged(persist);
      return { status: { affectedCount: 1, message: "Tap time updated" } };
    }

    if (request.setMacroName !== undefined) {
      const { index, name, persist } = request.setMacroName;
      const macro = this.macros[index];
      if (!macro) {
        return { error: { message: `Macro not found: ${index}` } };
      }
      macro.name = name.slice(0, MAX_NAME_LENGTH);
      this.refreshEncodedSize(macro);
      this.markChanged(persist);
      return { status: { affectedCount: 1, message: "Macro name updated" } };
    }

    if (request.setMacroStepCount !== undefined) {
      const { index, stepCount, persist } = request.setMacroStepCount;
      const macro = this.macros[index];
      if (!macro) {
        return { error: { message: `Macro not found: ${index}` } };
      }
      if (stepCount > 32) {
        return { error: { message: "Too many macro steps" } };
      }
      while (macro.steps.length < stepCount) {
        macro.steps.push(createDelayStep(0));
      }
      macro.steps = macro.steps.slice(0, stepCount);
      const error = this.refreshEncodedSize(macro);
      if (error) return error;
      this.markChanged(persist);
      return { status: { affectedCount: 1, message: "Step count updated" } };
    }

    if (request.setMacroStep !== undefined) {
      const { index, stepIndex, step, persist } = request.setMacroStep;
      const macro = this.macros[index];
      if (!macro) {
        return { error: { message: `Macro not found: ${index}` } };
      }
      if (!step || stepIndex >= macro.steps.length) {
        return { error: { message: "Invalid macro step" } };
      }
      macro.steps[stepIndex] = cloneStep(step);
      const error = this.refreshEncodedSize(macro);
      if (error) return error;
      this.markChanged(persist);
      return { status: { affectedCount: 1, message: "Macro step updated" } };
    }

    if (request.deleteMacro !== undefined) {
      const { index, persist } = request.deleteMacro;
      const macro = this.macros[index];
      if (!macro) {
        return { error: { message: `Macro not found: ${index}` } };
      }
      macro.name = "";
      macro.steps = [];
      macro.encodedSize = 0;
      this.markChanged(persist);
      return { status: { affectedCount: 1, message: "Macro deleted" } };
    }

    if (request.saveMacros !== undefined) {
      const affectedCount = this.pendingChanges ? 1 : 0;
      this.persistentMacros = this.macros.map(cloneMacro);
      this.persistentGlobalSettings = { ...this.globalSettings };
      this.pendingChanges = false;
      return {
        status: {
          affectedCount,
          message: "Runtime macro settings saved",
        },
      };
    }

    if (request.discardMacros !== undefined) {
      const affectedCount = this.pendingChanges ? 1 : 0;
      this.macros = this.persistentMacros.map(cloneMacro);
      this.globalSettings = { ...this.persistentGlobalSettings };
      this.pendingChanges = false;
      return {
        status: {
          affectedCount,
          message: "Runtime macro settings discarded",
        },
      };
    }

    return { error: { message: "Not implemented" } };
  }

  private markChanged(persist: boolean) {
    if (persist) {
      this.persistentMacros = this.macros.map(cloneMacro);
      this.persistentGlobalSettings = { ...this.globalSettings };
      this.pendingChanges = false;
    } else {
      this.pendingChanges = true;
    }
  }

  private refreshEncodedSize(macro: MacroSlot): Response | null {
    const encodedSize =
      macro.steps.length === 0 ? 0 : getRuntimeMacroEncodedSize(macro.steps);
    if (encodedSize > MAX_MACRO_BYTES) {
      return { error: { message: "Macro exceeds encoded byte limit" } };
    }
    macro.encodedSize = encodedSize;
    return null;
  }
}
