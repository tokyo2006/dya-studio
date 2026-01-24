/**
 * KeycodeSelector Component
 *
 * A modal dialog for selecting keycodes and configuring behaviors.
 * Provides categorized browsing and search functionality.
 */
import { useState, useMemo, useCallback, useRef } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { IconSearch, IconX } from "@tabler/icons-react";
import {
  CATEGORY_DISPLAY_NAMES,
  searchKeycodes,
  getKeycodesByCategory,
  type KeycodeCategory,
  type KeycodeDefinition,
  HID_USAGE_PAGE_KEYBOARD,
  createHidUsage,
} from "../lib/keycodes";
import type { BehaviorBinding } from "../hooks/useKeymap";
import type { BehaviorDefinition } from "../hooks/useKeymap";

// Behavior categories for organization
type BehaviorCategory = "keypress" | "layer" | "mod" | "special";

interface BehaviorOption {
  id: number;
  name: string;
  displayName: string;
  category: BehaviorCategory;
  description?: string;
  needsParam1?: boolean;
  needsParam2?: boolean;
  param1Type?: "keycode" | "layer" | "number";
  param2Type?: "keycode" | "layer" | "number";
}

interface KeycodeSelectorProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog should close */
  onClose: () => void;
  /** Callback when a binding is selected */
  onSelect: (binding: BehaviorBinding) => void;
  /** Current binding (for pre-selecting the behavior) */
  currentBinding?: BehaviorBinding | null;
  /** Available behaviors from the keyboard */
  behaviors: Map<number, BehaviorDefinition>;
  /** Available layers for layer behaviors */
  layers: Array<{ id: number; name: string }>;
}

// Predefined behavior categories
const BEHAVIOR_CATEGORIES: { id: BehaviorCategory; name: string }[] = [
  { id: "keypress", name: "Key Press" },
  { id: "layer", name: "Layers" },
  { id: "mod", name: "Modifiers" },
  { id: "special", name: "Special" },
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
  "special",
];

