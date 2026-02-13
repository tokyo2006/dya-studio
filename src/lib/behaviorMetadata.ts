/**
 * Behavior Metadata Registry
 *
 * Centralizes behavior displayName handling and categorization.
 * Provides utilities for formatting behavior bindings for UI display.
 */
import type {
  BehaviorBinding,
  BehaviorDefinition,
  Layer,
} from "../hooks/useKeymap";
import {
  getKeycodeByCode,
  getHidUsageCode,
  getHidUsagePage,
  HID_USAGE_PAGE_CONSUMER,
  extractModifierFlags,
  MODIFIER_FLAGS,
  MOUSE_KEYCODES,
  MOUSE_MOVEMENTS,
  MOUSE_SCROLLS,
  dropModifierFlags,
  decodeMouseMove,
} from "./keycodes";
import { getLayoutDisplayName } from "./keyboardLayouts";

/**
 * Category types for organizing behaviors
 */
export type BehaviorCategory =
  | "keypress" // Basic key input
  | "layer" // Layer switching/activation
  | "mod" // Modifiers and mod-tap
  | "bluetooth" // BT profile management
  | "system" // Reset, bootloader
  | "output" // Output selection (USB/BLE)
  | "miscellaneous" // Trans, none, macro, etc
  | "media" // Media controls (if supported)
  | "mouse" // Mouse controls
  | "others";

/**
 * Parameter type definitions
 */
export type ParamType =
  | "keycode" // HID usage code
  | "layer" // Layer ID
  | "number" // Generic number
  | "bt_command" // BT command (0=CLR, 1=NXT, etc)
  | "out_command" // Output command (0=TOG, 1=USB, 2=BLE)
  | "mouse_keycode" // Mouse keycode (LCK, RCLK, ...)
  | "mouse_movement" // Mouse movement (X/Y deltas)
  | "mouse_scroll"; // Mouse scroll (vertical/horizontal)

/**
 * Parameter-dependent operation mapping
 */
export interface ParamValueMapping {
  /** Maps param value to display string */
  [paramValue: number]: string;
}

/**
 * Context for formatting behavior bindings
 */
export interface FormatContext {
  /** Available layers for resolving layer names */
  layers?: (Omit<Layer, "bindings"> & Partial<Pick<Layer, "bindings">>)[];
  /** Keyboard layout for localized keycode display */
  keyboardLayout?: import("./keyboardLayouts").KeyboardLayoutType;
}

/**
 * Format a keycode (HID usage) with modifiers for display.
 * Returns a human-readable string representation.
 */
function formatKeycode(
  hidUsage: number,
  keyboardLayout?: import("./keyboardLayouts").KeyboardLayoutType,
): string {
  const modifiers = extractModifierFlags(hidUsage);
  const hidUsageWithoutModifiers = dropModifierFlags(hidUsage);
  const page = getHidUsagePage(hidUsage);
  const code =
    page === 0 ? hidUsageWithoutModifiers : getHidUsageCode(hidUsage);

  // Try keyboard page first
  let keycode = getKeycodeByCode(code);

  // Try consumer page if not found
  if (!keycode && (page === HID_USAGE_PAGE_CONSUMER || page === 0)) {
    keycode = getKeycodeByCode(hidUsageWithoutModifiers);
  }

  // Apply keyboard layout override
  let displayName =
    keycode?.displayName || `0x${code.toString(16).toUpperCase()}`;
  if (keyboardLayout) {
    const layoutDisplayName = getLayoutDisplayName(code, keyboardLayout);
    if (layoutDisplayName) {
      displayName = layoutDisplayName;
    }
  }

  // Format with modifiers
  if (modifiers === 0) {
    return displayName;
  }

  // Build modifier prefix
  const modParts: string[] = [];
  MODIFIER_FLAGS.forEach((mod) => {
    if (modifiers & mod.value) {
      modParts.push(mod.shortLabel);
    }
  });
  const modPrefix = modParts.join("+");
  return `${modPrefix}(${displayName})`;
}

/**
 * Metadata for a behavior definition
 */
export interface BehaviorMetadata {
  /** Behavior category for organization */
  category: BehaviorCategory;

