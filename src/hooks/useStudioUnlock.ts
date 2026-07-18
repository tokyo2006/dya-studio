import { useContext } from "react";
import {
  StudioUnlockContext,
  type StudioUnlockContextValue,
} from "../contexts/StudioUnlockContext";

/**
 * Access the shared Studio-unlock gate. See {@link StudioUnlockContextValue}
 * for `runWithUnlock` (reactive fail→modal→retry) and `requireUnlock` (the
 * proactive gate for editor actions). Outside a StudioUnlockProvider this
 * returns a transparent passthrough (no modal).
 */
export function useStudioUnlock(): StudioUnlockContextValue {
  return useContext(StudioUnlockContext);
}
