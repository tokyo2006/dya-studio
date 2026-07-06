import { LAYER_UNSET, LAYER_OS_DETECTION } from "../lib/osDetection";
import { layerLabel } from "../hooks/useLayerNames";
import { useLanguage } from "../hooks/useLanguage";

interface LayerSelectProps {
  value: number;
  layerCount: number;
  layerNames: string[];
  /** Whether to offer the "Follow OS detection" sentinel option (-2). Endpoints only. */
  allowOsDetection?: boolean;
  disabled?: boolean;
  onChange: (value: number) => void;
  "aria-label"?: string;
  className?: string;
}

export function LayerSelect({
  value,
  layerCount,
  layerNames,
  allowOsDetection = false,
  disabled = false,
  onChange,
  "aria-label": ariaLabel,
  className = "",
}: LayerSelectProps) {
  const { t } = useLanguage();

  const layerOptions = Array.from({ length: layerCount }, (_, index) => index);

  return (
    <select
      className={`select-field text-sm w-full tablet:w-56 ${className}`}
      value={value}
      disabled={disabled}
      aria-label={ariaLabel}
      onChange={(event) => onChange(Number.parseInt(event.target.value, 10))}
    >
      <option value={LAYER_UNSET}>{t("Not set (leave as is)")}</option>
      {allowOsDetection && (
        <option value={LAYER_OS_DETECTION}>{t("Follow OS detection")}</option>
      )}
      {layerOptions.map((index) => (
        <option key={index} value={index}>
          {layerLabel(layerNames, index)}
        </option>
      ))}
    </select>
  );
}
