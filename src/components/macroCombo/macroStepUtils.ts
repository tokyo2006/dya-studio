/**
 * Pure helpers for the runtime-macro editor: HID character tables, macro step
 * construction and the string-row grouping used by the step list. Extracted
 * from the former MacroPage so the merged Macro&Combo page can share them.
 */
import { createHidUsage, HID_USAGE_PAGE_KEYBOARD } from "../../lib/keycodes";
import type { BehaviorBinding as KeymapBehaviorBinding } from "../../hooks/useKeymap";
import type {
  MacroDetail,
  MacroStep,
} from "../../proto/cormoran/runtime_macro/runtime_macro";

export type StepAction = "tap" | "down" | "up" | "delay" | "string";

export interface MacroStepRow {
  action: StepAction;
  startIndex: number;
  length: number;
  step?: MacroStep;
  value?: string;
}

export interface StringDraftRow {
  startIndex: number;
  length: number;
  value: string;
}

const DEFAULT_BINDING = { behaviorId: 0, param1: 0, param2: 0 };
export const DEFAULT_STEP: MacroStep = { delay: { delayMs: 0 } };
const LEFT_SHIFT_MODIFIER = 0x02 << 24;
const PACKED_LEFT_SHIFT = 0x80;
const PACKED_USAGE_MASK = 0x7f;
export const STRING_MIN_GROUP_LENGTH = 2;

const CHAR_TO_HID_USAGE = new Map<string, number>([
  ["a", 0x04],
  ["b", 0x05],
  ["c", 0x06],
  ["d", 0x07],
  ["e", 0x08],
  ["f", 0x09],
  ["g", 0x0a],
  ["h", 0x0b],
  ["i", 0x0c],
  ["j", 0x0d],
  ["k", 0x0e],
  ["l", 0x0f],
  ["m", 0x10],
  ["n", 0x11],
  ["o", 0x12],
  ["p", 0x13],
  ["q", 0x14],
  ["r", 0x15],
  ["s", 0x16],
  ["t", 0x17],
  ["u", 0x18],
  ["v", 0x19],
  ["w", 0x1a],
  ["x", 0x1b],
  ["y", 0x1c],
  ["z", 0x1d],
  ["1", 0x1e],
  ["2", 0x1f],
  ["3", 0x20],
  ["4", 0x21],
  ["5", 0x22],
  ["6", 0x23],
  ["7", 0x24],
  ["8", 0x25],
  ["9", 0x26],
  ["0", 0x27],
  ["\n", 0x28],
  ["\t", 0x2b],
  [" ", 0x2c],
  ["-", 0x2d],
  ["=", 0x2e],
  ["[", 0x2f],
  ["]", 0x30],
  ["\\", 0x31],
  [";", 0x33],
  ["'", 0x34],
  ["`", 0x35],
  [",", 0x36],
  [".", 0x37],
  ["/", 0x38],
]);

const SHIFTED_CHAR_TO_HID_USAGE = new Map<string, number>([
  ["!", 0x1e],
  ["@", 0x1f],
  ["#", 0x20],
  ["$", 0x21],
  ["%", 0x22],
  ["^", 0x23],
  ["&", 0x24],
  ["*", 0x25],
  ["(", 0x26],
  [")", 0x27],
  ["_", 0x2d],
  ["+", 0x2e],
  ["{", 0x2f],
  ["}", 0x30],
  ["|", 0x31],
  [":", 0x33],
  ['"', 0x34],
  ["~", 0x35],
  ["<", 0x36],
  [">", 0x37],
  ["?", 0x38],
]);

export const HID_USAGE_TO_CHAR = new Map<number, string>();
for (const [char, usage] of CHAR_TO_HID_USAGE) {
  HID_USAGE_TO_CHAR.set(usage, char);
  HID_USAGE_TO_CHAR.set(createHidUsage(HID_USAGE_PAGE_KEYBOARD, usage), char);
}
for (const [char, usage] of SHIFTED_CHAR_TO_HID_USAGE) {
  HID_USAGE_TO_CHAR.set(LEFT_SHIFT_MODIFIER | usage, char);
  HID_USAGE_TO_CHAR.set(
    LEFT_SHIFT_MODIFIER | createHidUsage(HID_USAGE_PAGE_KEYBOARD, usage),
    char,
  );
}
for (let code = 0x04; code <= 0x1d; code++) {
  const lower = HID_USAGE_TO_CHAR.get(code);
  if (lower) {
    HID_USAGE_TO_CHAR.set(LEFT_SHIFT_MODIFIER | code, lower.toUpperCase());
    HID_USAGE_TO_CHAR.set(
      LEFT_SHIFT_MODIFIER | createHidUsage(HID_USAGE_PAGE_KEYBOARD, code),
      lower.toUpperCase(),
    );
  }
}

export function getStepAction(step: MacroStep): Exclude<StepAction, "string"> {
  if (step.down) return "down";
  if (step.up) return "up";
  if (step.delay) return "delay";
  return "tap";
}

export function getStepBinding(step: MacroStep): KeymapBehaviorBinding | null {
  const binding = step.down ?? step.up ?? step.tap;
  return binding ? { ...binding } : null;
}