  /** All known displayName variants (for matching) */
  displayNameVariants: string[];

  /** Short code for compact UI display */
  shortCode: string;

  /** Type of param1 if used */
  param1Type?: ParamType;

  /** Type of param2 if used */
  param2Type?: ParamType;

  /**
   * Mapping for param1 values (for behaviors where param changes operation)
   * e.g., BT behavior: {0: "CLR", 1: "NXT", ...}
   */
  param1ValueMap?: ParamValueMapping;

  /** Mapping for param2 values if applicable */
  param2ValueMap?: ParamValueMapping;

  /**
   * Custom formatter for display text
   * Handles complex cases like layer names, keycode lookups, etc.
   */
  getDisplayText?: (
    binding: BehaviorBinding,
    context: FormatContext,
    metadata: BehaviorMetadata,
  ) => string;

  /** Human-readable description */
  description?: string;
}

/**
 * Behavior metadata registry
 * Maps from EXACT displayName (case-sensitive keys, but lookup is case-insensitive) to metadata
 */
const BEHAVIOR_METADATA_BASE: Record<string, BehaviorMetadata> = {
  // ============================================================================
  // Key Press Behaviors
  // ============================================================================
  "Key Press": {
    category: "keypress",
    displayNameVariants: ["Key Press", "kp", "key_press"],
    shortCode: "KP",
    param1Type: "keycode",
    getDisplayText: (binding, context) => {
      return formatKeycode(binding.param1, context.keyboardLayout);
    },
    description: "Press a key",
  },

  // ============================================================================
  // Layer Behaviors
  // ============================================================================
  "Momentary Layer": {
    category: "layer",
    displayNameVariants: ["Momentary Layer", "mo", "momentary"],
    shortCode: "MO",
    param1Type: "layer",
    getDisplayText: (binding, context) => {
      const layerNum = binding.param1;
      if (context.layers && context.layers[layerNum]) {
        return `MO ${context.layers[layerNum].name || layerNum}`;
      }
      return `MO ${layerNum}`;
    },
    description: "Activate layer while held",
  },

  "To Layer": {
    category: "layer",
    displayNameVariants: ["To Layer", "to"],
    shortCode: "TO",
    param1Type: "layer",
    getDisplayText: (binding, context) => {
      const layerNum = binding.param1;
      if (context.layers && context.layers[layerNum]) {
        return `TO ${context.layers[layerNum].name || layerNum}`;
      }
      return `TO ${layerNum}`;
    },
    description: "Switch to layer",
  },

  "Toggle Layer": {
    category: "layer",
    displayNameVariants: ["Toggle Layer", "tog", "toggle"],
    shortCode: "TG",
    param1Type: "layer",
    getDisplayText: (binding, context) => {
      const layerNum = binding.param1;
      if (context.layers && context.layers[layerNum]) {
        return `TG ${context.layers[layerNum].name || layerNum}`;
      }
      return `TG ${layerNum}`;
    },
    description: "Toggle layer on/off",
  },

  "Layer-Tap": {
    category: "layer",
    displayNameVariants: ["Layer-Tap", "lt", "layer_tap"],
    shortCode: "LT",
    param1Type: "layer",
    param2Type: "keycode",
    getDisplayText: (binding, context) => {
      const layerNum = binding.param1;
      const layerName = context.layers?.[layerNum]?.name || layerNum;
      const keyName = formatKeycode(binding.param2, context.keyboardLayout);
      return `LT${layerName} ${keyName}`;
    },
    description: "Layer on hold, key on tap",
  },
  // ============================================================================
  // Miscellaneous Behaviors
  // ============================================================================
  trans: {
    category: "miscellaneous",
    displayNameVariants: ["trans", "Transparent"],
    shortCode: "▽",
    getDisplayText: () => "▽",
    description: "Transparent (pass-through to lower layer)",
  },

  none: {
    category: "miscellaneous",
    displayNameVariants: ["None"],
    shortCode: "✕",
    getDisplayText: () => "✕",
    description: "No operation",
  },

  // ============================================================================
  // Modifier Behaviors
  // ============================================================================
  "Mod-Tap": {
    category: "mod",
    displayNameVariants: ["Mod-Tap", "mt", "mod_tap"],
    shortCode: "MT",
    param1Type: "keycode",
    param2Type: "keycode",
    getDisplayText: (binding, context) => {
      const param1 = formatKeycode(binding.param1, context.keyboardLayout);
      const param2 = formatKeycode(binding.param2, context.keyboardLayout);
      return `MT ${param1} ${param2}`;
    },
    description: "Modifier on hold, key on tap",
  },
  // Leyer tap is defined above in Layer Behaviors
  // Mod morph does not have pre-defined behavior

  // ============================================================================
  // Macro Behavior
  // ============================================================================
  macro: {
    category: "miscellaneous",
    displayNameVariants: ["macro"],
    shortCode: "Macro",
    getDisplayText: () => "Macro",
    description: "Execute macro",
  },

  // TODO: key toggle

  "Sticky Key": {
    category: "mod",
    displayNameVariants: ["Sticky Key", "sk", "sticky_key"],
    shortCode: "SK",
    param1Type: "keycode",
    getDisplayText: (binding, context) => {
      const keyName = formatKeycode(binding.param1, context.keyboardLayout);
      return `SK ${keyName}`;
    },
    description: "Sticky modifier key",
  },
  // TODO: Sticky Layer
  // Tap Dance does not have pre-defined behavior
  // TODO: caps word?
  // TODO: keyrepeat?
  // TODO: support sensor and sensor rotation
  // TODO: support mouse behaviors
  "Mouse Key Press": {
    category: "mouse",
    displayNameVariants: ["mkp", "mouse key press"],
    shortCode: "MKP",
    param1Type: "mouse_keycode",
    getDisplayText: (binding) => {
      const mouseKey = MOUSE_KEYCODES.find((mk) => mk.value === binding.param1);
      return mouseKey?.shortLabel || `MKP ${binding.param1}`;
    },
    description: "Mouse key press",
  },
  "Mouse Move": {
    category: "mouse",
    displayNameVariants: ["mmv", "mouse move", "mouse_move"],
    shortCode: "MMV",
    param1Type: "mouse_movement",
    getDisplayText: (binding) => {
      // Check if it matches a preset
      const movement = MOUSE_MOVEMENTS.find(
        (mm) => mm.value === binding.param1,
      );
      if (movement) {
        return `MMV ${movement.shortLabel}`;
      }
      // Otherwise, decode and show X/Y values
      const { x, y } = decodeMouseMove(binding.param1);
      return `MMV X${x} Y${y}`;
    },
    description:
      "Move mouse cursor. Param1 encodes X/Y deltas (upper 16 bits = X, lower 16 bits = Y)",
  },
  "Mouse Scroll": {
    category: "mouse",
    displayNameVariants: ["msc", "mouse scroll", "mouse_scroll"],
    shortCode: "MSC",
    param1Type: "mouse_scroll",
    getDisplayText: (binding) => {
      // Check if it matches a preset
      const scroll = MOUSE_SCROLLS.find((ms) => ms.value === binding.param1);
      if (scroll) {
        return `MSC ${scroll.shortLabel}`;
      }
      // Otherwise, decode and show X/Y values
      const { x, y } = decodeMouseMove(binding.param1);
      return `MSC X${x} Y${y}`;
    },
    description:
      "Scroll mouse wheel. Param1 encodes X/Y deltas (upper 16 bits = X, lower 16 bits = Y)",
  },
  // ============================================================================
  // System Behaviors
  // ============================================================================
  bootloader: {
    category: "system",
    displayNameVariants: ["bootloader"],
    shortCode: "Boot",
    getDisplayText: () => "Boot",
    description: "Enter bootloader mode",
  },

  sys_reset: {
    category: "system",
    displayNameVariants: ["sys_reset", "reset"],
    shortCode: "Reset",
    getDisplayText: () => "Reset",
    description: "System reset",
  },

  // ============================================================================
  // Bluetooth Behaviors (param1-dependent)
  // ============================================================================
  bt: {
    category: "bluetooth",
    displayNameVariants: ["bt", "bluetooth"],
    shortCode: "BT",
    param1Type: "bt_command",
    param1ValueMap: {
      0: "CLR",
      1: "NXT",
      2: "PRV",
      3: "SEL 0",
      4: "SEL 1",
      5: "SEL 2",
      6: "SEL 3",
      7: "SEL 4",
    },
    getDisplayText: (binding, _context, metadata) => {
      const cmd =
        metadata.param1ValueMap?.[binding.param1] || binding.param1.toString();
      return `BT ${cmd}`;
    },
    description: "Bluetooth profile management",
  },

  // ============================================================================
  // Output Selection Behaviors (param1-dependent)
  // ============================================================================
  out: {
    category: "output",
    displayNameVariants: ["out", "output", "output selection"],
    shortCode: "OUT",
    param1Type: "out_command",
    param1ValueMap: {
      0: "TOG",
      1: "USB",
      2: "BLE",
    },
    getDisplayText: (binding, _context, metadata) => {
      const cmd =
        metadata.param1ValueMap?.[binding.param1] || binding.param1.toString();
      return `OUT ${cmd}`;
    },
    description: "Output selection (USB/BLE)",
  },
  // TODO: RGB Underglow
  // TODO: Backlight
  // TODO: Power management
  // TODO: Softoff
  // TODO: ZMK Studio unlock
};

