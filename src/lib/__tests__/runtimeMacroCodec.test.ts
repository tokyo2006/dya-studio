import {
  encodeRuntimeMacroSteps,
  getRuntimeMacroEncodedSize,
} from "../runtimeMacroCodec";
import type { MacroStep } from "../../proto/cormoran/runtime_macro/runtime_macro";

describe("runtimeMacroCodec", () => {
  it("encodes empty macros as the current format version byte", () => {
    expect(getRuntimeMacroEncodedSize([])).toBe(1);
  });

  it("counts behavior and delay steps using runtime macro varints", () => {
    const steps: MacroStep[] = [
      {
        tap: {
          behaviorId: 10,
          param1: 0x04,
          param2: 0,
        },
      },
      {
        delay: {
          delayMs: 150,
        },
      },
    ];

    expect(getRuntimeMacroEncodedSize(steps)).toBe(8);
  });

  it("encodes key tap sequence steps using packed HID keys", () => {
    const steps: MacroStep[] = [
      {
        keyTapSequence: {
          packedKeys: Uint8Array.from([0x04, 0x80 | 0x05]),
        },
      },
    ];

    expect(Array.from(encodeRuntimeMacroSteps(steps))).toEqual([
      1, 5, 2, 0x04, 0x85,
    ]);
    expect(getRuntimeMacroEncodedSize(steps)).toBe(5);
  });

  it("rejects malformed empty steps", () => {
    expect(() => getRuntimeMacroEncodedSize([{}])).toThrow(
      "Macro step 1 is empty",
    );
  });
});
