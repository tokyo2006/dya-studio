/**
 * KeycodeSelector Component
 *
 * A modal dialog for selecting behaviors and configuring parameters.
 * Behavior-first approach: select behavior, then configure parameters.
 * Supports various parameter types with dedicated UI selectors.
 */
import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  IconSearch,
  IconX,
  IconChevronDown,
  IconKeyboard,
  IconStack2,
  IconBluetooth,
  IconMouse,
  IconArrowsMove,
  IconArrowBarDown,
} from "@tabler/icons-react";
import {
  CATEGORY_DISPLAY_NAMES,
  searchKeycodes,
  getKeycodesByCategory,
  type KeycodeCategory,
  type KeycodeDefinition,
  HID_USAGE_PAGE_KEYBOARD,
  createHidUsage,
  getKeycodeByCode,
  getHidUsageCode,
  getHidUsagePage,
} from "../lib/keycodes";
import {
  getBehaviorMetadata,
  getBehaviorParamOptions,
  type BehaviorCategory,
  type ParamType,
} from "../lib/behaviorMetadata";
import type { BehaviorBinding, BehaviorDefinition } from "../hooks/useKeymap";

// =============================================================================
// Types and Constants
// =============================================================================

interface BehaviorOption {
  id: number;
  name: string;
  displayName: string;
  category: BehaviorCategory;
  description?: string;
  needsParam1?: boolean;
  needsParam2?: boolean;
  param1Type?: ParamType;
  param2Type?: ParamType;
}

interface KeycodeSelectorProps {
  open: boolean;
  onClose: () => void;
  onSelect: (binding: BehaviorBinding) => void;
  currentBinding?: BehaviorBinding | null;
  behaviors: Map<number, BehaviorDefinition>;
  layers: Array<{ id: number; name: string }>;
}

// Predefined behavior categories
const BEHAVIOR_CATEGORIES: { id: BehaviorCategory; name: string }[] = [
  { id: "keypress", name: "Key Press" },
  { id: "layer", name: "Layers" },
  { id: "mod", name: "Modifiers" },
  { id: "mouse", name: "Mouse" },
  { id: "bluetooth", name: "Bluetooth" },
  { id: "output", name: "Output" },
  { id: "system", name: "System" },
  { id: "miscellaneous", name: "Misc" },
  { id: "others", name: "Others" },
];

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

// Quick-select behaviors for faster access
const QUICK_SELECT_BEHAVIORS = ["kp", "trans", "none"];

// Mouse keycodes
const MOUSE_KEYCODES = [
  { value: 1, label: "Left Click", shortLabel: "LCLK" },
  { value: 2, label: "Right Click", shortLabel: "RCLK" },
  { value: 3, label: "Middle Click", shortLabel: "MCLK" },
  { value: 4, label: "Button 4", shortLabel: "BTN4" },
  { value: 5, label: "Button 5", shortLabel: "BTN5" },
];

// Mouse movement directions
const MOUSE_MOVEMENTS = [
  { value: 0, label: "Move Up", shortLabel: "↑" },
  { value: 1, label: "Move Down", shortLabel: "↓" },
  { value: 2, label: "Move Left", shortLabel: "←" },
  { value: 3, label: "Move Right", shortLabel: "→" },
];

// Mouse scroll directions
const MOUSE_SCROLLS = [
  { value: 0, label: "Scroll Up", shortLabel: "↑" },
  { value: 1, label: "Scroll Down", shortLabel: "↓" },
  { value: 2, label: "Scroll Left", shortLabel: "←" },
  { value: 3, label: "Scroll Right", shortLabel: "→" },
];

