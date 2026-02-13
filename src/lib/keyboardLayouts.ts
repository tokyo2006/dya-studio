/**
 * Keyboard Layout Mappings
 *
 * This file defines mappings between keyboard layouts (US, JIS, etc.)
 * for displaying keycodes according to the selected physical keyboard layout.
 *
 * The mapping is based on HID usage codes, where different physical layouts
 * may have different symbols on the same HID code.
 *
 * Example: In JIS layout, the key that produces "@" in US layout is physically
 * labeled "[" and located at a different position.
 */

/**
 * Supported keyboard layout types
 */
export type KeyboardLayoutType = "US" | "JIS";

/**
 * Mapping from HID usage code to display name for a specific layout
 */
export interface KeycodeLayoutMapping {
  /** HID usage code */
  code: number;
  /** Display name for this layout */
  displayName: string;
  /** Full name for this layout */
  name?: string;
}

/**
 * JIS layout keycode mappings (only codes that differ from US layout)
 *
 * Reference:
 * - JIS keyboard layout: https://en.wikipedia.org/wiki/Keyboard_layout#Japanese
 * - The main differences are in punctuation and symbol keys
 *
 * Key differences between US and JIS layouts:
 * - 0x2f ([): In US shows "[", in JIS shows "@"
 * - 0x30 (]): In US shows "]", in JIS shows "["
 * - 0x31 (\): In US shows "\", in JIS shows "]"
 * - 0x33 (;): In US shows ";", in JIS shows ";"
 * - 0x34 ('): In US shows "'", in JIS shows ":"
 * - 0x35 (`): In US shows "`", in JIS shows "半/全"
 * - 0x1f (2): In US shows "2", in JIS shows "2" but @ symbol position differs
 * - 0x23 (6): In US shows "6", in JIS shows "6" but ^ symbol position differs
 * - 0x24 (7): In US shows "7", in JIS shows "7" but & symbol position differs
 * - 0x25 (8): In US shows "8", in JIS shows "8" but * symbol position differs
 * - 0x26 (9): In US shows "9", in JIS shows "9" but ( symbol position differs
 * - 0x27 (0): In US shows "0", in JIS shows "0" but ) symbol position differs
 * - 0x2d (-): In US shows "-", in JIS shows "-"
 * - 0x2e (=): In US shows "=", in JIS shows "^"
 */
const JIS_LAYOUT_MAPPINGS: KeycodeLayoutMapping[] = [
  // Main differences in punctuation/symbol keys
  {
    code: 0x2f,
    displayName: "@",
    name: "At Sign",
  },
  {
    code: 0x30,
    displayName: "[",
    name: "Left Bracket",
  },
  {
    code: 0x31,
    displayName: "]",
    name: "Right Bracket",
  },
  {
    code: 0x33,
    displayName: ";",
    name: "Semicolon",
  },
  {
    code: 0x34,
    displayName: ":",
    name: "Colon",
  },
  {
    code: 0x35,
    displayName: "半/全",
    name: "Hankaku/Zenkaku",
  },
  {
    code: 0x2e,
    displayName: "^",
    name: "Caret",
  },
  {
    code: 0x87,
    displayName: "\\",
    name: "Backslash (Ro)",
  },
];

/**
 * Layout mapping registry
 * Maps layout type to a Map of code -> mapping
 */
const layoutMappings = new Map<
  KeyboardLayoutType,
  Map<number, KeycodeLayoutMapping>
>();

// Build JIS layout mapping
const jisMap = new Map<number, KeycodeLayoutMapping>();
JIS_LAYOUT_MAPPINGS.forEach((mapping) => {
  jisMap.set(mapping.code, mapping);
});
layoutMappings.set("JIS", jisMap);

// US layout uses default mappings from keycodes.ts (no overrides needed)
layoutMappings.set("US", new Map());

/**
 * Get the display name for a keycode in a specific layout.
 * Returns undefined if no override exists for this layout.
 *
 * @param code - HID usage code
 * @param layout - Keyboard layout type
 * @returns Display name override, or undefined if using default
 */
export function getLayoutDisplayName(
  code: number,
  layout: KeyboardLayoutType,
): string | undefined {
  const mapping = layoutMappings.get(layout)?.get(code);
  return mapping?.displayName;
}

/**
 * Get the full name for a keycode in a specific layout.
 * Returns undefined if no override exists for this layout.
 *
 * @param code - HID usage code
 * @param layout - Keyboard layout type
 * @returns Full name override, or undefined if using default
 */
export function getLayoutName(
  code: number,
  layout: KeyboardLayoutType,
): string | undefined {
  const mapping = layoutMappings.get(layout)?.get(code);
  return mapping?.name;
}

/**
 * Get all available keyboard layout types
 */
export function getAvailableLayouts(): KeyboardLayoutType[] {
  return ["US", "JIS"];
}

/**
 * Get display label for a layout type
 */
export function getLayoutLabel(layout: KeyboardLayoutType): string {
  switch (layout) {
    case "US":
      return "US (ANSI)";
    case "JIS":
      return "JIS (Japanese)";
    default:
      return layout;
  }
}

/**
 * Default keyboard layout
 */
export const DEFAULT_KEYBOARD_LAYOUT: KeyboardLayoutType = "US";

/**
 * LocalStorage key for storing keyboard layout preference
 */
export const KEYBOARD_LAYOUT_STORAGE_KEY = "keyboardLayout";

/**
 * Get keyboard layout from localStorage, or return default
 */
export function getSavedKeyboardLayout(): KeyboardLayoutType {
  const saved = localStorage.getItem(KEYBOARD_LAYOUT_STORAGE_KEY);
  if (saved === "US" || saved === "JIS") {
    return saved;
  }
  return DEFAULT_KEYBOARD_LAYOUT;
}

/**
 * Save keyboard layout to localStorage
 */
export function saveKeyboardLayout(layout: KeyboardLayoutType): void {
  localStorage.setItem(KEYBOARD_LAYOUT_STORAGE_KEY, layout);
}
