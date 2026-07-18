import { MetaError } from "@zmkfirmware/zmk-studio-ts-client";
import { ErrorConditions } from "@zmkfirmware/zmk-studio-ts-client/meta";
import {
  KeymapUnlockRequiredError,
  STUDIO_LOCKED_MESSAGE,
  StudioUnlockCancelledError,
  isKeymapUnlockRequired,
  isStudioUnlockError,
  studioLockErrorText,
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

describe("StudioUnlockCancelledError", () => {
  it("carries the shared locked message so err.message renders clearly", () => {
    expect(new StudioUnlockCancelledError().message).toBe(
      STUDIO_LOCKED_MESSAGE,
    );
  });
});

describe("studioLockErrorText", () => {
  it("returns the shared message for cancel and unlock errors", () => {
    expect(studioLockErrorText(new StudioUnlockCancelledError())).toBe(
      STUDIO_LOCKED_MESSAGE,
    );
    expect(
      studioLockErrorText(new MetaError(ErrorConditions.UNLOCK_REQUIRED)),
    ).toBe(STUDIO_LOCKED_MESSAGE);
    expect(studioLockErrorText(new KeymapUnlockRequiredError())).toBe(
      STUDIO_LOCKED_MESSAGE,
    );
  });

  it("returns null for unrelated errors so callers keep their own text", () => {
    expect(studioLockErrorText(new Error("boom"))).toBeNull();
    expect(studioLockErrorText(null)).toBeNull();
    expect(
      studioLockErrorText({ error: { message: "device said no" } }),
    ).toBeNull();
  });
});
