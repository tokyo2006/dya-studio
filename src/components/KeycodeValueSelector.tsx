/**
 * KeycodeValueSelector Component
 *
 * Grid-based keycode selector with search, category filtering, and modifier support.
 */
import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { IconSearch, IconX } from "@tabler/icons-react";
import {
  CATEGORY_DISPLAY_NAMES,
  searchKeycodes,
  getKeycodesByCategory,
  type KeycodeCategory,
  type KeycodeDefinition,
  HID_USAGE_PAGE_KEYBOARD,
  createHidUsage,
  MODIFIER_FLAGS,
  NO_PARAM_VALUE,
  extractModifierFlags,
  extractBaseKeycode,
  combineWithModifiers,
} from "../lib/keycodes";
import {
  getLayoutDisplayName,
  getLayoutName,
  type KeyboardLayoutType,
} from "../lib/keyboardLayouts";

// Keycode categories in display order
const KEYCODE_CATEGORY_ORDER: KeycodeCategory[] = [
  "letters",
  "numbers",
  "punctuation",
  "navigation",
  "modifiers",
  "function",
  "numpad",
  "media",
  "system",
  "international",
  "miscellaneous",
];

interface KeycodeValueSelectorProps {
  value: number;
  onChange: (value: number, shouldNotClose?: boolean) => void;
  showModifiers?: boolean;
  keyboardLayout?: KeyboardLayoutType;
}