/**
 * Expanded metadata registry with all variants as keys
 * This allows O(1) lookup by any displayName variant
 */
const BEHAVIOR_METADATA: Record<string, BehaviorMetadata> = {};

// Populate the registry with all variants pointing to the same metadata
Object.values(BEHAVIOR_METADATA_BASE).forEach((metadata) => {
  metadata.displayNameVariants.forEach((variant) => {
    BEHAVIOR_METADATA[variant.toLowerCase()] = metadata;
  });
});

/**
 * Get behavior metadata by displayName (case-insensitive)
 */
export function getBehaviorMetadata(
  displayName: string,
): BehaviorMetadata | null {
  const normalized = displayName.toLowerCase();
  return BEHAVIOR_METADATA[normalized] || null;
}

/**
 * Check if a behavior has param1 based on BehaviorDefinition metadata
 * Falls back to checking BehaviorDefinition.metadata if getBehaviorMetadata returns null
 */
export function hasParam1(behavior: BehaviorDefinition): boolean {
  const metadata = getBehaviorMetadata(behavior.displayName);
  if (metadata) {
    return !!metadata.param1Type;
  }
  // Fallback: check BehaviorDefinition.metadata
  return behavior.metadata.length > 0 && behavior.metadata[0].param1.length > 0;
}

