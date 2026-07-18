import { useState, type InputHTMLAttributes } from "react";

// Input that keeps its own local value while focused so parent-driven updates
// (e.g. after a debounced memory write reloads device state) don't reset the
// cursor or steal focus mid-edit. Mirrors the RetainedInput used by
// AdvancedSettingsSection. Only needed for fields driven by device state
// (global settings); the per-item editors are driven by local drafts.
export function RetainedInput({
  value,
  onChange,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & {
  value: string;
  onChange: (value: string) => void;
}) {
  const [local, setLocal] = useState(value);
  const [prevProp, setPrevProp] = useState(value);
  const [focused, setFocused] = useState(false);

  if (prevProp !== value) {
    setPrevProp(value);
    if (!focused) {
      setLocal(value);
    }
  }

  return (
    <input
      {...rest}
      value={local}
      onFocus={(e) => {
        setFocused(true);
        rest.onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        rest.onBlur?.(e);
      }}
      onChange={(e) => {
        setLocal(e.target.value);
        onChange(e.target.value);
      }}
    />
  );
}
