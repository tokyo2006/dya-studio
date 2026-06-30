/**
 * Tests for keyboard layout mappings
 */
import {
  getLayoutDisplayName,
  getLayoutName,
  getAvailableLayouts,
  getLayoutLabel,
  getSavedKeyboardLayout,
  saveKeyboardLayout,
  DEFAULT_KEYBOARD_LAYOUT,
  KEYBOARD_LAYOUT_STORAGE_KEY,
} from "../keyboardLayouts";

describe("keyboardLayouts", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("getAvailableLayouts", () => {
    it("should return all layouts", () => {
      const layouts = getAvailableLayouts();
      expect(layouts).toEqual(["US", "JIS", "US_JP"]);
    });
  });

  describe("getLayoutLabel", () => {
    it("should return correct labels for layouts", () => {
      expect(getLayoutLabel("US")).toBe("US (ANSI)");
      expect(getLayoutLabel("JIS")).toBe("JIS (Japanese)");
    });
  });

  describe("getLayoutDisplayName", () => {
    it("should return undefined for US layout (no overrides)", () => {
      expect(getLayoutDisplayName(0x2f, "US")).toBeUndefined();
      expect(getLayoutDisplayName(0x30, "US")).toBeUndefined();
    });

    it("should return JIS display names for mapped keycodes", () => {
      // 0x2f ([): In US shows "[", in JIS shows "@"
      expect(getLayoutDisplayName(0x2f, "JIS")).toBe("@`");
      // 0x30 (]): In US shows "]", in JIS shows "["
      expect(getLayoutDisplayName(0x30, "JIS")).toBe("[{");
      // 0x34 ('): In US shows "'", in JIS shows ":"
      expect(getLayoutDisplayName(0x34, "JIS")).toBe(":*");
      // 0x35 (`): In US shows "`", in JIS shows "半/全"
      expect(getLayoutDisplayName(0x35, "JIS")).toBe("半/全");
      // 0x2e (=): In US shows "=", in JIS shows "^"
      expect(getLayoutDisplayName(0x2e, "JIS")).toBe("^~");
      expect(getLayoutDisplayName(0x90, "JIS")).toBe("かな");
      expect(getLayoutDisplayName(0x91, "JIS")).toBe("英数");
    });

    it("should return US_JP display names for Japanese language keycodes", () => {
      expect(getLayoutDisplayName(0x90, "US_JP")).toBe("かな");
      expect(getLayoutDisplayName(0x91, "US_JP")).toBe("英数");
    });

    it("should return undefined for unmapped keycodes", () => {
      expect(getLayoutDisplayName(0x04, "JIS")).toBeUndefined(); // A key
      expect(getLayoutDisplayName(0x1e, "JIS")).toBeUndefined(); // 1 key
    });
  });

  describe("getLayoutName", () => {
    it("should return undefined for US layout (no overrides)", () => {
      expect(getLayoutName(0x2f, "US")).toBeUndefined();
    });

    it("should return JIS full names for mapped keycodes", () => {
      expect(getLayoutName(0x2f, "JIS")).toBe("At Sign");
      expect(getLayoutName(0x30, "JIS")).toBe("Left Bracket");
    });

    it("should return undefined for unmapped keycodes", () => {
      expect(getLayoutName(0x04, "JIS")).toBeUndefined();
    });
  });

  describe("localStorage persistence", () => {
    it("should save layout to localStorage", () => {
      saveKeyboardLayout("JIS");
      expect(localStorage.getItem(KEYBOARD_LAYOUT_STORAGE_KEY)).toBe("JIS");
    });

    it("should load saved layout from localStorage", () => {
      localStorage.setItem(KEYBOARD_LAYOUT_STORAGE_KEY, "JIS");
      expect(getSavedKeyboardLayout()).toBe("JIS");
    });

    it("should return default layout when nothing is saved", () => {
      expect(getSavedKeyboardLayout()).toBe(DEFAULT_KEYBOARD_LAYOUT);
    });

    it("should return default layout for invalid values", () => {
      localStorage.setItem(KEYBOARD_LAYOUT_STORAGE_KEY, "INVALID");
      expect(getSavedKeyboardLayout()).toBe(DEFAULT_KEYBOARD_LAYOUT);
    });

    it("should handle US layout", () => {
      localStorage.setItem(KEYBOARD_LAYOUT_STORAGE_KEY, "US");
      expect(getSavedKeyboardLayout()).toBe("US");
    });
  });
});
