/**
 * KeycodeSelector Component
 *
 * A modal dialog for selecting behaviors and configuring parameters.
 * Behavior-first approach: select behavior, then configure parameters.
 * Supports various parameter types with dedicated UI selectors.
 *
 * Features:
 * - Close on select: Automatically close the dialog after selecting the last parameter
 *   (setting is persisted in localStorage)
 */
import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { IconX } from "@tabler/icons-react";
import {
  MOUSE_KEYCODES,
  MOUSE_MOVEMENTS,
  MOUSE_SCROLLS,
  NO_PARAM_VALUE,
  formatKeycodeWithModifiers,
} from "../lib/keycodes";
import {
  getBehaviorMetadata,
  getBehaviorParamOptions,
  hasParam1,
  hasParam2,
  type ParamType,
} from "../lib/behaviorMetadata";
import type { BehaviorBinding, BehaviorDefinition } from "../hooks/useKeymap";
import { BehaviorDropdown, type BehaviorOption } from "./BehaviorDropdown";
import { ButtonListSelector } from "./ButtonListSelector";
import { KeycodeValueSelector } from "./KeycodeValueSelector";

// =============================================================================
// Types
// =============================================================================

interface KeycodeSelectorProps {
  open: boolean;
  onClose: () => void;
  onSelect: (binding: BehaviorBinding) => void;
  currentBinding?: BehaviorBinding | null;
  behaviors: Map<number, BehaviorDefinition>;
  layers: Array<{ id: number; name: string }>;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get human-readable label for a parameter type
 */
function getParamTypeLabel(paramType: ParamType | undefined): string {
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
}

/**
 * Get description for a parameter type
 */
function getParamTypeDescription(paramType: ParamType | undefined): string {
  switch (paramType) {
    case "keycode":
      return "Select a keycode with optional modifiers";
    case "layer":
      return "Select a layer to activate";
    case "bt_command":
      return "Select a Bluetooth command";
    case "out_command":
      return "Select output mode";
    case "mouse_keycode":
      return "Select a mouse button";
    case "mouse_movement":
      return "Select movement direction";
    case "mouse_scroll":
      return "Select scroll direction";
    case "number":
      return "Enter a numeric value";
    default:
      return "Configure parameter";
  }
}

/**
 * Format parameter value for display
 */
function formatParamValue(
  paramType: ParamType | undefined,
  value: number,
  layers: Array<{ id: number; name: string }>,
  behaviorOption: BehaviorOption | null,
  behaviors: Map<number, BehaviorDefinition>,
): string {
  if (value === NO_PARAM_VALUE && paramType !== "layer") {
    return "Not set";
  }

  switch (paramType) {
    case "keycode": {
      const formatted = formatKeycodeWithModifiers(value);
      return formatted.display;
    }
    case "layer": {
      const layer = layers.find((l) => l.id === value);
      return layer?.name || `Layer ${value}`;
    }
    case "bt_command":
    case "out_command": {
      const metadata = behaviorOption
        ? getBehaviorMetadata(
            behaviors.get(behaviorOption.id)?.displayName || "",
          )
        : null;
      const options = metadata ? getBehaviorParamOptions(metadata, 1) : null;
      const option = options?.find((o) => o.value === value);
      return option?.label || `Value ${value}`;
    }
    case "mouse_keycode": {
      const mk = MOUSE_KEYCODES.find((m) => m.value === value);
      return mk?.label || `Button ${value}`;
    }
    case "mouse_movement": {
      const mm = MOUSE_MOVEMENTS.find((m) => m.value === value);
      return mm?.label || `Direction ${value}`;
    }
    case "mouse_scroll": {
      const ms = MOUSE_SCROLLS.find((m) => m.value === value);
      return ms?.label || `Direction ${value}`;
    }
    case "number":
    default:
      return String(value);
  }
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
  const [closeOnSelect, setCloseOnSelect] = useState<boolean>(() => {
    const saved = localStorage.getItem("keycodeSelectorCloseOnSelect");
    return saved !== null ? saved === "true" : false;
  });

  // Initial values to detect changes
  const initialValuesRef = useRef<{
    behaviorId: number | null;
    param1: number;
    param2: number;
  }>({ behaviorId: null, param1: 0, param2: 0 });

  // Save closeOnSelect setting to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("keycodeSelectorCloseOnSelect", String(closeOnSelect));
  }, [closeOnSelect]);

  // Check if values have changed
  const hasChanges = useMemo(() => {
    return (
      selectedBehavior !== initialValuesRef.current.behaviorId ||
      param1 !== initialValuesRef.current.param1 ||
      param2 !== initialValuesRef.current.param2
    );
  }, [selectedBehavior, param1, param2]);

  // Get selected behavior option
  const selectedBehaviorOption = useMemo((): BehaviorOption | null => {
    if (selectedBehavior === null) return null;
    const behavior = behaviors.get(selectedBehavior);
    if (!behavior) return null;
    const metadata = getBehaviorMetadata(behavior.displayName);
    // Use metadata if available, otherwise fall back to BehaviorDefinition.metadata
    const needsParam1Value = metadata?.param1Type
      ? !!metadata.param1Type
      : hasParam1(behavior);
    const needsParam2Value = metadata?.param2Type
      ? !!metadata.param2Type
      : hasParam2(behavior);
    return {
      id: selectedBehavior,
      name: behavior.displayName,
      displayName: behavior.displayName,
      category: metadata?.category || "others",
      description: metadata?.description,
      needsParam1: needsParam1Value,
      needsParam2: needsParam2Value,
      param1Type: metadata?.param1Type,
      param2Type: metadata?.param2Type,
    };
  }, [selectedBehavior, behaviors]);

  // Check if behavior needs parameters
  const needsParam1 = selectedBehaviorOption?.needsParam1 ?? false;
  const needsParam2 = selectedBehaviorOption?.needsParam2 ?? false;
  const needsAnyParam = needsParam1 || needsParam2;

  // Handle behavior selection from dropdown
  const handleBehaviorSelect = useCallback(
    (behaviorId: number) => {
      const behavior = behaviors.get(behaviorId);
      if (!behavior) return;
      const metadata = getBehaviorMetadata(behavior.displayName);

      setSelectedBehavior(behaviorId);
      setParam1(0);
      setParam2(0);
      setActiveParam(1);

      // Check if behavior needs params using fallback
      const needsAnyParam =
        metadata?.param1Type || metadata?.param2Type
          ? !!metadata.param1Type || !!metadata.param2Type
          : hasParam1(behavior) || hasParam2(behavior);

      // If behavior doesn't need params and closeOnSelect is enabled, apply immediately
      if (closeOnSelect && !needsAnyParam) {
        onSelect({
          behaviorId,
          param1: 0,
          param2: 0,
        });
        onClose();
      }
    },
    [behaviors, closeOnSelect, onSelect, onClose],
  );

  // Handle quick-select (immediate apply for behaviors without params)
  const handleQuickSelect = useCallback(
    (behaviorId: number) => {
      const behavior = behaviors.get(behaviorId);
      if (!behavior) return;
      const metadata = getBehaviorMetadata(behavior.displayName);

      // Check if behavior needs params using fallback
      const needsAnyParam =
        metadata?.param1Type || metadata?.param2Type
          ? !!metadata.param1Type || !!metadata.param2Type
          : hasParam1(behavior) || hasParam2(behavior);

      // If behavior doesn't need params, apply immediately
      if (!needsAnyParam && closeOnSelect) {
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
    [behaviors, closeOnSelect, onSelect, onClose],
  );

  // Handle param1 change
  const handleParam1Change = useCallback(
    (value: number) => {
      setParam1(value);
      // Auto-advance to param2 if needed
      if (needsParam2) {
        setActiveParam(2);
      } else if (closeOnSelect && selectedBehavior !== null) {
        // If param1 is the last param and closeOnSelect is enabled, apply and close
        onSelect({
          behaviorId: selectedBehavior,
          param1: value,
          param2,
        });
        onClose();
      }
    },
    [needsParam2, closeOnSelect, selectedBehavior, param2, onSelect, onClose],
  );

  // Handle param2 change
  const handleParam2Change = useCallback(
    (value: number) => {
      setParam2(value);
      // If param2 is set and closeOnSelect is enabled, apply and close
      if (closeOnSelect && selectedBehavior !== null) {
        onSelect({
          behaviorId: selectedBehavior,
          param1,
          param2: value,
        });
        onClose();
      }
    },
    [closeOnSelect, selectedBehavior, param1, onSelect, onClose],
  );

  // Handle revert button click
  const handleRevert = useCallback(() => {
    setSelectedBehavior(initialValuesRef.current.behaviorId);
    setParam1(initialValuesRef.current.param1);
    setParam2(initialValuesRef.current.param2);
    setActiveParam(1);
  }, []);

  // Reset state when dialog opens
  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (isOpen) {
        // Pre-select current binding if available
        if (currentBinding) {
          setSelectedBehavior(currentBinding.behaviorId);
          setParam1(currentBinding.param1);
          setParam2(currentBinding.param2);
          // Set initial values
          initialValuesRef.current = {
            behaviorId: currentBinding.behaviorId,
            param1: currentBinding.param1,
            param2: currentBinding.param2,
          };
        } else {
          // Default to keypress behavior
          const kpMetadata = getBehaviorMetadata("kp");
          if (kpMetadata) {
            const kpBehavior = Array.from(behaviors.values()).find((b) =>
              kpMetadata.displayNameVariants.includes(b.displayName),
            );
            if (kpBehavior) {
              setSelectedBehavior(kpBehavior.id);
              // Set initial values
              initialValuesRef.current = {
                behaviorId: kpBehavior.id,
                param1: 0,
                param2: 0,
              };
            }
          }
          setParam1(0);
          setParam2(0);
        }
        setActiveParam(1);
      } else {
        // Always apply changes when closing
        if (selectedBehavior !== null) {
          onSelect({
            behaviorId: selectedBehavior,
            param1,
            param2,
          });
          // Update initial values to current values after applying
          initialValuesRef.current = {
            behaviorId: selectedBehavior,
            param1,
            param2,
          };
        }
        onClose();
      }
    },
    [
      onClose,
      currentBinding,
      behaviors,
      selectedBehavior,
      param1,
      param2,
      onSelect,
    ],
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
      onChange: (v: number) => void,
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
              }))}
              value={value}
              onChange={onChange}
              columns={Math.min(layers.length, 4)}
            />
          );

        case "bt_command": {
          const metadata = selectedBehaviorOption
            ? getBehaviorMetadata(
                behaviors.get(selectedBehaviorOption.id)?.displayName || "",
              )
            : null;
          const options = metadata
            ? getBehaviorParamOptions(metadata, 1)
            : null;
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

        case "out_command": {
          const metadata = selectedBehaviorOption
            ? getBehaviorMetadata(
                behaviors.get(selectedBehaviorOption.id)?.displayName || "",
              )
            : null;
          const options = metadata
            ? getBehaviorParamOptions(metadata, 1)
            : null;
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
    [layers, selectedBehaviorOption, behaviors],
  );

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-4xl h-[85vh] bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] shadow-2xl z-50 flex flex-col overflow-hidden">
          {/* Header with Cancel Button */}
          <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
            <Dialog.Title className="text-lg font-medium text-[var(--color-text)] flex items-center gap-2">
              Select Key Binding
            </Dialog.Title>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] cursor-pointer hover:text-[var(--color-text)] transition-colors">
                <input
                  type="checkbox"
                  checked={closeOnSelect}
                  onChange={(e) => setCloseOnSelect(e.target.checked)}
                  className="w-4 h-4 rounded border-[var(--color-border)] text-[var(--color-electric)] focus:ring-2 focus:ring-[var(--color-electric)]/50 cursor-pointer"
                />
                <span>Close on select</span>
              </label>
              {hasChanges && (
                <button
                  className="px-4 py-2 text-sm rounded-lg border border-red-400 text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2"
                  onClick={handleRevert}
                >
                  <span className="w-2 h-2 bg-red-400 rounded-full mr-2 animate-pulse"></span>
                  Revert change
                </button>
              )}
              <Dialog.Close asChild>
                <button
                  className="p-2 rounded-lg hover:bg-[var(--color-border)] transition-colors"
                  aria-label="Close"
                >
                  <IconX size={20} className="text-[var(--color-text-muted)]" />
                </button>
              </Dialog.Close>
            </div>
          </div>

          {/* Behavior Selection */}
          <div className="p-4 border-b border-[var(--color-border)]">
            <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">
              Behavior
            </label>
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

          {/* Parameter Selection - Horizontal Layout */}
          {selectedBehaviorOption && needsAnyParam && (
            <div className="flex-1 flex flex-col overflow-hidden min-h-0">
              {/* Parameters Label */}
              <div className="px-4 pt-4 pb-1">
                <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">
                  Parameters
                </label>
              </div>
              {/* Parameter Tabs (Horizontal) */}
              <div className="flex border-b border-[var(--color-border)] mx-4 mb-2">
                {needsParam1 && (
                  <button
                    className={`flex-1 p-2 text-center transition-colors border-b-2 ${
                      activeParam === 1
                        ? "border-[var(--color-electric)] text-[var(--color-electric)]"
                        : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-border)]/50"
                    }`}
                    onClick={() => setActiveParam(1)}
                  >
                    <div className="font-medium text-xs">
                      param1
                      <span className="ml-1 text-[10px] text-[var(--color-text-muted)]">
                        {getParamTypeLabel(selectedBehaviorOption.param1Type)}
                      </span>
                    </div>
                    <div
                      className={`mt-0.5 font-mono text-sm text-[var(--color-neon)] ${
                        activeParam === 1 ? "font-bold text-base" : ""
                      }`}
                    >
                      {formatParamValue(
                        selectedBehaviorOption.param1Type,
                        param1,
                        layers,
                        selectedBehaviorOption,
                        behaviors,
                      )}
                    </div>
                  </button>
                )}
                {needsParam2 && (
                  <button
                    className={`flex-1 p-2 text-center transition-colors border-b-2 ${
                      activeParam === 2
                        ? "border-[var(--color-electric)] text-[var(--color-electric)]"
                        : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-border)]/50"
                    }`}
                    onClick={() => setActiveParam(2)}
                  >
                    <div className="font-medium text-xs">
                      param2
                      <span className="ml-1 text-[10px] text-[var(--color-text-muted)]">
                        {getParamTypeLabel(selectedBehaviorOption.param2Type)}
                      </span>
                    </div>
                    <div
                      className={`mt-0.5 font-mono text-sm text-[var(--color-neon)] ${
                        activeParam === 2 ? "font-bold text-base" : ""
                      }`}
                    >
                      {formatParamValue(
                        selectedBehaviorOption.param2Type,
                        param2,
                        layers,
                        selectedBehaviorOption,
                        behaviors,
                      )}
                    </div>
                  </button>
                )}
              </div>

              {/* Parameter Description */}
              <div className="px-4 py-2 bg-[var(--color-bg)] border-b border-[var(--color-border)]">
                <p className="text-xs text-[var(--color-text-muted)]">
                  {activeParam === 1
                    ? getParamTypeDescription(selectedBehaviorOption.param1Type)
                    : getParamTypeDescription(
                        selectedBehaviorOption.param2Type,
                      )}
                </p>
              </div>

              {/* Parameter Value Selector */}
              <div className="flex-1 p-4 overflow-hidden flex flex-col">
                {activeParam === 1 && needsParam1
                  ? renderParamValueSelector(
                      selectedBehaviorOption.param1Type,
                      param1,
                      handleParam1Change,
                    )
                  : activeParam === 2 && needsParam2
                    ? renderParamValueSelector(
                        selectedBehaviorOption.param2Type,
                        param2,
                        handleParam2Change,
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
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
