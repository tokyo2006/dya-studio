/**
 * Demo Runtime Combo Custom Subsystem Handler
 *
 * Provides mock runtime combo data for demo mode.
 */

import {
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

const MOCK_COMBOS: Combo[] = [
  {
    index: 0,
    name: "Escape chord",
    keyPositions: [0, 1],
    behavior: createBehavior(BEHAVIOR_KEY_PRESS, 0x29),
    layerMask: 0,
    enabled: true,
  },
  {
    index: 1,
    name: "Tab chord",
    keyPositions: [2, 3],
    behavior: createBehavior(BEHAVIOR_KEY_PRESS, 0x2b),
    layerMask: 1,
    enabled: true,
  },
];

const MOCK_GLOBAL_SETTINGS: GlobalSettings = {
  timeoutMs: 50,
  slowRelease: false,
  maxCombo: 16,
};

function cloneCombo(combo: Combo): Combo {
  return {
    ...combo,
    keyPositions: [...combo.keyPositions],
    behavior: combo.behavior ? { ...combo.behavior } : undefined,
  };
}

export class RuntimeComboHandler {
  private persistentCombos: Combo[] = MOCK_COMBOS.map(cloneCombo);
  private combos: Combo[] = MOCK_COMBOS.map(cloneCombo);
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
      const { index, keyPositions, behavior, layerMask, enabled, persist } =
        request.setCombo;
      if (index >= this.globalSettings.maxCombo) {
        return { error: { message: `Invalid combo slot: ${index}` } };
      }
      if (keyPositions.length < 2 || !behavior) {
        return { error: { message: "Combo requires positions and behavior" } };
      }

      const current = this.combos.find((item) => item.index === index);
      const nextCombo: Combo = {
        index,
        name: current?.name ?? "",
        keyPositions: [...keyPositions],
        behavior: { ...behavior },
        layerMask,
        enabled,
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
