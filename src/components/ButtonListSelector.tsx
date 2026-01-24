/**
 * ButtonListSelector Component
 *
 * Reusable component for selecting from a small list of options.
 * Used for layers, BT commands, mouse buttons, etc.
 */

interface ButtonListOption {
  value: number;
  label: string;
  shortLabel?: string;
}

interface ButtonListSelectorProps {
  options: ButtonListOption[];
  value: number;
  onChange: (value: number) => void;
  columns?: number;
}

export function ButtonListSelector({
  options,
  value,
  onChange,
  columns = 3,
}: ButtonListSelectorProps) {
  return (
    <div
      className="grid gap-2"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {options.map((option) => (
        <button
          key={option.value}
          className={`p-3 rounded-lg border text-center transition-colors ${
            value === option.value
              ? "bg-[var(--color-electric)]/20 border-[var(--color-electric)] text-[var(--color-electric)]"
              : "bg-[var(--color-bg)] border-[var(--color-border)] hover:border-[var(--color-electric)]/50 text-[var(--color-text-secondary)]"
          }`}
          onClick={() => onChange(option.value)}
        >
          <span className="block text-sm font-medium">
            {option.shortLabel || option.label}
          </span>
          {option.shortLabel && (
            <span className="block text-xs text-[var(--color-text-muted)]">
              {option.label}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
