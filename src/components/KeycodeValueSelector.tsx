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
  onChange: (value: number) => void;
  showModifiers?: boolean;
}

export function KeycodeValueSelector({
  value,
  onChange,
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

  const filteredKeycodes = useMemo((): KeycodeDefinition[] => {
    if (searchQuery.trim()) {
      return searchKeycodes(searchQuery);
    }
    return getKeycodesByCategory(selectedCategory);
  }, [searchQuery, selectedCategory]);

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
        onChange(combineWithModifiers(baseCode, newModifiers));
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
          <div className="flex flex-wrap gap-1">
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
            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] text-sm text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-electric)]/50"
          />
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
          <div className="grid grid-cols-5 gap-1">
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
                    {keycode.displayName}
                  </span>
                  {keycode.displayName !== keycode.name && (
                    <span className="block text-[10px] text-[var(--color-text-muted)] truncate">
                      {keycode.name}
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
