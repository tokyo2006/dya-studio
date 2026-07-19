import type { DocTipContent } from "../components/DocTip";
import type { TranslationParams } from "./translations";

type TranslateFn = (key: string, params?: TranslationParams) => string;

/** Explains what ZMK macros are, shown next to the Macros card header. */
export function macroDoc(t: TranslateFn): DocTipContent {
  return {
    title: t("What are Macros?"),
    intro: t(
      "A macro plays back a saved sequence of key actions when you trigger it with a single key.",
    ),
    sections: [
      {
        heading: t("Typical uses"),
        bullets: [
          t("Type text, symbols, or emoji that need several keystrokes"),
          t("Fire an app or OS shortcut with one press"),
          t("Chain presses, holds, and waits into one action"),
        ],
      },
      {
        heading: t("In DYA Studio"),
        bullets: [
          t("Create and edit the action sequence of each macro"),
          t("Bind a macro to a key from the Keymap tab"),
          t("Tune global timing such as wait and tap time"),
        ],
      },
    ],
  };
}

/** Explains what ZMK combos are, shown next to the Combos card header. */
export function comboDoc(t: TranslateFn): DocTipContent {
  return {
    title: t("What are Combos?"),
    intro: t(
      "A combo turns pressing several keys at once into a different key or behavior.",
    ),
    sections: [
      {
        heading: t("Typical uses"),
        bullets: [
          t("Add extra keys without extra physical keys (e.g. Esc from J+K)"),
          t("Reach symbols or layer switches from your home row"),
        ],
      },
      {
        heading: t("How it works"),
        bullets: [
          t("Press the chosen key positions together within a time window"),
          t("Tune the timeout, active layers, and release behavior per combo"),
        ],
      },
    ],
  };
}

/** Explains trackball input processors, shown next to the Processors header. */
export function processorDoc(t: TranslateFn): DocTipContent {
  return {
    title: t("What are Processors?"),
    intro: t(
      "Input processors transform trackball motion before it becomes pointer or scroll output, and can be turned on per layer.",
    ),
    sections: [
      {
        heading: t("Typical uses"),
        bullets: [
          t("Switch the trackball between moving the cursor and scrolling"),
          t("Adjust sensitivity, or swap and invert the axes"),
        ],
      },
      {
        heading: t("Layers"),
        bullets: [
          t("Choose which layers each processor is active on"),
          t("Optionally hold a temporary layer while the trackball moves"),
        ],
      },
    ],
  };
}

/** Explains default layers, shown next to the Connections header. */
export function defaultLayerDoc(t: TranslateFn): DocTipContent {
  return {
    title: t("What are Default Layers?"),
    intro: t(
      "A default layer is the keymap layer your keyboard activates automatically for a given connection.",
    ),
    sections: [
      {
        heading: t("Per connection"),
        bullets: [
          t("Pick a layer for each connection target (USB and BLE profiles)"),
          t("It switches automatically when that connection becomes active"),
        ],
      },
      {
        heading: t("Follow OS detection"),
        bullets: [
          t(
            "Choose 'Follow OS detection' to use the Per-OS Default Layers instead",
          ),
          t("The layer set for the detected OS (Windows, macOS, …) is applied"),
        ],
      },
    ],
  };
}

/** Explains the PMW3610 sensor driver, shown next to the PMW3610 Drivers header. */
export function pmw3610Doc(t: TranslateFn): DocTipContent {
  return {
    title: t("What is the PMW3610 driver?"),
    intro: t(
      "PMW3610 is the optical sensor inside the trackball. Its driver exposes low-level tuning for how motion is read.",
    ),
    sections: [
      {
        heading: t("Typical settings"),
        bullets: [
          t("CPI / sensitivity of the sensor"),
          t("Orientation, axis rotation, and inversion"),
          t("Polling rate and sleep / power behavior"),
        ],
      },
      {
        heading: t("Note"),
        body: t(
          "These values are read from and written to your keyboard's firmware. Change them in small steps.",
        ),
      },
    ],
  };
}