export function createStep(
  action: Exclude<StepAction, "string">,
  binding: KeymapBehaviorBinding | null,
  delayMs = 0,
): MacroStep {
  if (action === "delay") {
    return { delay: { delayMs } };
  }

  const nextBinding = binding ?? DEFAULT_BINDING;
  return { [action]: nextBinding };
}

export function formatMacroName(
  macro: MacroDetail | null,
  slot: number,
): string {
  if (macro?.name) return macro.name;
  return `Macro ${slot}`;
}

export function clampUInt32(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(0xffffffff, Math.round(value)));
}

export function getKeyPressBehaviorId(
  behaviors: Map<number, { id: number; displayName: string }>,
): number | null {
  for (const behavior of behaviors.values()) {
    if (["kp", "Key Press", "key_press"].includes(behavior.displayName)) {
      return behavior.id;
    }
  }
  return null;
}

function charToPackedKey(char: string): number | null {
  if (char.length !== 1) return null;
  const lower = char.toLowerCase();
  if (char >= "A" && char <= "Z") {
    const usage = CHAR_TO_HID_USAGE.get(lower);
    return usage === undefined ? null : PACKED_LEFT_SHIFT | usage;
  }
  const direct = CHAR_TO_HID_USAGE.get(char);
  if (direct !== undefined) return direct;
  const shifted = SHIFTED_CHAR_TO_HID_USAGE.get(char);
  return shifted === undefined ? null : PACKED_LEFT_SHIFT | shifted;
}

function packedKeyToChar(packedKey: number): string | null {
  if (!Number.isInteger(packedKey) || packedKey < 0 || packedKey > 0xff) {
    return null;
  }
  const usage = packedKey & PACKED_USAGE_MASK;
  const hidUsage = createHidUsage(HID_USAGE_PAGE_KEYBOARD, usage);
  return (
    HID_USAGE_TO_CHAR.get(
      packedKey & PACKED_LEFT_SHIFT ? LEFT_SHIFT_MODIFIER | hidUsage : hidUsage,
    ) ?? null
  );
}

export function stringToKeyTapSequenceStep(value: string): MacroStep | null {
  const packedKeys: number[] = [];
  for (const char of value) {
    const packedKey = charToPackedKey(char);
    if (packedKey === null) return null;
    packedKeys.push(packedKey);
  }
  return {
    keyTapSequence: {
      packedKeys: Uint8Array.from(packedKeys),
    },
  };
}

export function getKeyTapSequenceString(step: MacroStep): string | null {
  if (!step.keyTapSequence) return null;
  const chars: string[] = [];
  for (const packedKey of step.keyTapSequence.packedKeys) {
    const char = packedKeyToChar(packedKey);
    if (char === null) return null;
    chars.push(char);
  }
  return chars.join("");
}

function getTapCharacter(step: MacroStep, keyPressBehaviorId: number | null) {
  if (!step.tap || keyPressBehaviorId === null) return null;
  if (step.tap.behaviorId !== keyPressBehaviorId || step.tap.param2 !== 0) {
    return null;
  }
  return HID_USAGE_TO_CHAR.get(step.tap.param1) ?? null;
}

function hasValidBinding(step: MacroStep): boolean {
  const binding = getStepBinding(step);
  return !binding || binding.behaviorId !== 0;
}

export function canCommitSteps(steps: MacroStep[]): boolean {
  return steps.every(hasValidBinding);
}

export function buildMacroStepRows(
  steps: MacroStep[],
  keyPressBehaviorId: number | null,
  stringDraft: StringDraftRow | null,
): MacroStepRow[] {
  const rows: MacroStepRow[] = [];
  let index = 0;
  let insertedDraft = false;

  while (
    index < steps.length ||
    (!insertedDraft &&
      stringDraft !== null &&
      stringDraft.startIndex <= steps.length)
  ) {
    if (
      stringDraft !== null &&
      !insertedDraft &&
      index === stringDraft.startIndex
    ) {
      rows.push({
        action: "string",
        startIndex: stringDraft.startIndex,
        length: stringDraft.length,
        value: stringDraft.value,
      });
      insertedDraft = true;
      if (stringDraft.length > 0) {
        index += stringDraft.length;
        continue;
      }
    }

    if (index >= steps.length) break;

    const keyTapSequenceString = getKeyTapSequenceString(steps[index]);
    if (keyTapSequenceString !== null) {
      rows.push({
        action: "string",
        startIndex: index,
        length: 1,
        value: keyTapSequenceString,
      });
      index++;
      continue;
    }

    const chars: string[] = [];
    let endIndex = index;
    while (endIndex < steps.length) {
      if (
        stringDraft !== null &&
        !insertedDraft &&
        endIndex === stringDraft.startIndex
      ) {
        break;
      }
      const char = getTapCharacter(steps[endIndex], keyPressBehaviorId);
      if (char === null) break;
      chars.push(char);
      endIndex++;
    }

    if (chars.length >= STRING_MIN_GROUP_LENGTH) {
      rows.push({
        action: "string",
        startIndex: index,
        length: chars.length,
        value: chars.join(""),
      });
      index = endIndex;
      continue;
    }

    rows.push({
      action: getStepAction(steps[index]),
      startIndex: index,
      length: 1,
      step: steps[index],
    });
    index++;
  }

  return rows;
}
