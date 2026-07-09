// Bundled definitions for ZMK's standard (built-in) behaviors, so the fast
// client (fastKeymap.ts) can resolve a behavior's alias/display-name/param
// metadata WITHOUT round-tripping `get_behaviors` to the device -- see
// DESIGN.md SS2 "Bundled standard definitions" / SS5. Indexed by **def_fp**
// (§4/§5) -- content-addressed, so a bundle entry only ever resolves a
// behavior whose alias/display_name/metadata are byte-identical to what the
// device would serve; `bundledByDefFp()` is the lookup.
//
// Values here were read directly off the ZMK source this module vendors at
// `dependencies/zmk/app/src/behaviors/*.c` (metadata) and
// `dependencies/zmk/app/dts/behaviors/*.dtsi` (alias/display-name), NOT
// guessed. Two families of exceptions -- kept anyway per DESIGN.md's
// "being incomplete is OK; a bundle mismatch just costs an extra fetch":
//
// 1. HID_USAGE keyboard/consumer max usage (kp/kt/mt/lt/sk) and the BT `sl`
//    profile-count range depend on the *firmware's* Kconfig (NKRO vs HKRO,
//    consumer-report basic/full, CONFIG_BT_MAX_PAIRED) -- values that vary
//    per board and are NOT knowable from the web bundle alone. The
//    constants below are ZMK's Kconfig-implicit defaults (first choice
//    entry when no `default` is set: HKRO / full consumer report) and a
//    common `CONFIG_BT_MAX_PAIRED=5`. Boards that configure differently
//    will simply def_fp-miss and fall back to `get_behaviors` -- correct,
//    just not fast for that one behavior.
// 2. `sk`/`sl` (behavior_sticky_key.c) and `mt`/`lt` (behavior_hold_tap.c)
//    compute their metadata dynamically from their *bound* child
//    behavior(s) at runtime (`sk` binds `&kp`, `sl` binds `&mo`, `mt` binds
//    `&kp`+`&kp`, `lt` binds `&mo`+`&kp` -- see their .dtsi defaults). The
//    entries below hard-code that default wiring; a keymap that rebinds
//    e.g. `sk`'s child behavior would change its def_fp and miss the
//    bundle (falls back to fetch, still correct).
//
// Coverage vs. the firmware's `fk_builtin_name_fps[]`
// (src/behavior_alias.c -- the authoritative "standard" list): every
// entry there is bundled below EXCEPT the ten `zmk,macro-control-*`
// behaviors (macro_tap/macro_press/macro_release/macro_tap_time/
// macro_wait_time/macro_pause_for_release/macro_param_{1to1,1to2,2to1,2to2}
// -- `dependencies/zmk/app/dts/behaviors/macros.dtsi`). Those compatibles
// are NOT wired to a `BEHAVIOR_DT_DEFINE()` anywhere in
// `dependencies/zmk/app/src/behaviors/behavior_macro.c` (only
// `zmk,behavior-macro{,-one-param,-two-param}` are); they're DT-only
// markers a macro's own `bindings` list resolves at compile time, so they
// never get a `struct device`/`local_id` and can never appear in
// `list_behaviors` -- bundling them would be dead weight.

import type {
  BehaviorBindingParametersSet,
  BehaviorParameterValueDescription,
} from "../../proto/cormoran/fast_keymap/fast_keymap";
import { defFp } from "./fingerprint";

/** Mirrors the firmware's `FK_DEFINITION_VERSION` (src/fingerprint.h). Bump
 * both together if the canonical fingerprint byte layout below ever
 * changes. */
export const FK_DEFINITION_VERSION = 1;

// -- best-effort, board-dependent constants (see file header, exception 1) --
const BUNDLED_HID_KEYBOARD_MAX_USAGE = 0xff; // ZMK_HID_REPORT_TYPE_HKRO default
const BUNDLED_HID_CONSUMER_MAX_USAGE = 0xfff; // ZMK_HID_CONSUMER_REPORT_USAGES_FULL default
const BUNDLED_BT_PROFILE_COUNT = 5; // common CONFIG_BT_MAX_PAIRED default

function hidUsage(name: string): BehaviorParameterValueDescription {
  return {
    name,
    hidUsage: {
      keyboardMax: BUNDLED_HID_KEYBOARD_MAX_USAGE,
      consumerMax: BUNDLED_HID_CONSUMER_MAX_USAGE,
    },
  };
}

function layerId(name: string): BehaviorParameterValueDescription {
  return { name, layerId: {} };
}

function constant(
  name: string,
  value: number,
): BehaviorParameterValueDescription {
  return { name, constant: value };
}

function range(
  name: string,
  min: number,
  max: number,
): BehaviorParameterValueDescription {
  return { name, range: { min, max } };
}

function set(
  param1: BehaviorParameterValueDescription[],
  param2: BehaviorParameterValueDescription[] = [],
): BehaviorBindingParametersSet {
  return { param1, param2 };
}

