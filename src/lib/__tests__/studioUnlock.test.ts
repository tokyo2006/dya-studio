import { MetaError } from "@zmkfirmware/zmk-studio-ts-client";
import { ErrorConditions } from "@zmkfirmware/zmk-studio-ts-client/meta";
import {
  KeymapUnlockRequiredError,
  StudioUnlockCancelledError,
  isKeymapUnlockRequired,
  isStudioUnlockError,
} from "../studioUnlock";

describe("isStudioUnlockError", () => {
  it("is true for a thrown UNLOCK_REQUIRED MetaError", () => {
    expect(
      isStudioUnlockError(new MetaError(ErrorConditions.UNLOCK_REQUIRED)),
    ).toBe(true);
  });

  it("is true for the app-level KeymapUnlockRequiredError", () => {
    expect(isStudioUnlockError(new KeymapUnlockRequiredError())).toBe(true);
  });

  it("is true for an official response with meta.simpleError === UNLOCK_REQUIRED", () => {
    expect(
      isStudioUnlockError({
        meta: { simpleError: ErrorConditions.UNLOCK_REQUIRED },
      }),
    ).toBe(true);
  });

  it("is false for a MetaError with a different condition", () => {
    expect(isStudioUnlockError(new MetaError(ErrorConditions.GENERIC))).toBe(
      false,
    );
  });

  it("is false for a response whose meta carries a different error", () => {
    expect(isStudioUnlockError({ meta: { simpleError: 99 } })).toBe(false);
  });

  it("is false for unrelated errors, null, and plain values", () => {
    expect(isStudioUnlockError(new Error("boom"))).toBe(false);
    expect(isStudioUnlockError(null)).toBe(false);
    expect(isStudioUnlockError(undefined)).toBe(false);
    expect(isStudioUnlockError({ keymap: {} })).toBe(false);
    expect(isStudioUnlockError(new StudioUnlockCancelledError())).toBe(false);
  });
});

describe("isKeymapUnlockRequired", () => {
  it("recognizes both the app error and the transport MetaError", () => {
    expect(isKeymapUnlockRequired(new KeymapUnlockRequiredError())).toBe(true);
    expect(
      isKeymapUnlockRequired(new MetaError(ErrorConditions.UNLOCK_REQUIRED)),
    ).toBe(true);
    expect(isKeymapUnlockRequired(new Error("nope"))).toBe(false);
  });
});
