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
} from "./keycodes";

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
  layers?: Layer[];
  /** Function to look up keycode by HID code */
  getKeycodeByCode?: (
    code: number,
  ) => { displayName: string; name: string } | null;
}

/**
 * Format a keycode (HID usage) with modifiers for display.
 * Returns a human-readable string representation.
 */
function formatKeycode(hidUsage: number): string {
  const modifiers = extractModifierFlags(hidUsage);
  const page = getHidUsagePage(hidUsage);
  const code = page === 0 ? hidUsage : getHidUsageCode(hidUsage);

  // Try keyboard page first
  let keycode = getKeycodeByCode(code);

  // Try consumer page if not found
  if (!keycode && (page === HID_USAGE_PAGE_CONSUMER || page === 0)) {
    keycode = getKeycodeByCode(hidUsage);
  }

  const baseName =
    keycode?.displayName || `0x${code.toString(16).toUpperCase()}`;

  // No modifiers - return just the key name
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
    getDisplayText: (binding) => {
      return formatKeycode(binding.param1);
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
      const keyName = formatKeycode(binding.param2);
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
    param1Type: "number", // Modifier flags
    param2Type: "keycode",
    getDisplayText: (binding) => {
      // Build modifier prefix from param1
      const modifiers = binding.param1;
      const modParts: string[] = [];
      MODIFIER_FLAGS.forEach((mod) => {
        if (modifiers & mod.value) {
          modParts.push(mod.shortLabel);
        }
      });
      const modPrefix = modParts.length > 0 ? modParts.join("+") : "?";
      const keyName = formatKeycode(binding.param2);
      return `MT ${modPrefix}(${keyName})`;
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
    getDisplayText: (binding) => {
      const keyName = formatKeycode(binding.param1);
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
      const movement = MOUSE_MOVEMENTS.find(
        (mm) => mm.value === binding.param1,
      );
      return movement?.label || `MMV ${binding.param1}`;
    },
    description: "Move mouse cursor",
  },
  "Mouse Scroll": {
    category: "mouse",
    displayNameVariants: ["msc", "mouse scroll", "mouse_scroll"],
    shortCode: "MSC",
    param1Type: "mouse_scroll",
    getDisplayText: (binding) => {
      const scroll = MOUSE_SCROLLS.find((ms) => ms.value === binding.param1);
      return scroll?.label || `MSC ${binding.param1}`;
    },
    description: "Scroll mouse wheel",
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
  if (binding.param1 !== 0 || binding.param2 !== 0) {
    if (binding.param2 !== 0) {
      return `${behavior.displayName} ${binding.param1} ${binding.param2}`;
    }
    return `${behavior.displayName} ${binding.param1}`;
  }

  return behavior.displayName;
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
