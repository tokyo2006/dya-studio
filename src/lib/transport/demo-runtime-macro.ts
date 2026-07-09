/**
 * Demo Runtime Macro Custom Subsystem Handler
 *
 * Provides mock runtime macros for demo mode. Macros are modeled as a
 * variable list of named entries (not fixed slots): creation/deletion/rename
 * of the macro identity is driven by the "macro/" keyspace in
 * demo-custom-settings.ts (mirroring firmware, where raw create/delete/
 * rename go through the generic custom-settings CreateSetting/DeleteSetting
 * RPC). This handler owns the actual step data and global settings, and
 * assigns/reclaims slots as keyspace entries come and go.
 */

import {
  type MacroDetail,
  type MacroGlobalSettings,
  type MacroStep,
  type MacroSummary,
  type Request,
  type Response,
} from "../../proto/cormoran/runtime_macro/runtime_macro";
import { getRuntimeMacroEncodedSize } from "../runtimeMacroCodec";
import {
  CustomSettingsHandler,
  MACRO_KEYSPACE_PREFIX,
} from "./demo-custom-settings";

export const RUNTIME_MACRO_IDENTIFIER = "cormoran__runtime_macro";

const BEHAVIOR_KEY_PRESS = 10;
const MAX_ENTRIES = 8;
const MAX_MACRO_BYTES = 64;
const MAX_NAME_LENGTH = 64;
const POOL_BYTES_TOTAL = 1024;