/**
 * Check if a behavior has param2 based on BehaviorDefinition metadata
 * Falls back to checking BehaviorDefinition.metadata if getBehaviorMetadata returns null
 */
export function hasParam2(behavior: BehaviorDefinition): boolean {
  const metadata = getBehaviorMetadata(behavior.displayName);
  if (metadata) {
    return !!metadata.param2Type;
  }
  // Fallback: check BehaviorDefinition.metadata
  return behavior.metadata.length > 0 && behavior.metadata[0].param2.length > 0;
}

/**
 * Find a behavior by category
 * Returns the first matching behavior definition
 */
export function findBehaviorByCategory(
  behaviors: Map<number, BehaviorDefinition>,
  category: BehaviorCategory,
): BehaviorDefinition | null {
  for (const behavior of behaviors.values()) {
    const metadata = getBehaviorMetadata(behavior.displayName);
    if (metadata && metadata.category === category) {
      return behavior;
    }
  }
  return null;
}

/**
 * Find a behavior by predicate function
 */
export function findBehaviorByPredicate(
  behaviors: Map<number, BehaviorDefinition>,
  predicate: (
    metadata: BehaviorMetadata | null,
    behavior: BehaviorDefinition,
  ) => boolean,
): BehaviorDefinition | null {
  for (const behavior of behaviors.values()) {
    const metadata = getBehaviorMetadata(behavior.displayName);
    if (predicate(metadata, behavior)) {
      return behavior;
    }
  }
  return null;
}

/**
 * Format a behavior binding for display
 * Returns a human-readable string representation
 */