export interface StandardBehaviorDef {
  /** The as-served keymap alias (`BehaviorDetails.alias`), e.g. "kp" for
   * `&kp` -- part of def_fp's preimage (SS4/SS5), and also this bundle's
   * lookup key (STANDARD_BEHAVIORS is keyed by alias for readability; the
   * runtime resolution path is by def_fp -- see bundledByDefFp() below). */
  alias: string;
  /** e.g. "Key Press" for alias "kp" -- BehaviorDetails.display_name. */
  displayName: string;
  /** Same shape/semantics as BehaviorDetails.metadata. */
  metadata: BehaviorBindingParametersSet[];
}

/** Keyed by alias, purely for readability/lookup-by-name in this file and
 * in tests -- def_fp (not alias) is the wire identity; see
 * bundledByDefFp(). */
export const STANDARD_BEHAVIORS: Record<string, StandardBehaviorDef> = {
  kp: {
    alias: "kp",
    displayName: "Key Press",
    metadata: [set([hidUsage("Key")])],
  },
  mo: {
    alias: "mo",
    displayName: "Momentary Layer",
    metadata: [set([layerId("Layer")])],
  },
  trans: { alias: "trans", displayName: "Transparent", metadata: [] },
  none: { alias: "none", displayName: "None", metadata: [] },
  // mod_tap default bindings = <&kp>, <&kp> (mod_tap.dtsi).
  mt: {
    alias: "mt",
    displayName: "Mod-Tap",
    metadata: [set([hidUsage("Key")], [hidUsage("Key")])],
  },
  // layer_tap default bindings = <&mo>, <&kp> (layer_tap.dtsi).
  lt: {
    alias: "lt",
    displayName: "Layer-Tap",
    metadata: [set([layerId("Layer")], [hidUsage("Key")])],
  },
  tog: {
    alias: "tog",
    displayName: "Toggle Layer",
    metadata: [set([layerId("Layer")])],
  },
  to: {
    alias: "to",
    displayName: "To Layer",
    metadata: [set([layerId("Layer")])],
  },
  // sticky_key default bindings = <&kp> (sticky_key.dtsi); metadata is the
  // bound behavior's metadata verbatim (behavior_sticky_key.c).
  sk: {
    alias: "sk",
    displayName: "Sticky Key",
    metadata: [set([hidUsage("Key")])],
  },
  // sticky_layer (same driver, bound to <&mo>).
  sl: {
    alias: "sl",
    displayName: "Sticky Layer",
    metadata: [set([layerId("Layer")])],
  },
  kt: {
    alias: "kt",
    displayName: "Key Toggle",
    metadata: [set([hidUsage("Key")])],
  },
  bt: {
    alias: "bt",
    displayName: "Bluetooth",
    metadata: [
      set([
        constant("Next Profile", 1 /* BT_NXT_CMD */),
        constant("Previous Profile", 2 /* BT_PRV_CMD */),
        constant("Clear All Profiles", 4 /* BT_CLR_ALL_CMD */),
        constant("Clear Selected Profile", 0 /* BT_CLR_CMD */),
      ]),
      set(
        [
          constant("Select Profile", 3 /* BT_SEL_CMD */),
          constant("Disconnect Profile", 5 /* BT_DISC_CMD */),
        ],
        [range("Profile", 0, BUNDLED_BT_PROFILE_COUNT)],
      ),
    ],
  },
  out: {
    alias: "out",
    displayName: "Output Selection",
    metadata: [
      set([
        constant("Toggle Outputs", 0 /* OUT_TOG */),
        constant("USB Output", 1 /* OUT_USB */),
        constant("BLE Output", 2 /* OUT_BLE */),
        constant("No Output", 3 /* OUT_NONE */),
      ]),
    ],
  },
  rgb_ug: {
    alias: "rgb_ug",
    displayName: "Underglow",
    metadata: [
      set([
        constant("Toggle On/Off", 0),
        constant("Turn On", 1),
        constant("Turn OFF", 2),
        constant("Hue Up", 3),
        constant("Hue Down", 4),
        constant("Saturation Up", 5),
        constant("Saturation Down", 6),
        constant("Brightness Up", 7),
        constant("Brightness Down", 8),
        constant("Speed Up", 9),
        constant("Speed Down", 10),
        constant("Next Effect", 11),
        constant("Previous Effect", 12),
      ]),
    ],
  },
  // No CONFIG_ZMK_BEHAVIOR_METADATA block in behavior_ext_power.c -> empty.
  ext_power: {
    alias: "ext_power",
    displayName: "External Power",
    metadata: [],
  },

  // -- Added to close the DETAILS_CUSTOM cold-path gap (DESIGN.md SS5): --
  // "standard" per src/behavior_alias.c's fk_builtin_name_fps[], not
  // previously bundled. See this file's header comment for the ten
  // macro-control behaviors deliberately left out (never get a
  // local_id/device, so bundling them is moot).

  // caps_word.dtsi: node label == device name "caps_word"; empty metadata
  // (behavior_caps_word.c uses zmk_behavior_get_empty_param_metadata).
  caps_word: { alias: "caps_word", displayName: "Caps Word", metadata: [] },
  // gresc.dtsi: `gresc: grave_escape` (mod-morph); empty metadata
  // (behavior_mod_morph.c uses zmk_behavior_get_empty_param_metadata).
  gresc: { alias: "gresc", displayName: "Grave/Escape", metadata: [] },
  // key_repeat.dtsi: node label == device name; empty metadata.
  key_repeat: { alias: "key_repeat", displayName: "Key Repeat", metadata: [] },
  // backlight.dtsi: `bl: bcklight`; behavior_backlight.c's metadata (2 sets:
  // no-arg commands, and Set Brightness + a 0-100 range). BL_*_CMD values
  // from dt-bindings/zmk/backlight.h.
  bl: {
    alias: "bl",
    displayName: "Backlight",
    metadata: [
      set([
        constant("Toggle On/Off", 2 /* BL_TOG_CMD */),
        constant("Turn On", 0 /* BL_ON_CMD */),
        constant("Turn OFF", 1 /* BL_OFF_CMD */),
        constant("Increase Brightness", 3 /* BL_INC_CMD */),
        constant("Decrease Brightness", 4 /* BL_DEC_CMD */),
        constant("Cycle Brightness", 5 /* BL_CYCLE_CMD */),
      ]),
      set(
        [constant("Set Brightness", 6 /* BL_SET_CMD */)],
        [range("Brightness", 0, 100)],
      ),
    ],
  },
  // soft_off.dtsi: `soft_off: z_so_off`, no `display-name` property -> the
  // served display_name defaults to the device name "z_so_off"
  // (ZMK_BEHAVIOR_METADATA_INITIALIZER's DT_PROP_OR fallback,
  // dependencies/zmk/app/include/drivers/behavior.h). Empty metadata.
  soft_off: { alias: "soft_off", displayName: "z_so_off", metadata: [] },
  // studio_unlock.dtsi: node label == device name; empty metadata.
  studio_unlock: {
    alias: "studio_unlock",
    displayName: "Studio Unlock",
    metadata: [],
  },
  // reset.dtsi: two behavior instances sharing behavior_reset.c (empty
  // metadata), distinguished by alias/display-name.
  sys_reset: { alias: "sys_reset", displayName: "Reset", metadata: [] },
  bootloader: { alias: "bootloader", displayName: "Bootloader", metadata: [] },
  // mouse_key_press.dtsi: `mkp: mouse_key_press`. behavior_mouse_key_press.c
  // metadata: one set, param1 = MB1..MB5 bit-flag constants
  // (dt-bindings/zmk/pointing.h: MB1=BIT(0)=1 .. MB5=BIT(4)=16).
  mkp: {
    alias: "mkp",
    displayName: "Mouse Key Press",
    metadata: [
      set([
        constant("MB1", 1),
        constant("MB2", 2),
        constant("MB3", 4),
        constant("MB4", 8),
        constant("MB5", 16),
      ]),
    ],
  },
  // mouse_move.dtsi: `mmv: mouse_move`, no `display-name` property -> served
  // display_name defaults to the device name "mouse_move". behavior_input_
  // two_axis.c provides no get_parameter_metadata -> empty metadata.
  mmv: { alias: "mmv", displayName: "mouse_move", metadata: [] },
  // mouse_scroll.dtsi: `msc: mouse_scroll`, same shape as mmv above.
  msc: { alias: "msc", displayName: "mouse_scroll", metadata: [] },
  // sensor_rotate_key_press.dtsi:
  // `inc_dec_cp: inc_dec_kp: enc_key_press` -- FIRST node label (DT source
  // order) is `inc_dec_cp`. No `display-name` property -> served
  // display_name defaults to the device name "enc_key_press". No
  // get_parameter_metadata in behavior_sensor_rotate_var.c -> empty
  // metadata.
  inc_dec_cp: {
    alias: "inc_dec_cp",
    displayName: "enc_key_press",
    metadata: [],
  },
};

