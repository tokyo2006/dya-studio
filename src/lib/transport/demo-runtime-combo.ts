/**
 * Demo Runtime Combo Custom Subsystem Handler
 *
 * Provides mock runtime combo data for demo mode.
 */

import {
  ComboSource,
  SlowReleaseOverride,
  type BehaviorBinding,
  type Combo,
  type GlobalSettings,
  type Request,
  type Response,
} from "../../proto/cormoran/runtime_combo/runtime_combo";

export const RUNTIME_COMBO_IDENTIFIER = "cormoran__runtime_combo";

const BEHAVIOR_KEY_PRESS = 10;

function createBehavior(
  behaviorId: number,
  param1: number,
  param2 = 0,
): BehaviorBinding {
  return { behaviorId, param1, param2 };
}

// Compile-time defaults for the demo keyboard. These define which slots have a
// default to reset back to (DEFAULT_SLOT_INDICES below).
const MOCK_COMBOS: Combo[] = [
  {
    index: 0,
    name: "Escape chord",
    keyPositions: [0, 1],
    behavior: createBehavior(BEHAVIOR_KEY_PRESS, 0x29),
    layerMask: 0,
    enabled: true,
    timeoutMs: 0,
    requirePriorIdleMs: 0,
    slowReleaseOverride: SlowReleaseOverride.SLOW_RELEASE_OVERRIDE_INHERIT,
    source: ComboSource.COMBO_SOURCE_DEFAULT,
  },
  {
    index: 1,
    name: "Tab chord",
    keyPositions: [2, 3],
    behavior: createBehavior(BEHAVIOR_KEY_PRESS, 0x2b),
    layerMask: 1,
    enabled: true,
    timeoutMs: 0,
    requirePriorIdleMs: 0,
    slowReleaseOverride: SlowReleaseOverride.SLOW_RELEASE_OVERRIDE_INHERIT,
    source: ComboSource.COMBO_SOURCE_DEFAULT,
  },
];

// The combos actually persisted on the demo keyboard at boot. Slot 0 is a
// compile-time default that has been overridden (blue), slot 1 is the untouched
// default, and slot 2 is a runtime-only combo with no compile-time default
// (also blue). This gives the UI both DEFAULT and OVERRIDDEN/RUNTIME sources so
// the blue "changed from default" dot is visible without any user action.
const INITIAL_COMBOS: Combo[] = [
  {
    index: 0,
    name: "Escape chord",
    keyPositions: [0, 1],
    behavior: createBehavior(BEHAVIOR_KEY_PRESS, 0x29),
    layerMask: 0,
    enabled: true,
    timeoutMs: 120,
    requirePriorIdleMs: 0,
    slowReleaseOverride: SlowReleaseOverride.SLOW_RELEASE_OVERRIDE_INHERIT,
    source: ComboSource.COMBO_SOURCE_OVERRIDDEN,
  },
  {
    index: 1,
    name: "Tab chord",
    keyPositions: [2, 3],
    behavior: createBehavior(BEHAVIOR_KEY_PRESS, 0x2b),
    layerMask: 1,
    enabled: true,
    timeoutMs: 0,
    requirePriorIdleMs: 0,
    slowReleaseOverride: SlowReleaseOverride.SLOW_RELEASE_OVERRIDE_INHERIT,
    source: ComboSource.COMBO_SOURCE_DEFAULT,
  },
  {
    index: 2,
    name: "Copy chord",
    keyPositions: [4, 5],
    behavior: createBehavior(BEHAVIOR_KEY_PRESS, 0x06),
    layerMask: 0,
    enabled: true,
    timeoutMs: 0,
    requirePriorIdleMs: 0,
    slowReleaseOverride: SlowReleaseOverride.SLOW_RELEASE_OVERRIDE_INHERIT,
    source: ComboSource.COMBO_SOURCE_RUNTIME,
  },
];

const MOCK_GLOBAL_SETTINGS: GlobalSettings = {
  timeoutMs: 50,
  slowRelease: false,
  maxCombo: 16,
  requirePriorIdleMs: 0,
};

/** Slots that exist as compile-time defaults (i.e. seeded in MOCK_COMBOS). */
const DEFAULT_SLOT_INDICES = new Set(MOCK_COMBOS.map((combo) => combo.index));

function cloneCombo(combo: Combo): Combo {
  return {
    ...combo,
    keyPositions: [...combo.keyPositions],
    behavior: combo.behavior ? { ...combo.behavior } : undefined,
  };
}

export class RuntimeComboHandler {
  private persistentCombos: Combo[] = INITIAL_COMBOS.map(cloneCombo);
  private combos: Combo[] = INITIAL_COMBOS.map(cloneCombo);
  private persistentGlobalSettings: GlobalSettings = {
    ...MOCK_GLOBAL_SETTINGS,
  };
  private globalSettings: GlobalSettings = { ...MOCK_GLOBAL_SETTINGS };
  private pendingChanges = false;

