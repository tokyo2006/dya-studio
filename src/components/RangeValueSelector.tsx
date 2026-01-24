/**
 * RangeValueSelector Component
 *
 * A numeric input with a slider for selecting values within a range.
 * For small ranges (≤10 options), displays buttons instead of slider for better UX.
 */
import { useState, useEffect } from "react";

interface RangeValueSelectorProps {
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
}

export function RangeValueSelector({
  min,
  max,
  value,
  onChange,
}: RangeValueSelectorProps) {
  // Track slider value separately to avoid triggering onChange on every move
  const [sliderValue, setSliderValue] = useState(value);

  const rangeSize = max - min + 1;
  const useButtons = rangeSize <= 10;

  // When slider value changes externally, sync internal state
  useEffect(() => {
    setSliderValue(value);
  }, [value]);

  // Handle slider release (apply the change)
  const handleSliderRelease = () => {
    if (sliderValue !== value) {
      onChange(sliderValue);
    }
  };

  // Button-based UI for small ranges
  if (useButtons) {
    const options = Array.from({ length: rangeSize }, (_, i) => min + i);
    const columns = Math.min(rangeSize, 5);

    return (
      <div className="space-y-4">
        {/* Current value display */}
        <div className="text-center">
          <div className="text-3xl font-mono font-bold text-[var(--color-neon)]">
            {value}
          </div>
          <div className="text-xs text-[var(--color-text-muted)] mt-1">
            Select value ({min} to {max})
          </div>
        </div>

        {/* Button grid */}
        <div
          className="grid gap-2 px-4"
          style={{
            gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          }}
        >
          {options.map((optValue) => (
            <button
              key={optValue}
              onClick={() => onChange(optValue)}
              className={`px-4 py-3 rounded-lg border font-mono font-medium transition-all ${
                value === optValue
                  ? "bg-[var(--color-electric)]/20 border-[var(--color-electric)] text-[var(--color-electric)] shadow-[0_0_12px_var(--color-electric)]/30"
                  : "bg-[var(--color-bg)] border-[var(--color-border)] text-[var(--color-text)] hover:border-[var(--color-electric)]/50 hover:bg-[var(--color-border)]/50"
              }`}
            >
              {optValue}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Slider-based UI for large ranges
  return (
    <div className="space-y-4">
      {/* Current value display */}
      <div className="text-center">
        <div className="text-3xl font-mono font-bold text-[var(--color-neon)]">
          {sliderValue}
        </div>
        <div className="text-xs text-[var(--color-text-muted)] mt-1">
          Range: {min} to {max}
        </div>
      </div>

      {/* Slider - updates on release to avoid triggering closeOnSelect */}
      <div className="px-4">
        <input
          type="range"
          min={min}
          max={max}
          value={sliderValue}
          onChange={(e) => setSliderValue(Number(e.target.value))}
          onMouseUp={handleSliderRelease}
          onTouchEnd={handleSliderRelease}
          className="w-full h-2 rounded-lg appearance-none cursor-pointer
            bg-[var(--color-border)]
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:w-4
            [&::-webkit-slider-thumb]:h-4
            [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:bg-[var(--color-electric)]
            [&::-webkit-slider-thumb]:cursor-pointer
            [&::-webkit-slider-thumb]:shadow-[0_0_8px_var(--color-electric)]
            [&::-moz-range-thumb]:w-4
            [&::-moz-range-thumb]:h-4
            [&::-moz-range-thumb]:rounded-full
            [&::-moz-range-thumb]:bg-[var(--color-electric)]
            [&::-moz-range-thumb]:border-0
            [&::-moz-range-thumb]:cursor-pointer
            [&::-moz-range-thumb]:shadow-[0_0_8px_var(--color-electric)]"
        />
      </div>

      {/* Number input */}
      <div className="px-4">
        <input
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(e) => {
            const val = Number(e.target.value);
            if (val >= min && val <= max) {
              onChange(val);
            }
          }}
          className="w-full px-4 py-3 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)]
            text-[var(--color-text)] text-center font-mono
            focus:outline-none focus:border-[var(--color-electric)]/50
            transition-colors"
        />
      </div>

      {/* Quick buttons for min/max */}
      <div className="grid grid-cols-2 gap-2 px-4">
        <button
          onClick={() => onChange(min)}
          className="px-4 py-2 rounded-lg border border-[var(--color-border)]
            text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]/50
            transition-colors text-sm"
        >
          Min ({min})
        </button>
        <button
          onClick={() => onChange(max)}
          className="px-4 py-2 rounded-lg border border-[var(--color-border)]
            text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]/50
            transition-colors text-sm"
        >
          Max ({max})
        </button>
      </div>
    </div>
  );
}
