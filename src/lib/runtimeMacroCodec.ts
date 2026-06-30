import type { MacroStep } from "../proto/cormoran/runtime_macro/runtime_macro";

export const RUNTIME_MACRO_FORMAT_VERSION = 1;

const OPCODE_DOWN = 1;
const OPCODE_UP = 2;
const OPCODE_TAP = 3;
const OPCODE_DELAY = 4;
const OPCODE_KEY_TAP_SEQUENCE = 5;

function assertUint32(value: number, label: string): number {
  if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) {
    throw new Error(`${label} must be an unsigned 32-bit integer`);
  }
  return value;
}

function writeUvar(bytes: number[], value: number, label: string) {
  let remaining = assertUint32(value, label);
  do {
    let byte = remaining & 0x7f;
    remaining >>>= 7;
    if (remaining !== 0) byte |= 0x80;
    bytes.push(byte);
  } while (remaining !== 0);
}

export function encodeRuntimeMacroSteps(steps: MacroStep[]): Uint8Array {
  const bytes = [RUNTIME_MACRO_FORMAT_VERSION];

  for (const [index, step] of steps.entries()) {
    if (step.delay) {
      bytes.push(OPCODE_DELAY);
      writeUvar(bytes, step.delay.delayMs, `steps[${index}].delayMs`);
      continue;
    }

    if (step.keyTapSequence) {
      bytes.push(OPCODE_KEY_TAP_SEQUENCE);
      const packedKeys = step.keyTapSequence.packedKeys;
      writeUvar(bytes, packedKeys.length, `steps[${index}].packedKeys.length`);
      bytes.push(...packedKeys);
      continue;
    }

    const opcode = step.down
      ? OPCODE_DOWN
      : step.up
        ? OPCODE_UP
        : step.tap
          ? OPCODE_TAP
          : null;
    const binding = step.down ?? step.up ?? step.tap;

    if (opcode === null || !binding) {
      throw new Error(`Macro step ${index + 1} is empty`);
    }

    bytes.push(opcode);
    writeUvar(bytes, binding.behaviorId, `steps[${index}].behaviorId`);
    writeUvar(bytes, binding.param1, `steps[${index}].param1`);
    writeUvar(bytes, binding.param2, `steps[${index}].param2`);
  }

  return Uint8Array.from(bytes);
}

export function getRuntimeMacroEncodedSize(steps: MacroStep[]): number {
  return encodeRuntimeMacroSteps(steps).length;
}