// Modifier flags for keycodes
const MODIFIER_FLAGS = [
  { value: 0x01, label: "LCtrl", shortLabel: "LC" },
  { value: 0x02, label: "LShift", shortLabel: "LS" },
  { value: 0x04, label: "LAlt", shortLabel: "LA" },
  { value: 0x08, label: "LGui", shortLabel: "LG" },
  { value: 0x10, label: "RCtrl", shortLabel: "RC" },
  { value: 0x20, label: "RShift", shortLabel: "RS" },
  { value: 0x40, label: "RAlt", shortLabel: "RA" },
  { value: 0x80, label: "RGui", shortLabel: "RG" },
];

// HID usage constants
// A basic keycode fits in 16 bits (page << 16 | code), anything larger has additional info
const MAX_BASIC_KEYCODE = 0xffff;
// Modifier flags mask - only 8 bits for the 8 modifier keys
const MODIFIER_FLAGS_MASK = 0xff;
// Value indicating no keycode/parameter has been set
const NO_PARAM_VALUE = 0;

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Extract modifier flags from HID usage value.
 * Modifier flags are stored in bits 24-31 (8 bits for 8 modifier keys).
 */
function extractModifierFlags(hidUsage: number): number {
  return (hidUsage >> 24) & MODIFIER_FLAGS_MASK;
}

/**
 * Extract base keycode from HID usage value (without modifiers)
 */
function extractBaseKeycode(hidUsage: number): number {
  const page = getHidUsagePage(hidUsage);
  const code = getHidUsageCode(hidUsage);
  // If page is keyboard page, return just the code
  // Otherwise return the full usage (for consumer page, etc.)
  return page === HID_USAGE_PAGE_KEYBOARD ? code : hidUsage;
}

/**
 * Combine keycode with modifier flags
 */
function combineWithModifiers(keycode: number, modifiers: number): number {
  // If keycode already has page info (> MAX_BASIC_KEYCODE), just add modifiers
  if (keycode > MAX_BASIC_KEYCODE) {
    return keycode | (modifiers << 24);
  }
  // Otherwise, create full HID usage with keyboard page and modifiers
  return createHidUsage(HID_USAGE_PAGE_KEYBOARD, keycode) | (modifiers << 24);
}

/**
 * Format keycode with modifiers for display
 */
function formatKeycodeWithModifiers(hidUsage: number): string {
  const modifiers = extractModifierFlags(hidUsage);
  const baseCode = extractBaseKeycode(hidUsage);

  // Get base keycode name
  const keycode = getKeycodeByCode(baseCode);
  const baseName =
    keycode?.displayName || `0x${baseCode.toString(16).toUpperCase()}`;

  if (modifiers === 0) {
    return baseName;
  }

  // Build modifier prefix
  const modParts: string[] = [];
  MODIFIER_FLAGS.forEach((mod) => {
    if (modifiers & mod.value) {
      modParts.push(mod.shortLabel);
    }
  });

  return `${modParts.join("+")}(${baseName})`;
}

// =============================================================================
// Sub-Components
// =============================================================================

/**
 * ButtonListSelector - Reusable component for selecting from a small list of options
 */
interface ButtonListOption {
  value: number;
  label: string;
  shortLabel?: string;
  icon?: React.ReactNode;
}

interface ButtonListSelectorProps {
  options: ButtonListOption[];
  value: number;
  onChange: (value: number) => void;
  columns?: number;
}