export function KeycodeValueSelector({
  value,
  onChange,
  keyboardLayout,
  showModifiers = true,
}: KeycodeValueSelectorProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] =
    useState<KeycodeCategory>("letters");
  const [selectedModifiers, setSelectedModifiers] = useState<number>(
    extractModifierFlags(value),
  );
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Update modifiers when value changes externally
  useEffect(() => {
    setSelectedModifiers(extractModifierFlags(value));
  }, [value]);
  // Update selectedCategory when value changes or initially provided
  useEffect(() => {
    const baseCode = extractBaseKeycode(value);
    const keycodes = KEYCODE_CATEGORY_ORDER.flatMap((c) =>
      getKeycodesByCategory(c, keyboardLayout),
    );
    const found = keycodes.find((k) => k.code === baseCode);
    if (found && found.category !== selectedCategory) {
      setSelectedCategory(found.category);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, keyboardLayout]);
  // Focus the search input when the component is mounted (shown)
  useEffect(() => {
    const isTouchDevice = window.matchMedia(
      "(hover: none) and (pointer: coarse)",
    ).matches;
    if (!isTouchDevice) {
      searchInputRef.current?.focus();
    }
  }, []);
  const filteredKeycodes = useMemo((): KeycodeDefinition[] => {
    if (searchQuery.trim()) {
      return searchKeycodes(searchQuery, keyboardLayout);
    }
    return getKeycodesByCategory(selectedCategory, keyboardLayout);
  }, [searchQuery, selectedCategory, keyboardLayout]);

  const handleKeycodeSelect = useCallback(
    (keycode: KeycodeDefinition) => {
      const combined = combineWithModifiers(keycode.code, selectedModifiers);
      onChange(combined);
    },
    [onChange, selectedModifiers],
  );

  const handleModifierToggle = useCallback(
    (modValue: number) => {
      const newModifiers = selectedModifiers ^ modValue;
      setSelectedModifiers(newModifiers);
      // Update the current value with new modifiers if a keycode is selected
      const baseCode = extractBaseKeycode(value);
      if (baseCode !== NO_PARAM_VALUE) {
        onChange(combineWithModifiers(baseCode, newModifiers), true);
      }
    },
    [selectedModifiers, value, onChange],
  );

  const handleClearModifiers = useCallback(() => {
    setSelectedModifiers(0);
    // Update the current value with no modifiers if a keycode is selected
    const baseCode = extractBaseKeycode(value);
    if (baseCode !== NO_PARAM_VALUE) {
      onChange(combineWithModifiers(baseCode, 0));
    }
  }, [value, onChange]);

  return (
    <div className="flex flex-col h-full">
      {/* Modifier Flags */}
      {showModifiers && (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-[var(--color-text-muted)]">
              Modifiers:
            </span>
            {selectedModifiers !== 0 && (
              <button
                className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] flex items-center gap-1"
                onClick={handleClearModifiers}
              >
                <IconX size={12} />
                Clear
              </button>
            )}
          </div>
          <div className="flex gap-1 overflow-x-auto">
            {MODIFIER_FLAGS.map((mod) => (
              <button
                key={mod.value}
                className={`px-2 py-1 rounded text-xs transition-colors ${
                  selectedModifiers & mod.value
                    ? "bg-[var(--color-cyber)]/20 text-[var(--color-cyber)] border border-[var(--color-cyber)]"
                    : "bg-[var(--color-bg)] text-[var(--color-text-muted)] border border-[var(--color-border)] hover:border-[var(--color-cyber)]/50"
                }`}
                onClick={() => handleModifierToggle(mod.value)}
              >
                {mod.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="mb-3">
        <div className="relative">
          <IconSearch
            size={16}
            className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
          />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search keycodes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-8 py-1.5 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] tablet:text-sm text-base text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-electric)]/50"
          />
          {searchQuery && (
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              onClick={() => {
                setSearchQuery("");
                searchInputRef.current?.focus();
              }}
              aria-label="Clear search"
              tabIndex={0}
            >
              <IconX size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Category + Grid Layout */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Category Sidebar */}
        {!searchQuery && (
          <div className="w-28 border-r border-[var(--color-border)] overflow-y-auto pr-2">
            {KEYCODE_CATEGORY_ORDER.map((category) => (
              <button
                key={category}
                className={`w-full px-2 py-1.5 text-left text-xs rounded transition-colors mb-0.5 ${
                  selectedCategory === category
                    ? "bg-[var(--color-electric)]/10 text-[var(--color-electric)]"
                    : "text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]"
                }`}
                onClick={() => setSelectedCategory(category)}
              >
                {CATEGORY_DISPLAY_NAMES[category]}
              </button>
            ))}
          </div>
        )}

        {/* Keycode Grid */}
        <div className="flex-1 overflow-y-auto pl-2">
          <div
            className={`grid gap-1 tablet:grid-cols-5 ${
              searchQuery.trim() ? "grid-cols-4" : "grid-cols-2 "
            }`}
          >
            {filteredKeycodes.map((keycode) => {
              const isSelected =
                extractBaseKeycode(value) === keycode.code ||
                extractBaseKeycode(value) ===
                  createHidUsage(HID_USAGE_PAGE_KEYBOARD, keycode.code);
              return (
                <button
                  key={`${keycode.category}-${keycode.code}`}
                  className={`p-1.5 rounded border text-center transition-colors ${
                    isSelected
                      ? "bg-[var(--color-electric)]/20 border-[var(--color-electric)]"
                      : "bg-[var(--color-bg)] border-[var(--color-border)] hover:border-[var(--color-electric)]/50"
                  }`}
                  onClick={() => handleKeycodeSelect(keycode)}
                  title={`${keycode.name} (0x${keycode.code.toString(16).toUpperCase()})`}
                >
                  <span className="block text-xs font-medium text-[var(--color-text)]">
                    {getLayoutDisplayName(keycode.code, keyboardLayout) ??
                      keycode.displayName}
                  </span>
                  {keycode.displayName !== keycode.name && (
                    <span className="block text-[10px] text-[var(--color-text-muted)] truncate">
                      {getLayoutName(keycode.code, keyboardLayout) ??
                        keycode.name}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {filteredKeycodes.length === 0 && (
            <div className="text-center py-4 text-xs text-[var(--color-text-muted)]">
              No keycodes found
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
