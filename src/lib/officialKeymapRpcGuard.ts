/**
 * Guard against using the official ZMK `keymap` / `behaviors` LOAD RPCs while
 * the fast-keymap subsystem is available.
 *
 * When a keyboard exposes `cormoran__fast_keymap`, all keymap/behavior/layout
 * *reading* must go through the fast path (see {@link useKeymapSource}). If an
 * official-protocol read still slips through, it silently costs a slow
 * round-trip — exactly the kind of thing that makes the UI "feel slow" even
 * though the fast path exists. This guard turns that mistake into a loud error
 * instead of a silent slowdown, so the offending caller is obvious.
 *
 * Scope: only the reads the fast subsystem *replaces* are forbidden. Editing
 * RPCs (setLayerBinding, moveLayer, addLayer, removeLayer, restoreLayer,
 * setLayerProps, saveChanges, discardChanges, setActivePhysicalLayout) and
 * checkUnsavedChanges stay allowed — the fast subsystem is read-only, so those
 * legitimately use the official protocol.
 */
import type { call_rpc } from "@zmkfirmware/zmk-studio-ts-client";

type OfficialRequest = Parameters<typeof call_rpc>[1];

// Connection-scoped truth: whether the currently connected device exposes the
// fast-keymap subsystem. Kept in sync by useKeymapSource. A module-level flag
// (rather than a hook value) so the guard can be enforced at every call_rpc
// site regardless of which component/hook issues it.
let fastKeymapAvailable = false;

/** Set by useKeymapSource whenever fast-keymap availability changes. */
export function setFastKeymapAvailable(available: boolean): void {
  fastKeymapAvailable = available;
}

/** Whether the guard is currently active (fast-keymap available). */
export function isFastKeymapGuardActive(): boolean {
  return fastKeymapAvailable;
}

/** The official keymap/behaviors READ RPCs the fast subsystem fully replaces. */
const FORBIDDEN_OFFICIAL_READS: ReadonlyArray<{
  name: string;
  match: (request: OfficialRequest) => unknown;
}> = [
  { name: "keymap.getKeymap", match: (r) => r.keymap?.getKeymap },
  {
    name: "keymap.getPhysicalLayouts",
    match: (r) => r.keymap?.getPhysicalLayouts,
  },
  {
    name: "behaviors.listAllBehaviors",
    match: (r) => r.behaviors?.listAllBehaviors,
  },
  {
    name: "behaviors.getBehaviorDetails",
    match: (r) => r.behaviors?.getBehaviorDetails,
  },
];

/** Thrown when a fast-replaceable official read is attempted while the
 * fast-keymap subsystem is available. */
export class OfficialKeymapRpcForbiddenError extends Error {
  constructor(rpcName: string) {
    super(
      `Official ZMK RPC "${rpcName}" was used while the fast-keymap subsystem ` +
        `is available. Keymap/behavior/layout data must be loaded through the ` +
        `fast path (useKeymapSource), not the official protocol.`,
    );
    this.name = "OfficialKeymapRpcForbiddenError";
  }
}

/**
 * Throws {@link OfficialKeymapRpcForbiddenError} if `request` is a
 * fast-replaceable official keymap/behaviors read AND the fast-keymap
 * subsystem is available. No-op otherwise (including all edits and every RPC
 * when fast-keymap is not available). Call right before `call_rpc`.
 */
export function assertOfficialKeymapRpcAllowed(request: OfficialRequest): void {
  if (!fastKeymapAvailable) return;
  for (const { name, match } of FORBIDDEN_OFFICIAL_READS) {
    if (match(request)) {
      throw new OfficialKeymapRpcForbiddenError(name);
    }
  }
}