const MOCK_GLOBAL_SETTINGS: MacroGlobalSettings = {
  tapMs: 30,
  maxEntries: MAX_ENTRIES,
  keyPressBehaviorId: BEHAVIOR_KEY_PRESS,
  poolBytesTotal: POOL_BYTES_TOTAL,
  poolBytesUsed: 0,
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

function cloneMacro(macro: MacroDetail): MacroDetail {
  return {
    ...macro,
    steps: macro.steps.map(cloneStep),
  };
}

function createMacro(
  slot: number,
  name = "",
  steps: MacroStep[] = [],
): MacroDetail {
  return {
    slot,
    name,
    steps,
    encodedSize: steps.length === 0 ? 0 : getRuntimeMacroEncodedSize(steps),
  };
}

function macroSummary(macro: MacroDetail): MacroSummary {
  return {
    slot: macro.slot,
    name: macro.name,
    encodedSize: macro.encodedSize,
  };
}

const SEED_MACROS: MacroDetail[] = [
  createMacro(0, "Hello", [
    createTapStep(0x0b),
    createTapStep(0x08),
    createTapStep(0x0f),
    createTapStep(0x0f),
    createTapStep(0x12),
  ]),
  createMacro(1, "Wait Enter", [createDelayStep(100), createTapStep(0x28)]),
];

export class RuntimeMacroHandler {
  private readonly customSettings: CustomSettingsHandler;
  private persistentMacros: MacroDetail[];
  private macros: MacroDetail[];
  private persistentGlobalSettings: MacroGlobalSettings = {
    ...MOCK_GLOBAL_SETTINGS,
  };
  private globalSettings: MacroGlobalSettings = { ...MOCK_GLOBAL_SETTINGS };
  private pendingChanges = false;
  private nextSlot = SEED_MACROS.length;

  constructor(customSettings?: CustomSettingsHandler) {
    // Fall back to an owned instance so this handler stays constructible on
    // its own (e.g. in unit tests), while demo.ts wires the app's shared
    // CustomSettingsHandler through for real coordination.
    this.customSettings = customSettings ?? new CustomSettingsHandler(0);
    this.macros = SEED_MACROS.map(cloneMacro);
    this.persistentMacros = SEED_MACROS.map(cloneMacro);
    this.refreshPoolUsage();

    // Seed the custom-settings "macro/" keyspace with entries for the mock
    // macros so create/delete/rename (routed through CreateSetting/
    // DeleteSetting) can find them by name from the start.
    for (const macro of this.macros) {
      this.customSettings.seedKeyspaceEntry(
        MACRO_KEYSPACE_PREFIX + macro.name,
        { bytesValue: Uint8Array.from([1]) },
      );
    }

    this.customSettings.onKeyspaceChange(() => this.syncFromKeyspace());
  }

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
      const macro = this.macros.find(
        (candidate) => candidate.slot === request.getMacro?.slot,
      );
      if (!macro) {
        return {
          error: { message: `Macro not found: ${request.getMacro.slot}` },
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

    if (request.setMacroStepCount !== undefined) {
      const { slot, stepCount, persist } = request.setMacroStepCount;
      const macro = this.macros.find((candidate) => candidate.slot === slot);
      if (!macro) {
        return { error: { message: `Macro not found: ${slot}` } };
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
      const { slot, stepIndex, step, persist } = request.setMacroStep;
      const macro = this.macros.find((candidate) => candidate.slot === slot);
      if (!macro) {
        return { error: { message: `Macro not found: ${slot}` } };
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

    if (request.appendMacroStep !== undefined) {
      const { slot, step, persist } = request.appendMacroStep;
      const macro = this.macros.find((candidate) => candidate.slot === slot);
      if (!macro) {
        return { error: { message: `Macro not found: ${slot}` } };
      }
      if (!step) {
        return { error: { message: "Invalid macro step" } };
      }
      macro.steps.push(cloneStep(step));
      const error = this.refreshEncodedSize(macro);
      if (error) return error;
      this.markChanged(persist);
      return { status: { affectedCount: 1, message: "Macro step appended" } };
    }

    if (request.createMacro !== undefined) {
      const { name, persist } = request.createMacro;
      if (this.macros.some((m) => m.name === name)) {
        return { error: { message: `Macro already exists: ${name}` } };
      }
      this.macros.push(createMacro(this.nextSlot++, name));
      this.refreshPoolUsage();
      this.markChanged(persist);
      return { status: { affectedCount: 1, message: "Macro created" } };
    }

    if (request.deleteMacro !== undefined) {
      const { name } = request.deleteMacro;
      const index = this.macros.findIndex((m) => m.name === name);
      if (index === -1) {
        return { error: { message: `Macro not found: ${name}` } };
      }
      this.macros.splice(index, 1);
      this.refreshPoolUsage();
      this.markChanged(false);
      return { status: { affectedCount: 1, message: "Macro deleted" } };
    }

    if (request.renameMacro !== undefined) {
      const { oldName, newName, persist } = request.renameMacro;
      const macro = this.macros.find((m) => m.name === oldName);
      if (!macro) {
        return { error: { message: `Macro not found: ${oldName}` } };
      }
      if (this.macros.some((m) => m.name === newName)) {
        return {
          error: { message: `Macro already exists: ${newName}` },
        };
      }
      macro.name = newName;
      this.markChanged(persist);
      return { status: { affectedCount: 1, message: "Macro renamed" } };
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
      this.refreshPoolUsage();
      return {
        status: {
          affectedCount,
          message: "Runtime macro settings discarded",
        },
      };
    }

    return { error: { message: "Not implemented" } };
  }

  // Reconciles this handler's macro list with the custom-settings "macro/"
  // keyspace after a CreateSetting/DeleteSetting call: new keys become new
  // (empty) macro slots, and keys that disappeared remove their macro.
  private syncFromKeyspace() {
    const entries = this.customSettings.keyspaceEntries(MACRO_KEYSPACE_PREFIX);
    const namesInKeyspace = new Set(
      entries.map((entry) => entry.key.slice(MACRO_KEYSPACE_PREFIX.length)),
    );

    // Remove macros whose keyspace entry is gone (deleted).
    this.macros = this.macros.filter((macro) =>
      namesInKeyspace.has(macro.name),
    );

    // Add a new (empty) macro for any keyspace entry with no matching macro
    // yet (created).
    for (const name of namesInKeyspace) {
      if (!this.macros.some((macro) => macro.name === name)) {
        this.macros.push(createMacro(this.nextSlot++, name));
      }
    }

    this.pendingChanges = true;
    this.refreshPoolUsage();
  }

  private markChanged(persist: boolean) {
    if (persist) {
      this.persistentMacros = this.macros.map(cloneMacro);
      this.persistentGlobalSettings = { ...this.globalSettings };
      this.pendingChanges = false;
    } else {
      this.pendingChanges = true;
    }
    this.refreshPoolUsage();
  }

  private refreshEncodedSize(macro: MacroDetail): Response | null {
    const encodedSize =
      macro.steps.length === 0 ? 0 : getRuntimeMacroEncodedSize(macro.steps);
    if (encodedSize > MAX_MACRO_BYTES) {
      return { error: { message: "Macro exceeds encoded byte limit" } };
    }
    macro.encodedSize = encodedSize;
    return null;
  }

  private refreshPoolUsage() {
    const used = this.macros.reduce(
      (total, macro) => total + macro.encodedSize + macro.name.length,
      0,
    );
    this.globalSettings.poolBytesUsed = Math.min(
      used,
      this.globalSettings.poolBytesTotal,
    );
  }
}
