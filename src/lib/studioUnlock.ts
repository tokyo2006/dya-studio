/**
 * Shared Studio-unlock primitives.
 *
 * A ZMK Studio "unlock required" condition can surface in three different
 * shapes depending on which transport path a request took:
 *
 *  1. A thrown {@link import("@zmkfirmware/zmk-studio-ts-client").MetaError}
 *     from `call_rpc` (custom subsystems and official mutations) — detected by
 *     the library's {@link isUnlockRequiredError}.
 *  2. A returned official-protocol response carrying
 *     `meta.simpleError === ErrorConditions.UNLOCK_REQUIRED` (the official read
 *     path resolves rather than throws).
 *  3. The app-level {@link KeymapUnlockRequiredError} raised by the fast-keymap
 *     load path.
 *
 * {@link isStudioUnlockError} collapses all three into one predicate so the
 * central unlock gate ({@link import("../contexts/StudioUnlockContext")}) can
 * treat "the keyboard is locked" uniformly, no matter which feature produced
 * the failure.
 */
import { isUnlockRequiredError } from "@cormoran/zmk-studio-react-hook";
import { ErrorConditions } from "@zmkfirmware/zmk-studio-ts-client/meta";

/**
 * Thrown when a keymap load fails because the keyboard is locked. Lives here
 * (rather than in `useKeymapSource`) so {@link isStudioUnlockError} can
 * recognize it without a circular import; re-exported from `useKeymapSource`
 * for existing callers.
 */
export class KeymapUnlockRequiredError extends Error {
  constructor() {
    super("Keyboard needs to be unlocked");
    this.name = "KeymapUnlockRequiredError";
  }
}

/** True when `err` means "the keyboard is locked" — from either protocol. */
export function isKeymapUnlockRequired(err: unknown): boolean {
  return err instanceof KeymapUnlockRequiredError || isUnlockRequiredError(err);
}

/**
 * Rejection raised by the unlock gate when the user dismisses the unlock modal
 * instead of unlocking. Callers should swallow it silently: the user chose to
 * back out, so it is not an error worth surfacing as a banner.
 */
export class StudioUnlockCancelledError extends Error {
  constructor() {
    super("Studio unlock cancelled by user");
    this.name = "StudioUnlockCancelledError";
  }
}

/**
 * True when `x` represents a "keyboard is locked" condition, whether it is a
 * thrown error (`MetaError` / {@link KeymapUnlockRequiredError}) or a returned
 * response object with `meta.simpleError === UNLOCK_REQUIRED`.
 */
export function isStudioUnlockError(x: unknown): boolean {
  if (isKeymapUnlockRequired(x)) {
    return true;
  }
  // Official-protocol responses resolve (rather than throw) with the unlock
  // condition tucked into `meta.simpleError`.
  if (x !== null && typeof x === "object" && "meta" in x) {
    const meta = (x as { meta?: { simpleError?: number } }).meta;
    if (meta?.simpleError === ErrorConditions.UNLOCK_REQUIRED) {
      return true;
    }
  }
  return false;
}