  process(request: Request): Response {
    if (request.listCombos !== undefined) {
      return {
        listCombos: {
          combos: this.combos.map(cloneCombo),
        },
      };
    }

    if (request.getCombo !== undefined) {
      const combo = this.combos.find(
        (item) => item.index === request.getCombo?.index,
      );
      if (!combo) {
        return {
          error: { message: `Combo not found: ${request.getCombo.index}` },
        };
      }
      return { getCombo: { combo: cloneCombo(combo) } };
    }

    if (request.setCombo !== undefined) {
      const {
        index,
        keyPositions,
        behavior,
        layerMask,
        enabled,
        persist,
        timeoutMs,
        requirePriorIdleMs,
        slowReleaseOverride,
      } = request.setCombo;
      if (index >= this.globalSettings.maxCombo) {
        return { error: { message: `Invalid combo slot: ${index}` } };
      }
      if (keyPositions.length < 2 || !behavior) {
        return { error: { message: "Combo requires positions and behavior" } };
      }

      const current = this.combos.find((item) => item.index === index);
      const hasCompileTimeDefault = DEFAULT_SLOT_INDICES.has(index);
      const nextCombo: Combo = {
        index,
        name: current?.name ?? "",
        keyPositions: [...keyPositions],
        behavior: { ...behavior },
        layerMask,
        enabled,
        timeoutMs,
        requirePriorIdleMs,
        slowReleaseOverride,
        source: hasCompileTimeDefault
          ? ComboSource.COMBO_SOURCE_OVERRIDDEN
          : ComboSource.COMBO_SOURCE_RUNTIME,
      };
      this.combos = [
        ...this.combos.filter((item) => item.index !== index),
        nextCombo,
      ].sort((a, b) => a.index - b.index);

      if (persist) {
        this.persistentCombos = this.combos.map(cloneCombo);
      } else {
        this.pendingChanges = true;
      }
      return { status: { affectedCount: 1, message: "Combo written" } };
    }

    if (request.setComboName !== undefined) {
      const { index, name, persist } = request.setComboName;
      const combo = this.combos.find((item) => item.index === index);
      if (!combo) {
        return { error: { message: `Combo not found: ${index}` } };
      }
      combo.name = name;
      if (persist) {
        this.persistentCombos = this.combos.map(cloneCombo);
      } else {
        this.pendingChanges = true;
      }
      return { status: { affectedCount: 1, message: "Combo name written" } };
    }

    if (request.deleteCombo !== undefined) {
      const { index, persist } = request.deleteCombo;
      const before = this.combos.length;
      // Deleting removes any stored runtime value for this slot, which is
      // conceptually source = COMBO_SOURCE_EMPTY; represented here by
      // filtering the combo out of the in-memory list entirely.
      this.combos = this.combos.filter((item) => item.index !== index);
      if (persist) {
        this.persistentCombos = this.combos.map(cloneCombo);
      } else {
        this.pendingChanges = true;
      }
      return {
        status: {
          affectedCount: before === this.combos.length ? 0 : 1,
          message: "Combo disabled",
        },
      };
    }

    if (request.resetCombo !== undefined) {
      const { index } = request.resetCombo;
      const defaultCombo = MOCK_COMBOS.find((item) => item.index === index);
      if (defaultCombo) {
        this.combos = [
          ...this.combos.filter((item) => item.index !== index),
          {
            ...cloneCombo(defaultCombo),
            source: ComboSource.COMBO_SOURCE_DEFAULT,
          },
        ].sort((a, b) => a.index - b.index);
      } else {
        this.combos = this.combos.filter((item) => item.index !== index);
      }
      this.pendingChanges = true;
      return {
        status: { affectedCount: 1, message: "Combo reset to default" },
      };
    }

    if (request.getGlobalSettings !== undefined) {
      return { getGlobalSettings: { settings: { ...this.globalSettings } } };
    }

    if (request.setTimeoutMs !== undefined) {
      const { timeoutMs, persist } = request.setTimeoutMs;
      if (timeoutMs === 0 || timeoutMs > 65535) {
        return { error: { message: "Invalid timeout" } };
      }
      this.globalSettings.timeoutMs = timeoutMs;
      if (persist) {
        this.persistentGlobalSettings = { ...this.globalSettings };
      } else {
        this.pendingChanges = true;
      }
      return {
        status: {
          affectedCount: 1,
          message: "Runtime combo timeout written",
        },
      };
    }

    if (request.setSlowRelease !== undefined) {
      const { slowRelease, persist } = request.setSlowRelease;
      this.globalSettings.slowRelease = slowRelease;
      if (persist) {
        this.persistentGlobalSettings = { ...this.globalSettings };
      } else {
        this.pendingChanges = true;
      }
      return {
        status: {
          affectedCount: 1,
          message: "Runtime combo slow release written",
        },
      };
    }

    if (request.setRequirePriorIdleMs !== undefined) {
      const { requirePriorIdleMs, persist } = request.setRequirePriorIdleMs;
      if (requirePriorIdleMs < 0 || requirePriorIdleMs > 65535) {
        return { error: { message: "Invalid require-prior-idle duration" } };
      }
      this.globalSettings.requirePriorIdleMs = requirePriorIdleMs;
      if (persist) {
        this.persistentGlobalSettings = { ...this.globalSettings };
      } else {
        this.pendingChanges = true;
      }
      return {
        status: {
          affectedCount: 1,
          message: "Runtime combo require-prior-idle written",
        },
      };
    }

    if (request.save !== undefined) {
      const affectedCount = this.pendingChanges ? 1 : 0;
      this.persistentCombos = this.combos.map(cloneCombo);
      this.persistentGlobalSettings = { ...this.globalSettings };
      this.pendingChanges = false;
      return {
        status: {
          affectedCount,
          message: "Runtime combo settings saved",
        },
      };
    }

    if (request.discard !== undefined) {
      const affectedCount = this.pendingChanges ? 1 : 0;
      this.combos = this.persistentCombos.map(cloneCombo);
      this.globalSettings = { ...this.persistentGlobalSettings };
      this.pendingChanges = false;
      return {
        status: {
          affectedCount,
          message: "Runtime combo settings discarded",
        },
      };
    }

    return { error: { message: "Not implemented" } };
  }
}