export function formatBehaviorBinding(
  binding: BehaviorBinding | undefined,
  behavior: BehaviorDefinition | null,
  context: FormatContext = {},
): string {
  if (!binding || !behavior) {
    return "—";
  }

  const metadata = getBehaviorMetadata(behavior.displayName);

  if (metadata?.getDisplayText) {
    return metadata.getDisplayText(binding, context, metadata);
  }

  // Fallback: use behavior display name with params if present
  if (binding.param1 !== 0) {
    const param1 = formatBehaviorParam(
      getBehaviorParamInfo(behavior, 1),
      binding.param1,
      context,
    );
    if (binding.param2 !== 0) {
      const param2 = formatBehaviorParam(
        getBehaviorParamInfo(behavior, 2),
        binding.param2,
        context,
      );
      return `${behavior.displayName} ${param1} ${param2}`;
    }
    return `${behavior.displayName} ${param1}`;
  } else if (binding.param2 !== 0) {
    const param2 = formatBehaviorParam(
      getBehaviorParamInfo(behavior, 2),
      binding.param2,
      context,
    );
    return `${behavior.displayName} ${param2}`;
  }

  return behavior.displayName;
}

export function formatBehaviorParam(
  paramInfo: BehaviorParameterInfo | null,
  value: number,
  context: FormatContext,
): string {
  if (!paramInfo) {
    return value.toString();
  }
  switch (paramInfo.type) {
    case "nil":
      return "";
    case "hidUsage":
      return formatKeycode(value, context.keyboardLayout);
    case "layerId":
      return context.layers?.[value]?.name || `Layer ${value}`;
    case "constant":
    case "range":
    default:
      return value.toString();
  }
}

/**
 * Get parameter options for a behavior metadata
 * Used to generate dropdown options for param1/param2 selection
 */
export function getBehaviorParamOptions(
  metadata: BehaviorMetadata,
  paramNumber: 1 | 2,
): Array<{ value: number; label: string }> | null {
  const valueMap =
    paramNumber === 1 ? metadata.param1ValueMap : metadata.param2ValueMap;

  if (!valueMap) {
    return null;
  }

  return Object.entries(valueMap).map(([value, label]) => ({
    value: Number(value),
    label,
  }));
}

/**
 * Get all behaviors grouped by category
 */
export function groupBehaviorsByCategory(
  behaviors: Map<number, BehaviorDefinition>,
): Map<BehaviorCategory, BehaviorDefinition[]> {
  const grouped = new Map<BehaviorCategory, BehaviorDefinition[]>();

  behaviors.forEach((behavior) => {
    const metadata = getBehaviorMetadata(behavior.displayName);
    const category = metadata?.category || "others";

    if (!grouped.has(category)) {
      grouped.set(category, []);
    }
    grouped.get(category)!.push(behavior);
  });

  return grouped;
}

/**
 * Parameter type from BehaviorDefinition metadata
 */
export type BehaviorParameterInfo =
  | { type: "nil" }
  | { type: "constant"; value: number }
  | { type: "range"; min: number; max: number }
  | { type: "hidUsage"; keyboardMax: number; consumerMax: number }
  | { type: "layerId" };

/**
 * Get parameter information from BehaviorDefinition
 * Returns the parameter type and constraints for a specific parameter
 */
export function getBehaviorParamInfo(
  behavior: BehaviorDefinition,
  paramNumber: 1 | 2,
): BehaviorParameterInfo | null {
  if (behavior.metadata.length === 0) {
    return null;
  }

  const paramSet = behavior.metadata[0];
  const params = paramNumber === 1 ? paramSet.param1 : paramSet.param2;

  if (!params || params.length === 0) {
    return null;
  }

  // Use the first parameter description
  const param = params[0];

  if (param.nil) {
    return { type: "nil" };
  }
  if (param.constant !== undefined) {
    return { type: "constant", value: param.constant };
  }
  if (param.range) {
    return {
      type: "range",
      min: param.range.min,
      max: param.range.max,
    };
  }
  if (param.hidUsage) {
    return {
      type: "hidUsage",
      keyboardMax: param.hidUsage.keyboardMax,
      consumerMax: param.hidUsage.consumerMax,
    };
  }
  if (param.layerId !== undefined) {
    return { type: "layerId" };
  }

  return null;
}