export function KeycodeSelector({
  open,
  onClose,
  onSelect,
  currentBinding,
  behaviors,
  layers,
}: KeycodeSelectorProps) {
  // State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] =
    useState<KeycodeCategory>("letters");
  const [selectedBehavior, setSelectedBehavior] = useState<number | null>(null);
  const [param1, setParam1] = useState<number>(0);
  const [param2, setParam2] = useState<number>(0);
  const [mode, setMode] = useState<"keycode" | "behavior">("keycode");
  
  // Ref for auto-focus on search input
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Get behavior options with categories
  const behaviorOptions = useMemo((): BehaviorOption[] => {
    const options: BehaviorOption[] = [];

    behaviors.forEach((behavior, id) => {
      const name = behavior.displayName.toLowerCase();

      // Categorize behaviors based on exact or prefix match
      // ZMK uses display names like "Key Press", "Momentary Layer", "To Layer", etc.
      let category: BehaviorCategory = "special";

      // Key press behaviors
      if (name === "key press" || name === "kp" || name === "key_press" || name.startsWith("key")) {
        category = "keypress";
      }
      // Layer behaviors - match exact names or prefixes
      else if (
        name === "momentary layer" ||
        name === "to layer" ||
        name === "toggle layer" ||
        name === "layer-tap" ||
        name === "mo" ||
        name === "to" ||
        name === "lt" ||
        name === "tog" ||
        name === "sl" ||
        name === "momentary" ||
        name === "toggle" ||
        name === "layer_tap" ||
        name.includes("layer")
      ) {
        category = "layer";
      }
      // Modifier behaviors
      else if (
        name === "mod-tap" ||
        name === "sticky key" ||
        name === "mt" ||
        name === "sk" ||
        name === "mod_tap" ||
        name === "sticky_key" ||
        name.includes("mod") ||
        name.includes("sticky")
      ) {
        category = "mod";
      }

      // Determine parameter types
      let needsParam1 = false;
      let needsParam2 = false;
      let param1Type: BehaviorOption["param1Type"];
      let param2Type: BehaviorOption["param2Type"];

      if (behavior.metadata.length > 0) {
        const meta = behavior.metadata[0];
        if (meta.param1?.length > 0) {
          needsParam1 = true;
          const p1 = meta.param1[0];
          if (p1.hidUsage) {
            param1Type = "keycode";
          } else if (p1.layerId) {
            param1Type = "layer";
          } else {
            param1Type = "number";
          }
        }
        if (meta.param2?.length > 0) {
          needsParam2 = true;
          const p2 = meta.param2[0];
          if (p2.hidUsage) {
            param2Type = "keycode";
          } else if (p2.layerId) {
            param2Type = "layer";
          } else {
            param2Type = "number";
          }
        }
      }

      options.push({
        id,
        name: behavior.displayName,
        displayName: behavior.displayName,
        category,
        needsParam1,
        needsParam2,
        param1Type,
        param2Type,
      });
    });

    return options.sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [behaviors]);

  // Get filtered keycodes
  const filteredKeycodes = useMemo((): KeycodeDefinition[] => {
    if (searchQuery.trim()) {
      return searchKeycodes(searchQuery);
    }
    return getKeycodesByCategory(selectedCategory);
  }, [searchQuery, selectedCategory]);

  // Get selected behavior option
  const selectedBehaviorOption = useMemo(() => {
    if (selectedBehavior === null) return null;
    return behaviorOptions.find((b) => b.id === selectedBehavior) ?? null;
  }, [selectedBehavior, behaviorOptions]);

  // Handle keycode selection
  const handleKeycodeSelect = useCallback(
    (keycode: KeycodeDefinition) => {
      // Find the key_press behavior
      // ZMK's behavior display name is "Key Press"
      const kpBehavior = behaviorOptions.find(
        (b) =>
          b.displayName.toLowerCase() === "key press" ||
          b.displayName.toLowerCase() === "kp" ||
          b.displayName.toLowerCase() === "key_press"
      );

      if (kpBehavior) {
        // Check if keycode already has a usage page (upper 16 bits)
        // Consumer keycodes are already full HID usage values
        const param1 = keycode.code > 0xffff
          ? keycode.code  // Already a full HID usage
          : createHidUsage(HID_USAGE_PAGE_KEYBOARD, keycode.code);  // Add keyboard page
        
        onSelect({
          behaviorId: kpBehavior.id,
          param1,
          param2: 0,
        });
        onClose();
      } else if (behaviorOptions.length > 0) {
        // Fallback: No kp behavior found but we have other behaviors
        // This shouldn't normally happen if behaviors are loaded correctly
        console.warn("Key press behavior not found. Using first available behavior:", behaviorOptions[0].displayName);
        const firstBehavior = behaviorOptions[0];
        onSelect({
          behaviorId: firstBehavior.id,
          param1: createHidUsage(HID_USAGE_PAGE_KEYBOARD, keycode.code),
          param2: 0,
        });
        onClose();
      } else {
        // No behaviors available at all - don't close, let user see the warning
        console.error("No behaviors available. Cannot select keycode.");
      }
    },
    [behaviorOptions, onSelect, onClose]
  );

  // Handle behavior selection
  const handleBehaviorSelect = useCallback((behaviorId: number) => {
    setSelectedBehavior(behaviorId);
    setParam1(0);
    setParam2(0);
  }, []);

  // Handle applying the behavior
  const handleApplyBehavior = useCallback(() => {
    if (selectedBehavior === null) return;

    onSelect({
      behaviorId: selectedBehavior,
      param1,
      param2,
    });
    onClose();
  }, [selectedBehavior, param1, param2, onSelect, onClose]);

  // Handle transparent key selection
  const handleTransparent = useCallback(() => {
    const transBehavior = behaviorOptions.find(
      (b) =>
        b.displayName.toLowerCase() === "trans" ||
        b.displayName.toLowerCase() === "transparent"
    );

    if (transBehavior) {
      onSelect({
        behaviorId: transBehavior.id,
        param1: 0,
        param2: 0,
      });
    }
    onClose();
  }, [behaviorOptions, onSelect, onClose]);

  // Handle none key selection
  const handleNone = useCallback(() => {
    const noneBehavior = behaviorOptions.find(
      (b) => b.displayName.toLowerCase() === "none"
    );

    if (noneBehavior) {
      onSelect({
        behaviorId: noneBehavior.id,
        param1: 0,
        param2: 0,
      });
    }
    onClose();
  }, [behaviorOptions, onSelect, onClose]);

  // Reset state when dialog opens and pre-select current binding
  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (isOpen) {
        setSearchQuery("");
        setSelectedCategory("letters");
        
        // Pre-select current binding if available
        if (currentBinding) {
          setSelectedBehavior(currentBinding.behaviorId);
          setParam1(currentBinding.param1);
          setParam2(currentBinding.param2);
          
          // Determine if we should start in behavior mode
          const behavior = behaviors.get(currentBinding.behaviorId);
          if (behavior) {
            const name = behavior.displayName.toLowerCase();
            // If not a simple keypress, start in behavior mode
            if (name !== "key press" && name !== "kp" && name !== "key_press") {
              setMode("behavior");
            } else {
              setMode("keycode");
            }
          }
        } else {
          setSelectedBehavior(null);
          setParam1(0);
          setParam2(0);
          setMode("keycode");
        }
        
        // Auto-focus search input after a short delay
        setTimeout(() => {
          searchInputRef.current?.focus();
        }, 100);
      } else {
        onClose();
      }
    },
    [onClose, currentBinding, behaviors]
  );

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-3xl h-[85vh] bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] shadow-2xl z-50 flex flex-col overflow-hidden">
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

          {/* Mode Tabs */}
          <div className="flex border-b border-[var(--color-border)]">
            <button
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                mode === "keycode"
                  ? "text-[var(--color-electric)] border-b-2 border-[var(--color-electric)]"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
              }`}
              onClick={() => setMode("keycode")}
            >
              Keycodes
            </button>
            <button
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                mode === "behavior"
                  ? "text-[var(--color-electric)] border-b-2 border-[var(--color-electric)]"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
              }`}
              onClick={() => setMode("behavior")}
            >
              Behaviors
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {/* Warning if no behaviors loaded */}
            {behaviors.size === 0 && (
              <div className="p-4 bg-yellow-500/10 border-b border-yellow-500/30 text-sm text-yellow-600">
                ⚠️ Behaviors not loaded from keyboard. Key selection may not work properly.
              </div>
            )}
            
            {mode === "keycode" ? (
              <>
                {/* Search */}
                <div className="p-4 border-b border-[var(--color-border)]">
                  <div className="relative">
                    <IconSearch
                      size={18}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
                    />
                    <input
                      ref={searchInputRef}
                      type="text"
                      placeholder="Search keycodes..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-electric)]/50"
                    />
                  </div>
                </div>

                {/* Categories and Keycodes */}
                <div className="flex-1 flex overflow-hidden">
                  {/* Category List */}
                  {!searchQuery && (
                    <div className="w-36 border-r border-[var(--color-border)] overflow-y-auto">
                      {KEYCODE_CATEGORY_ORDER.map((category) => (
                        <button
                          key={category}
                          className={`w-full px-3 py-2 text-left text-sm transition-colors ${
                            selectedCategory === category
                              ? "bg-[var(--color-electric)]/10 text-[var(--color-electric)] border-r-2 border-[var(--color-electric)]"
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
                  <div className="flex-1 overflow-y-auto p-4">
                    {/* Quick Actions */}
                    <div className="flex gap-2 mb-4">
                      <button
                        className="px-3 py-1.5 rounded-lg text-sm bg-[var(--color-border)] hover:bg-[var(--color-border-hover)] text-[var(--color-text-secondary)] transition-colors"
                        onClick={handleTransparent}
                      >
                        Transparent
                      </button>
                      <button
                        className="px-3 py-1.5 rounded-lg text-sm bg-[var(--color-border)] hover:bg-[var(--color-border-hover)] text-[var(--color-text-secondary)] transition-colors"
                        onClick={handleNone}
                      >
                        None
                      </button>
                    </div>

                    {/* Keycodes Grid */}
                    <div className="grid grid-cols-6 gap-2">
                      {filteredKeycodes.map((keycode) => (
                        <button
                          key={`${keycode.category}-${keycode.code}`}
                          className="p-2 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] hover:border-[var(--color-electric)]/50 hover:bg-[var(--color-electric)]/5 transition-colors text-center"
                          onClick={() => handleKeycodeSelect(keycode)}
                          title={keycode.name}
                        >
                          <span className="block text-sm font-medium text-[var(--color-text)]">
                            {keycode.displayName}
                          </span>
                          <span className="block text-xs text-[var(--color-text-muted)] truncate">
                            {keycode.name !== keycode.displayName
                              ? keycode.name
                              : ""}
                          </span>
                        </button>
                      ))}
                    </div>

                    {filteredKeycodes.length === 0 && (
                      <div className="text-center py-8 text-[var(--color-text-muted)]">
                        No keycodes found
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              /* Behavior Mode */
              <div className="flex-1 flex overflow-hidden">
                {/* Behavior Categories */}
                <div className="w-36 border-r border-[var(--color-border)] overflow-y-auto">
                  {BEHAVIOR_CATEGORIES.map((category) => (
                    <button
                      key={category.id}
                      className={`w-full px-3 py-2 text-left text-sm transition-colors ${
                        selectedBehaviorOption?.category === category.id
                          ? "bg-[var(--color-electric)]/10 text-[var(--color-electric)]"
                          : "text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]"
                      }`}
                      onClick={() => {
                        const firstInCategory = behaviorOptions.find(
                          (b) => b.category === category.id
                        );
                        if (firstInCategory) {
                          handleBehaviorSelect(firstInCategory.id);
                        }
                      }}
                    >
                      {category.name}
                    </button>
                  ))}
                </div>

                {/* Behavior List and Configuration */}
                <div className="flex-1 flex flex-col overflow-hidden">
                  {/* Behavior List */}
                  <div className="flex-1 overflow-y-auto p-4">
                    <div className="space-y-2">
                      {behaviorOptions.map((behavior) => (
                        <button
                          key={behavior.id}
                          className={`w-full p-3 rounded-lg text-left transition-colors ${
                            selectedBehavior === behavior.id
                              ? "bg-[var(--color-electric)]/10 border border-[var(--color-electric)]/30"
                              : "bg-[var(--color-bg)] border border-[var(--color-border)] hover:border-[var(--color-electric)]/30"
                          }`}
                          onClick={() => handleBehaviorSelect(behavior.id)}
                        >
                          <span className="block text-sm font-medium text-[var(--color-text)]">
                            {behavior.displayName}
                          </span>
                          {behavior.description && (
                            <span className="block text-xs text-[var(--color-text-muted)]">
                              {behavior.description}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Parameter Configuration */}
                  {selectedBehaviorOption && (
                    <div className="border-t border-[var(--color-border)] p-4">
                      <h4 className="text-sm font-medium text-[var(--color-text)] mb-3">
                        Configure: {selectedBehaviorOption.displayName}
                      </h4>

                      <div className="space-y-3">
                        {/* Parameter 1 */}
                        {selectedBehaviorOption.needsParam1 && (
                          <div>
                            <label className="block text-xs text-[var(--color-text-muted)] mb-1">
                              Parameter 1
                              {selectedBehaviorOption.param1Type === "layer" &&
                                " (Layer)"}
                            </label>
                            {selectedBehaviorOption.param1Type === "layer" ? (
                              <select
                                value={param1}
                                onChange={(e) =>
                                  setParam1(Number(e.target.value))
                                }
                                className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text)]"
                              >
                                {layers.map((layer) => (
                                  <option key={layer.id} value={layer.id}>
                                    {layer.name || `Layer ${layer.id}`}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <input
                                type="number"
                                value={param1}
                                onChange={(e) =>
                                  setParam1(Number(e.target.value))
                                }
                                className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text)]"
                              />
                            )}
                          </div>
                        )}

                        {/* Parameter 2 */}
                        {selectedBehaviorOption.needsParam2 && (
                          <div>
                            <label className="block text-xs text-[var(--color-text-muted)] mb-1">
                              Parameter 2
                              {selectedBehaviorOption.param2Type === "layer" &&
                                " (Layer)"}
                            </label>
                            {selectedBehaviorOption.param2Type === "layer" ? (
                              <select
                                value={param2}
                                onChange={(e) =>
                                  setParam2(Number(e.target.value))
                                }
                                className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text)]"
                              >
                                {layers.map((layer) => (
                                  <option key={layer.id} value={layer.id}>
                                    {layer.name || `Layer ${layer.id}`}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <input
                                type="number"
                                value={param2}
                                onChange={(e) =>
                                  setParam2(Number(e.target.value))
                                }
                                className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text)]"
                              />
                            )}
                          </div>
                        )}

                        <button
                          className="w-full btn-electric"
                          onClick={handleApplyBehavior}
                        >
                          Apply
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
