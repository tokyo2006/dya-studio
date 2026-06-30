/**
 * MouseMoveInputSelector Component
 *
 * Provides UI for selecting mouse movement/scroll parameters.
 * Supports both preset directions and custom X/Y values.
 *
 * The parameter is a 32-bit packed value:
 * - Lower 16 bits (0-15): Y-axis delta
 * - Upper 16 bits (16-31): X-axis delta
 */
import {
  encodeMouseMove,
  decodeMouseMove,
  MOUSE_MOVEMENTS,
  MOUSE_SCROLLS,
  ZMK_POINTING_DEFAULT_MOVE_VAL,
  ZMK_POINTING_DEFAULT_SCRL_VAL,
} from "../lib/keycodes";
import { useLanguage } from "../hooks/useLanguage";

interface MouseMoveInputSelectorProps {
  /** Current encoded value (32-bit packed X/Y) */
  value: number;
  /** Callback when value changes */
  onChange: (value: number, shouldNotClose?: boolean) => void;
  /** Whether this is for scroll (true) or move (false) */
  isScroll?: boolean;
}

export function MouseMoveInputSelector({
  value,
  onChange,
  isScroll = false,
}: MouseMoveInputSelectorProps) {
  const { t } = useLanguage();
  const presets = isScroll ? MOUSE_SCROLLS : MOUSE_MOVEMENTS;
  const defaultValue = isScroll
    ? ZMK_POINTING_DEFAULT_SCRL_VAL
    : ZMK_POINTING_DEFAULT_MOVE_VAL;

  // Decode the current value into X and Y
  const decoded = decodeMouseMove(value);

  // Handle preset selection
  const handlePresetSelect = (presetValue: number) => {
    onChange(presetValue);
  };

  // Handle X input change
  const handleXChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    const num = parseInt(input, 10);
    if (!isNaN(num) && num >= -32768 && num <= 32767) {
      onChange(encodeMouseMove(num, decoded.y), true);
    }
  };

  // Handle Y input change
  const handleYChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    const num = parseInt(input, 10);
    if (!isNaN(num) && num >= -32768 && num <= 32767) {
      onChange(encodeMouseMove(decoded.x, num), true);
    }
  };

  // Check if current value matches a preset
  const currentPreset = presets.find((p) => p.value === value);

  return (
    <div className="space-y-4">
      {/* Preset Buttons */}
      <div>
        <p className="text-xs text-[var(--color-text-muted)] mb-2">
          {t("Quick Presets (default: ±{{defaultValue}})", { defaultValue })}
        </p>
        <div className="grid grid-cols-2 gap-2">
          {presets.map((preset) => (
            <button
              key={preset.label}
              onClick={() => handlePresetSelect(preset.value)}
              className={`p-3 rounded-lg border transition-all ${
                preset.value === value
                  ? "bg-[var(--color-electric)]/20 border-[var(--color-electric)] text-[var(--color-electric)]"
                  : "bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-hover)]"
              }`}
            >
              <div className="text-lg mb-1">{preset.shortLabel}</div>
              <div className="text-xs opacity-75">{t(preset.label)}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Custom X/Y Input */}
      <div>
        <p className="text-xs text-[var(--color-text-muted)] mb-2">
          {t("Custom Values (range: -32768 to 32767)")}
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="mouse-x-input"
              className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1"
            >
              {t("X-axis (Horizontal)")}
            </label>
            <input
              id="mouse-x-input"
              type="number"
              value={decoded.x}
              onChange={handleXChange}
              min="-32768"
              max="32767"
              className="w-full px-3 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] text-sm focus:outline-none focus:border-[var(--color-electric)] transition-colors"
              placeholder="0"
            />
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              {t("- = Left, + = Right")}
            </p>
          </div>
          <div>
            <label
              htmlFor="mouse-y-input"
              className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1"
            >
              {t("Y-axis (Vertical)")}
            </label>
            <input
              id="mouse-y-input"
              type="number"
              value={decoded.y}
              onChange={handleYChange}
              min="-32768"
              max="32767"
              className="w-full px-3 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] text-sm focus:outline-none focus:border-[var(--color-electric)] transition-colors"
              placeholder="0"
            />
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              {/* Note: Scroll Y is inverted in ZMK (positive = up, negative = down) */}
              {isScroll ? t("- = Down, + = Up") : t("- = Up, + = Down")}
            </p>
          </div>
        </div>
      </div>

      {/* Current Value Display */}
      {!currentPreset &&
        (value !== 0 || decoded.x !== 0 || decoded.y !== 0) && (
          <div className="p-3 rounded-lg bg-[var(--color-border)]/50 border border-[var(--color-border)]">
            <p className="text-xs text-[var(--color-text-muted)]">
              {t("Current: X={{x}}, Y={{y}} (encoded: 0x{{encoded}})", {
                x: decoded.x,
                y: decoded.y,
                encoded: value.toString(16).toUpperCase(),
              })}
            </p>
          </div>
        )}
    </div>
  );
}
