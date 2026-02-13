/**
 * KeyboardLayoutProvider Component
 *
 * Provider for keyboard layout context that manages layout state and persistence.
 */
import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import { KeyboardLayoutContext } from "./KeyboardLayoutContext";
import type { KeyboardLayoutType } from "../lib/keyboardLayouts";
import {
  getSavedKeyboardLayout,
  saveKeyboardLayout,
} from "../lib/keyboardLayouts";

interface KeyboardLayoutProviderProps {
  children: ReactNode;
}

/**
 * Provider component for keyboard layout context
 */
export function KeyboardLayoutProvider({
  children,
}: KeyboardLayoutProviderProps) {
  const [layout, setLayoutState] = useState<KeyboardLayoutType>(() => {
    return getSavedKeyboardLayout();
  });

  // Save to localStorage whenever layout changes
  useEffect(() => {
    saveKeyboardLayout(layout);
  }, [layout]);

  const setLayout = (newLayout: KeyboardLayoutType) => {
    setLayoutState(newLayout);
  };

  return (
    <KeyboardLayoutContext.Provider value={{ layout, setLayout }}>
      {children}
    </KeyboardLayoutContext.Provider>
  );
}
