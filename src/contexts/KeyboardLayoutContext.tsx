/**
 * KeyboardLayoutContext
 *
 * Provides keyboard layout selection state management across the app.
 * The layout selection affects how keycodes are displayed (e.g., US vs JIS).
 */
import { createContext } from "react";
import type { KeyboardLayoutType } from "../lib/keyboardLayouts";
import { DEFAULT_KEYBOARD_LAYOUT } from "../lib/keyboardLayouts";

export interface KeyboardLayoutContextValue {
  /** Current keyboard layout */
  layout: KeyboardLayoutType;
  /** Set the keyboard layout */
  setLayout: (layout: KeyboardLayoutType) => void;
}

export const KeyboardLayoutContext = createContext<KeyboardLayoutContextValue>({
  layout: DEFAULT_KEYBOARD_LAYOUT,
  setLayout: () => {},
});