function ButtonListSelector({
  options,
  value,
  onChange,
  columns = 3,
}: ButtonListSelectorProps) {
  return (
    <div
      className="grid gap-2"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {options.map((option) => (
        <button
          key={option.value}
          className={`p-3 rounded-lg border text-center transition-colors ${
            value === option.value
              ? "bg-[var(--color-electric)]/20 border-[var(--color-electric)] text-[var(--color-electric)]"
              : "bg-[var(--color-bg)] border-[var(--color-border)] hover:border-[var(--color-electric)]/50 text-[var(--color-text-secondary)]"
          }`}
          onClick={() => onChange(option.value)}
        >
          {option.icon && (
            <div className="flex justify-center mb-1">{option.icon}</div>
          )}
          <span className="block text-sm font-medium">
            {option.shortLabel || option.label}
          </span>
          {option.shortLabel && (
            <span className="block text-xs text-[var(--color-text-muted)]">
              {option.label}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

/**
 * KeycodeValueSelector - Grid-based keycode selector with search and modifier support
 */
interface KeycodeValueSelectorProps {
  value: number;
  onChange: (value: number) => void;
  showModifiers?: boolean;
}

function KeycodeValueSelector({
  value,
  onChange,
  showModifiers = true,
}: KeycodeValueSelectorProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] =
    useState<KeycodeCategory>("letters");
  const [selectedModifiers, setSelectedModifiers] = useState<number>(
    extractModifierFlags(value)
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
    [onChange, selectedModifiers]
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
    [selectedModifiers, value, onChange]
  );

  // Get current display value
  const currentDisplay =
    value !== NO_PARAM_VALUE ? formatKeycodeWithModifiers(value) : "None";

  return (
    <div className="flex flex-col h-full">
      {/* Current Selection Display */}
      <div className="mb-3 p-2 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)]">
        <div className="text-xs text-[var(--color-text-muted)] mb-1">
          Selected:
        </div>
        <div className="text-sm font-medium text-[var(--color-electric)]">
          {currentDisplay}
        </div>
      </div>

      {/* Modifier Flags */}
      {showModifiers && (
        <div className="mb-3">
          <div className="text-xs text-[var(--color-text-muted)] mb-2">
            Modifiers:
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
                {mod.shortLabel}
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
                  title={keycode.name}
                >
                  <span className="block text-xs font-medium text-[var(--color-text)]">
                    {keycode.displayName}
                  </span>
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

/**
 * BehaviorDropdown - Custom dropdown with quick-select buttons
 */
interface BehaviorDropdownProps {
  behaviors: Map<number, BehaviorDefinition>;
  selectedBehaviorId: number | null;
  onSelect: (behaviorId: number) => void;
  onQuickSelect: (behaviorId: number) => void;
}

function BehaviorDropdown({
  behaviors,
  selectedBehaviorId,
  onSelect,
  onQuickSelect,
}: BehaviorDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [filterCategory, setFilterCategory] = useState<
    BehaviorCategory | "all"
  >("all");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Build behavior options
  const behaviorOptions = useMemo((): BehaviorOption[] => {
    const allOptions: BehaviorOption[] = [];
    behaviors.forEach((behavior, id) => {
      const metadata = getBehaviorMetadata(behavior.displayName);
      const category = metadata?.category || "others";
      allOptions.push({
        id,
        name: behavior.displayName,
        displayName: behavior.displayName,
        category,
        description: metadata?.description,
        needsParam1: !!metadata?.param1Type,
        needsParam2: !!metadata?.param2Type,
        param1Type: metadata?.param1Type,
        param2Type: metadata?.param2Type,
      });
    });
    return allOptions.sort((a, b) => {
      const catA = BEHAVIOR_CATEGORIES.findIndex((c) => c.id === a.category);
      const catB = BEHAVIOR_CATEGORIES.findIndex((c) => c.id === b.category);
      if (catA !== catB) return catA - catB;
      return a.displayName.localeCompare(b.displayName);
    });
  }, [behaviors]);

  // Filtered options
  const filteredOptions = useMemo(() => {
    if (filterCategory === "all") return behaviorOptions;
    return behaviorOptions.filter((opt) => opt.category === filterCategory);
  }, [behaviorOptions, filterCategory]);

  // Quick select behaviors
  const quickSelectBehaviors = useMemo(() => {
    return QUICK_SELECT_BEHAVIORS.map((name) => {
      const metadata = getBehaviorMetadata(name);
      if (!metadata) return null;
      const behavior = Array.from(behaviors.values()).find((b) =>
        metadata.displayNameVariants.includes(b.displayName)
      );
      return behavior
        ? { id: behavior.id, name, displayName: behavior.displayName }
        : null;
    }).filter(Boolean) as { id: number; name: string; displayName: string }[];
  }, [behaviors]);

  // Current selection display
  const selectedBehavior =
    selectedBehaviorId !== null ? behaviors.get(selectedBehaviorId) : null;
  const selectedDisplay = selectedBehavior?.displayName || "Select Behavior";

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Main Row: Quick Select + Dropdown */}
      <div className="flex items-center gap-2">
        {/* Quick Select Buttons */}
        <div className="flex gap-1">
          {quickSelectBehaviors.map((qb) => (
            <button
              key={qb.id}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                selectedBehaviorId === qb.id
                  ? "bg-[var(--color-electric)]/20 text-[var(--color-electric)] border border-[var(--color-electric)]"
                  : "bg-[var(--color-border)] text-[var(--color-text-secondary)] border border-transparent hover:border-[var(--color-electric)]/50"
              }`}
              onClick={() => onQuickSelect(qb.id)}
            >
              {qb.name === "kp"
                ? "Key"
                : qb.name === "trans"
                  ? "▽"
                  : "✕"}
            </button>
          ))}
        </div>

        {/* Dropdown Trigger */}
        <button
          className="flex-1 flex items-center justify-between px-3 py-1.5 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] hover:border-[var(--color-electric)]/50 transition-colors"
          onClick={() => setIsOpen(!isOpen)}
        >
          <span className="text-sm text-[var(--color-text)]">
            {selectedDisplay}
          </span>
          <IconChevronDown
            size={16}
            className={`text-[var(--color-text-muted)] transition-transform ${isOpen ? "rotate-180" : ""}`}
          />
        </button>
      </div>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-xl z-10 max-h-80 overflow-hidden flex">
          {/* Category Filter */}
          <div className="w-28 border-r border-[var(--color-border)] overflow-y-auto py-1">
            <button
              className={`w-full px-2 py-1.5 text-left text-xs transition-colors ${
                filterCategory === "all"
                  ? "bg-[var(--color-electric)]/10 text-[var(--color-electric)]"
                  : "text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]"
              }`}
              onClick={() => setFilterCategory("all")}
            >
              All
            </button>
            {BEHAVIOR_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                className={`w-full px-2 py-1.5 text-left text-xs transition-colors ${
                  filterCategory === cat.id
                    ? "bg-[var(--color-electric)]/10 text-[var(--color-electric)]"
                    : "text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]"
                }`}
                onClick={() => setFilterCategory(cat.id)}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* Behavior List */}
          <div className="flex-1 overflow-y-auto py-1">
            {filteredOptions.map((option) => (
              <button
                key={option.id}
                className={`w-full px-3 py-2 text-left transition-colors ${
                  selectedBehaviorId === option.id
                    ? "bg-[var(--color-electric)]/10"
                    : "hover:bg-[var(--color-border)]"
                }`}
                onClick={() => {
                  onSelect(option.id);
                  setIsOpen(false);
                }}
              >
                <span className="block text-sm font-medium text-[var(--color-text)]">
                  {option.displayName}
                </span>
                {option.description && (
                  <span className="block text-xs text-[var(--color-text-muted)]">
                    {option.description}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function KeycodeSelector({
  open,
  onClose,
  onSelect,
  currentBinding,
  behaviors,
  layers,
}: KeycodeSelectorProps) {
  // State
  const [selectedBehavior, setSelectedBehavior] = useState<number | null>(null);
  const [param1, setParam1] = useState<number>(0);
  const [param2, setParam2] = useState<number>(0);
  const [activeParam, setActiveParam] = useState<1 | 2>(1);

  // Get selected behavior option
  const selectedBehaviorOption = useMemo((): BehaviorOption | null => {
    if (selectedBehavior === null) return null;
    const behavior = behaviors.get(selectedBehavior);
    if (!behavior) return null;
    const metadata = getBehaviorMetadata(behavior.displayName);
    return {
      id: selectedBehavior,
      name: behavior.displayName,
      displayName: behavior.displayName,
      category: metadata?.category || "others",
      description: metadata?.description,
      needsParam1: !!metadata?.param1Type,
      needsParam2: !!metadata?.param2Type,
      param1Type: metadata?.param1Type,
      param2Type: metadata?.param2Type,
    };
  }, [selectedBehavior, behaviors]);

  // Check if behavior needs parameters
  const needsParam1 = selectedBehaviorOption?.needsParam1 ?? false;
  const needsParam2 = selectedBehaviorOption?.needsParam2 ?? false;
  const needsAnyParam = needsParam1 || needsParam2;

  // Handle behavior selection from dropdown
  const handleBehaviorSelect = useCallback((behaviorId: number) => {
    setSelectedBehavior(behaviorId);
    setParam1(0);
    setParam2(0);
    setActiveParam(1);
  }, []);

  // Handle quick-select (immediate apply for behaviors without params)
  const handleQuickSelect = useCallback(
    (behaviorId: number) => {
      const behavior = behaviors.get(behaviorId);
      if (!behavior) return;
      const metadata = getBehaviorMetadata(behavior.displayName);

      // If behavior doesn't need params, apply immediately
      if (!metadata?.param1Type && !metadata?.param2Type) {
        onSelect({
          behaviorId,
          param1: 0,
          param2: 0,
        });
        onClose();
      } else {
        // Otherwise, select the behavior and show params
        setSelectedBehavior(behaviorId);
        setParam1(0);
        setParam2(0);
        setActiveParam(1);
      }
    },
    [behaviors, onSelect, onClose]
  );

  // Handle param1 change
  const handleParam1Change = useCallback(
    (value: number) => {
      setParam1(value);
      // Auto-advance to param2 if needed
      if (needsParam2) {
        setActiveParam(2);
      }
    },
    [needsParam2]
  );

  // Handle param2 change
  const handleParam2Change = useCallback((value: number) => {
    setParam2(value);
  }, []);

  // Handle apply
  const handleApply = useCallback(() => {
    if (selectedBehavior === null) return;
    onSelect({
      behaviorId: selectedBehavior,
      param1,
      param2,
    });
    onClose();
  }, [selectedBehavior, param1, param2, onSelect, onClose]);

  // Reset state when dialog opens
  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (isOpen) {
        // Pre-select current binding if available
        if (currentBinding) {
          setSelectedBehavior(currentBinding.behaviorId);
          setParam1(currentBinding.param1);
          setParam2(currentBinding.param2);
        } else {
          // Default to keypress behavior
          const kpMetadata = getBehaviorMetadata("kp");
          if (kpMetadata) {
            const kpBehavior = Array.from(behaviors.values()).find((b) =>
              kpMetadata.displayNameVariants.includes(b.displayName)
            );
            if (kpBehavior) {
              setSelectedBehavior(kpBehavior.id);
            }
          }
          setParam1(0);
          setParam2(0);
        }
        setActiveParam(1);
      } else {
        onClose();
      }
    },
    [onClose, currentBinding, behaviors]
  );

  // Run handleOpenChange on mount if open is true
  useEffect(() => {
    if (open) {
      handleOpenChange(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Render parameter value selector based on type
  const renderParamValueSelector = useCallback(
    (
      paramType: ParamType | undefined,
      value: number,
      onChange: (v: number) => void
    ) => {
      if (!paramType) return null;

      switch (paramType) {
        case "keycode":
          return (
            <KeycodeValueSelector
              value={value}
              onChange={onChange}
              showModifiers={true}
            />
          );

        case "layer":
          return (
            <ButtonListSelector
              options={layers.map((l) => ({
                value: l.id,
                label: l.name || `Layer ${l.id}`,
                icon: <IconStack2 size={20} />,
              }))}
              value={value}
              onChange={onChange}
              columns={Math.min(layers.length, 4)}
            />
          );

        case "bt_command": {
          const metadata = selectedBehaviorOption
            ? getBehaviorMetadata(
                behaviors.get(selectedBehaviorOption.id)?.displayName || ""
              )
            : null;
          const options = metadata ? getBehaviorParamOptions(metadata, 1) : null;
          return (
            <ButtonListSelector
              options={
                options?.map((opt) => ({
                  value: opt.value,
                  label: opt.label,
                  icon: <IconBluetooth size={20} />,
                })) || []
              }
              value={value}
              onChange={onChange}
              columns={3}
            />
          );
        }

        case "out_command": {
          const metadata = selectedBehaviorOption
            ? getBehaviorMetadata(
                behaviors.get(selectedBehaviorOption.id)?.displayName || ""
              )
            : null;
          const options = metadata ? getBehaviorParamOptions(metadata, 1) : null;
          return (
            <ButtonListSelector
              options={
                options?.map((opt) => ({
                  value: opt.value,
                  label: opt.label,
                })) || []
              }
              value={value}
              onChange={onChange}
              columns={3}
            />
          );
        }

        case "mouse_keycode":
          return (
            <ButtonListSelector
              options={MOUSE_KEYCODES.map((mk) => ({
                value: mk.value,
                label: mk.label,
                shortLabel: mk.shortLabel,
                icon: <IconMouse size={20} />,
              }))}
              value={value}
              onChange={onChange}
              columns={3}
            />
          );

        case "mouse_movement":
          return (
            <ButtonListSelector
              options={MOUSE_MOVEMENTS.map((mm) => ({
                value: mm.value,
                label: mm.label,
                shortLabel: mm.shortLabel,
                icon: <IconArrowsMove size={20} />,
              }))}
              value={value}
              onChange={onChange}
              columns={2}
            />
          );

        case "mouse_scroll":
          return (
            <ButtonListSelector
              options={MOUSE_SCROLLS.map((ms) => ({
                value: ms.value,
                label: ms.label,
                shortLabel: ms.shortLabel,
                icon: <IconArrowBarDown size={20} />,
              }))}
              value={value}
              onChange={onChange}
              columns={2}
            />
          );

        case "number":
        default:
          return (
            <input
              type="number"
              value={value}
              onChange={(e) => onChange(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text)] focus:outline-none focus:border-[var(--color-electric)]/50"
            />
          );
      }
    },
    [layers, selectedBehaviorOption, behaviors]
  );

  // Get param type label
  const getParamTypeLabel = (paramType: ParamType | undefined): string => {
    switch (paramType) {
      case "keycode":
        return "Keycode";
      case "layer":
        return "Layer";
      case "bt_command":
        return "BT Command";
      case "out_command":
        return "Output";
      case "mouse_keycode":
        return "Mouse Button";
      case "mouse_movement":
        return "Direction";
      case "mouse_scroll":
        return "Scroll";
      case "number":
        return "Value";
      default:
        return "Parameter";
    }
  };

  // Get param type icon
  const getParamTypeIcon = (paramType: ParamType | undefined) => {
    switch (paramType) {
      case "keycode":
        return <IconKeyboard size={16} />;
      case "layer":
        return <IconStack2 size={16} />;
      case "bt_command":
        return <IconBluetooth size={16} />;
      case "mouse_keycode":
      case "mouse_movement":
      case "mouse_scroll":
        return <IconMouse size={16} />;
      default:
        return null;
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-2xl h-[80vh] bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] shadow-2xl z-50 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
            <Dialog.Title className="text-lg font-medium text-[var(--color-text)]">
              Select Key Binding
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                className="p-2 rounded-lg hover:bg-[var(--color-border)] transition-colors"
                aria-label="Close"
              >
                <IconX size={20} className="text-[var(--color-text-muted)]" />
              </button>
            </Dialog.Close>
          </div>

          {/* Behavior Selection */}
          <div className="p-4 border-b border-[var(--color-border)]">
            {behaviors.size === 0 ? (
              <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-sm text-yellow-600">
                ⚠️ Behaviors not loaded from keyboard.
              </div>
            ) : (
              <BehaviorDropdown
                behaviors={behaviors}
                selectedBehaviorId={selectedBehavior}
                onSelect={handleBehaviorSelect}
                onQuickSelect={handleQuickSelect}
              />
            )}
          </div>

          {/* Parameter Selection */}
          {selectedBehaviorOption && needsAnyParam && (
            <div className="flex-1 flex overflow-hidden min-h-0">
              {/* Parameter Tabs (Vertical) */}
              <div className="w-24 border-r border-[var(--color-border)] p-2 flex flex-col gap-2">
                {needsParam1 && (
                  <button
                    className={`p-3 rounded-lg text-center transition-colors ${
                      activeParam === 1
                        ? "bg-[var(--color-electric)]/10 border border-[var(--color-electric)] text-[var(--color-electric)]"
                        : "bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-electric)]/50"
                    }`}
                    onClick={() => setActiveParam(1)}
                  >
                    <div className="flex justify-center mb-1">
                      {getParamTypeIcon(selectedBehaviorOption.param1Type)}
                    </div>
                    <span className="block text-xs">
                      {getParamTypeLabel(selectedBehaviorOption.param1Type)}
                    </span>
                    {param1 !== NO_PARAM_VALUE && (
                      <span className="block text-xs text-[var(--color-neon)] mt-1">
                        ✓
                      </span>
                    )}
                  </button>
                )}
                {needsParam2 && (
                  <button
                    className={`p-3 rounded-lg text-center transition-colors ${
                      activeParam === 2
                        ? "bg-[var(--color-electric)]/10 border border-[var(--color-electric)] text-[var(--color-electric)]"
                        : "bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-electric)]/50"
                    }`}
                    onClick={() => setActiveParam(2)}
                  >
                    <div className="flex justify-center mb-1">
                      {getParamTypeIcon(selectedBehaviorOption.param2Type)}
                    </div>
                    <span className="block text-xs">
                      {getParamTypeLabel(selectedBehaviorOption.param2Type)}
                    </span>
                    {param2 !== NO_PARAM_VALUE && (
                      <span className="block text-xs text-[var(--color-neon)] mt-1">
                        ✓
                      </span>
                    )}
                  </button>
                )}
              </div>

              {/* Parameter Value Selector */}
              <div className="flex-1 p-4 overflow-hidden flex flex-col">
                {activeParam === 1 && needsParam1
                  ? renderParamValueSelector(
                      selectedBehaviorOption.param1Type,
                      param1,
                      handleParam1Change
                    )
                  : activeParam === 2 && needsParam2
                    ? renderParamValueSelector(
                        selectedBehaviorOption.param2Type,
                        param2,
                        handleParam2Change
                      )
                    : null}
              </div>
            </div>
          )}

          {/* No Parameters Message */}
          {selectedBehaviorOption && !needsAnyParam && (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center">
                <div className="text-4xl mb-4">
                  {selectedBehaviorOption.category === "miscellaneous"
                    ? "✓"
                    : "⚡"}
                </div>
                <p className="text-[var(--color-text-secondary)]">
                  {selectedBehaviorOption.displayName}
                </p>
                <p className="text-sm text-[var(--color-text-muted)] mt-1">
                  No parameters needed
                </p>
              </div>
            </div>
          )}

          {/* Footer with Apply Button */}
          <div className="p-4 border-t border-[var(--color-border)]">
            <button
              className="w-full btn-electric"
              onClick={handleApply}
              disabled={selectedBehavior === null}
            >
              Apply
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