/** Lazily-built, memoized `def_fp -> StandardBehaviorDef` index (DESIGN.md
 * SS5: the web indexes its standard-behavior bundle by def_fp, not alias).
 * Built once on first use since computing every entry's def_fp is cheap but
 * unnecessary work to repeat per lookup. */
let bundleByDefFp: Map<number, StandardBehaviorDef> | null = null;

function getBundleByDefFp(): Map<number, StandardBehaviorDef> {
  if (!bundleByDefFp) {
    const map = new Map<number, StandardBehaviorDef>();
    for (const def of Object.values(STANDARD_BEHAVIORS)) {
      map.set(defFp(def.alias, def.displayName, def.metadata), def);
    }
    bundleByDefFp = map;
  }
  return bundleByDefFp;
}

/** Resolves a device-reported `def_fp` (BehaviorSummary.def_fp) to its
 * bundled definition, or `undefined` on a miss (unbundled behavior, or a
 * bundled alias whose device-side alias/display_name/metadata no longer
 * matches this bundle -- e.g. a board-dependent HID usage max, SS5's
 * exception 1). A miss is always safe: the caller falls back to
 * `get_behaviors`, never wrong data, just not fast for that one behavior. */
export function bundledByDefFp(
  defFpValue: number,
): StandardBehaviorDef | undefined {
  return getBundleByDefFp().get(defFpValue);
}
