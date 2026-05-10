import { useTranslation } from "react-i18next";
import { useState, useRef } from "react";
import { IconAlertTriangleFilled, IconPointer } from "@tabler/icons-react";
import * as Switch from "@radix-ui/react-switch";
import { useRuntimeInputProcessor } from "../hooks/useRuntimeInputProcessor";
import { AxisSnapMode } from "../proto/zmk/runtime_input_processor/runtime_input_processor";
import { useDebouncedSave } from "../hooks/useDebouncedSave";

// Scaling preset types
type ScalingPresetType = "wheel" | "scroll";

// Wheel/mouse preset options (multipliers as percentage)
const WHEEL_PRESETS = [
  { multiplier: 50, divisor: 100, label: "0.5x" },
  { multiplier: 75, divisor: 100, label: "0.75x" },
  { multiplier: 1, divisor: 1, label: "1.0x" },
  { multiplier: 3, divisor: 2, label: "1.5x" },
  { multiplier: 2, divisor: 1, label: "2.0x" },
];

// Scroll preset options (shown as fractions)
const SCROLL_PRESETS = [
  { multiplier: 1, divisor: 30, label: "1/30" },
  { multiplier: 1, divisor: 60, label: "1/60" },
  { multiplier: 1, divisor: 120, label: "1/120" },
];

export function TrackballPage() {
  const { t } = useTranslation();
  const {
    isAvailable,
    processors,
    layers,
    isLoading,
    error,
    setScaling,
    setRotation,
    setTempLayerEnabled,
    setTempLayerLayer,
    setTempLayerActivationDelay,
    setTempLayerDeactivationDelay,
    setActiveLayers,
    setAxisSnapMode,
    setAxisSnapThreshold,
    setAxisSnapTimeout,
    setXInvert,
    setYInvert,
    setXyToScrollEnabled,
    setXySwapEnabled,
  } = useRuntimeInputProcessor();

  // Selected processor index
  const [selectedProcessorIndex, setSelectedProcessorIndex] = useState(0);

  // Scaling preset type selector
  const [scalingPresetType, setScalingPresetType] =
    useState<ScalingPresetType>("wheel");

  // Rotation enabled state
  const [rotationEnabled, setRotationEnabled] = useState(false);

  // Active layers mode: "all" or "specific"
  const [activeLayersMode, setActiveLayersMode] = useState<"all" | "specific">(
    "all",
  );

  // Debounced save hooks for each field
  const scalingMultiplierSave = useDebouncedSave<number>();
  const scalingDivisorSave = useDebouncedSave<number>();
  const rotationSave = useDebouncedSave<number>();
  const tempLayerEnabledSave = useDebouncedSave<boolean>();
  const tempLayerLayerSave = useDebouncedSave<number>();
  const tempLayerActivationDelaySave = useDebouncedSave<number>();
  const tempLayerDeactivationDelaySave = useDebouncedSave<number>();
  const activeLayersSave = useDebouncedSave<number>();
  const axisSnapModeSave = useDebouncedSave<AxisSnapMode>();
  const axisSnapThresholdSave = useDebouncedSave<number>();
  const axisSnapTimeoutSave = useDebouncedSave<number>();
  const xInvertSave = useDebouncedSave<boolean>();
  const yInvertSave = useDebouncedSave<boolean>();
  const xyToScrollEnabledSave = useDebouncedSave<boolean>();
  const xySwapEnabledSave = useDebouncedSave<boolean>();

  // Track previous processor to detect changes and reset pending state
  const previousProcessorRef = useRef<string | null>(null);

  // Get the selected processor
  const processor = processors[selectedProcessorIndex] || null;

  // Reset pending state when processor changes
  const currentProcessorName = processor?.name || null;
  if (previousProcessorRef.current !== currentProcessorName) {
    previousProcessorRef.current = currentProcessorName;
    scalingMultiplierSave.reset();
    scalingDivisorSave.reset();
    rotationSave.reset();
    tempLayerEnabledSave.reset();
    tempLayerLayerSave.reset();
    tempLayerActivationDelaySave.reset();
    tempLayerDeactivationDelaySave.reset();
    activeLayersSave.reset();
    axisSnapModeSave.reset();
    axisSnapThresholdSave.reset();
    axisSnapTimeoutSave.reset();
    xInvertSave.reset();
    yInvertSave.reset();
    xyToScrollEnabledSave.reset();
    xySwapEnabledSave.reset();
    setRotationEnabled(processor?.rotationDegrees !== 0);
    setActiveLayersMode(processor?.activeLayers === 0 ? "all" : "specific");
  }

  // Calculate display values with pending states
  const displayScalingMultiplier =
    scalingMultiplierSave.pendingValue ?? processor?.scaleMultiplier ?? 1;
  const displayScalingDivisor =
    scalingDivisorSave.pendingValue ?? processor?.scaleDivisor ?? 1;
  const displayRotation =
    rotationSave.pendingValue ?? processor?.rotationDegrees ?? 0;
  const displayTempLayerEnabled =
    tempLayerEnabledSave.pendingValue ?? processor?.tempLayerEnabled ?? false;
  const displayTempLayerLayer =
    tempLayerLayerSave.pendingValue ?? processor?.tempLayerLayer ?? 0;
  const displayTempLayerActivationDelay =
    tempLayerActivationDelaySave.pendingValue ??
    processor?.tempLayerActivationDelayMs ??
    100;
  const displayTempLayerDeactivationDelay =
    tempLayerDeactivationDelaySave.pendingValue ??
    processor?.tempLayerDeactivationDelayMs ??
    500;
  const displayActiveLayers =
    activeLayersSave.pendingValue ?? processor?.activeLayers ?? 0;
  const displayAxisSnapMode =
    axisSnapModeSave.pendingValue ??
    processor?.axisSnapMode ??
    AxisSnapMode.AXIS_SNAP_MODE_NONE;
  const displayAxisSnapThreshold =
    axisSnapThresholdSave.pendingValue ?? processor?.axisSnapThreshold ?? 50;
  const displayAxisSnapTimeout =
    axisSnapTimeoutSave.pendingValue ?? processor?.axisSnapTimeoutMs ?? 200;
  const displayXInvert =
    xInvertSave.pendingValue ?? processor?.xInvert ?? false;
  const displayYInvert =
    yInvertSave.pendingValue ?? processor?.yInvert ?? false;
  const displayXyToScrollEnabled =
    xyToScrollEnabledSave.pendingValue ?? processor?.xyToScrollEnabled ?? false;
  const displayXySwapEnabled =
    xySwapEnabledSave.pendingValue ?? processor?.xySwapEnabled ?? false;

  // Calculate final scaling value (multiplier/divisor)
  const finalScalingValue =
    displayScalingDivisor !== 0
      ? displayScalingMultiplier / displayScalingDivisor
      : 1;

  // Handler functions using useDebouncedSave
  const handleScalingMultiplierChange = (multiplier: number) => {
    if (!processor) return;
    scalingMultiplierSave.setPendingValue(multiplier, async (value) => {
      const divisor = scalingDivisorSave.pendingValue ?? processor.scaleDivisor;
      await setScaling(processor.id, value, divisor);
    });
  };

  const handleScalingDivisorChange = (divisor: number) => {
    if (!processor) return;
    scalingDivisorSave.setPendingValue(divisor, async (value) => {
      const multiplier =
        scalingMultiplierSave.pendingValue ?? processor.scaleMultiplier;
      await setScaling(processor.id, multiplier, value);
    });
  };

  const handleScalingPreset = (multiplier: number, divisor: number) => {
    if (!processor) return;
    // Cancel any pending individual saves to avoid conflicts
    scalingMultiplierSave.cancel();
    scalingDivisorSave.cancel();
    // Set both values together with a single save call
    scalingMultiplierSave.setPendingValue(multiplier, async () => {
      await setScaling(processor.id, multiplier, divisor);
    });
    // Update the divisor display value without triggering another save
    scalingDivisorSave.setPendingValue(divisor, async () => {
      // No-op: multiplier save already handles both values
    });
  };

  const handleRotationEnabledChange = (enabled: boolean) => {
    setRotationEnabled(enabled);
    if (!enabled && processor) {
      rotationSave.setPendingValue(0, async () => {
        await setRotation(processor.id, 0);
      });
    }
  };

  const handleRotationChange = (degrees: number) => {
    if (!processor) return;
    rotationSave.setPendingValue(degrees, async (value) => {
      await setRotation(processor.id, value);
    });
  };

  const handleTempLayerEnabledChange = (enabled: boolean) => {
    if (!processor) return;
    tempLayerEnabledSave.setPendingValue(enabled, async (value) => {
      await setTempLayerEnabled(processor.id, value);
    });
  };

  const handleTempLayerLayerChange = (layer: number) => {
    if (!processor) return;
    tempLayerLayerSave.setPendingValue(layer, async (value) => {
      await setTempLayerLayer(processor.id, value);
    });
  };

  const handleTempLayerActivationDelayChange = (delayMs: number) => {
    if (!processor) return;
    tempLayerActivationDelaySave.setPendingValue(delayMs, async (value) => {
      await setTempLayerActivationDelay(processor.id, value);
    });
  };

  const handleTempLayerDeactivationDelayChange = (delayMs: number) => {
    if (!processor) return;
    tempLayerDeactivationDelaySave.setPendingValue(delayMs, async (value) => {
      await setTempLayerDeactivationDelay(processor.id, value);
    });
  };

  const handleActiveLayersModeChange = (mode: "all" | "specific") => {
    setActiveLayersMode(mode);
    if (mode === "all" && processor) {
      // Set bitmask to 0 for all layers
      activeLayersSave.setPendingValue(0, async () => {
        await setActiveLayers(processor.id, 0);
      });
    }
  };

  const handleLayerToggle = (layerId: number) => {
    if (!processor) return;
    const currentBitmask = displayActiveLayers;
    const layerBit = 1 << layerId;
    const newBitmask =
      (currentBitmask & layerBit) !== 0
        ? currentBitmask & ~layerBit // Clear bit
        : currentBitmask | layerBit; // Set bit

    activeLayersSave.setPendingValue(newBitmask, async (value) => {
      await setActiveLayers(processor.id, value);
    });
  };

  const handleAxisSnapEnabledChange = (enabled: boolean) => {
    if (!processor) return;
    // When enabling, default to Y axis snap
    const newMode = enabled
      ? AxisSnapMode.AXIS_SNAP_MODE_Y
      : AxisSnapMode.AXIS_SNAP_MODE_NONE;
    axisSnapModeSave.setPendingValue(newMode, async (value) => {
      await setAxisSnapMode(processor.id, value);
    });
  };

  const handleAxisSnapModeChange = (mode: AxisSnapMode) => {
    if (!processor) return;
    axisSnapModeSave.setPendingValue(mode, async (value) => {
      await setAxisSnapMode(processor.id, value);
    });
  };

  const handleAxisSnapThresholdChange = (threshold: number) => {
    if (!processor) return;
    axisSnapThresholdSave.setPendingValue(threshold, async (value) => {
      await setAxisSnapThreshold(processor.id, value);
    });
  };

  const handleAxisSnapTimeoutChange = (timeoutMs: number) => {
    if (!processor) return;
    axisSnapTimeoutSave.setPendingValue(timeoutMs, async (value) => {
      await setAxisSnapTimeout(processor.id, value);
    });
  };

  const handleXInvertChange = (invert: boolean) => {
    if (!processor) return;
    xInvertSave.setPendingValue(invert, async (value) => {
      await setXInvert(processor.id, value);
    });
  };

  const handleYInvertChange = (invert: boolean) => {
    if (!processor) return;
    yInvertSave.setPendingValue(invert, async (value) => {
      await setYInvert(processor.id, value);
    });
  };

  const handleXyToScrollEnabledChange = (enabled: boolean) => {
    if (!processor) return;
    xyToScrollEnabledSave.setPendingValue(enabled, async (value) => {
      await setXyToScrollEnabled(processor.id, value);
    });
  };

  const handleXySwapEnabledChange = (enabled: boolean) => {
    if (!processor) return;
    xySwapEnabledSave.setPendingValue(enabled, async (value) => {
      await setXySwapEnabled(processor.id, value);
    });
  };

  return (
    <div className="p-6 h-full overflow-auto">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2 rounded-lg bg-[var(--color-cyber)]/10 border border-[var(--color-cyber)]/20">
            <IconPointer size={24} className="text-[var(--color-cyber)]" />
          </div>
          <div>
<h1 className="text-xl font-medium text-[var(--color-text)]">
                {t("trackball.title")}
              </h1>
              <p className="text-sm text-[var(--color-text-muted)]">
                {t("trackball.description")}
              </p>
          </div>
        </div>

        {!isAvailable && !isLoading && !error && (
          <div className="mb-6 p-4 rounded-lg bg-[var(--color-border)] border border-[var(--color-border-hover)] flex items-start gap-3">
            <div className="p-2">
              <IconAlertTriangleFilled size={24} className="text-red-500" />
            </div>
            <p className="text-sm text-[var(--color-text-muted)]">
              {t("trackball.runtimeInputProcessorNotAvailable")} <br />
              {t("trackball.makeSureFirmwareHas")}{" "}
              <a
                href="https://github.com/cormoran/zmk-module-runtime-input-processor"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--color-electric)] underline mx-1"
              >
                cormoran/zmk-module-runtime-input-processor
              </a>
              {t("battery.enabled")}
            </p>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Loading state */}
        {isLoading && !processor && (
          <div className="mb-6 p-4 rounded-lg bg-[var(--color-border)] border border-[var(--color-border-hover)]">
            <p className="text-sm text-[var(--color-text-muted)]">
              {t("trackball.loadingTrackballSettings")}
            </p>
          </div>
        )}

        {/* No processor found */}
        {!isLoading && !processor && !error && (
          <div className="mb-6 p-4 rounded-lg bg-[var(--color-border)] border border-[var(--color-border-hover)]">
            <p className="text-sm text-[var(--color-text-muted)]">
              {t("trackball.noRuntimeInputProcessorFound")}
            </p>
          </div>
        )}

        {/* Settings */}
        {processor && (
          <div className="space-y-6">
            {/* Processor Selector (if multiple processors) */}
            {processors.length > 1 && (
              <div className="glass-card p-6">
                <h3 className="text-sm font-medium text-[var(--color-text)] mb-2">
                  {t("trackball.selectProcessor")}
                </h3>
                <p className="text-xs text-[var(--color-text-muted)] mb-4">
                  {t("trackball.processorsDetected", { count: processors.length })}
                </p>
                <select
                  value={selectedProcessorIndex}
                  onChange={(e) =>
                    setSelectedProcessorIndex(Number(e.target.value))
                  }
                  className="w-full px-4 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] text-sm cursor-pointer hover:border-[var(--color-border-hover)] focus:outline-none focus:border-[var(--color-electric)] transition-colors"
                >
                  {processors.map((p, index) => (
                    <option key={index} value={index}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Active Layers Selection */}
            <div className="glass-card p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-medium text-[var(--color-text)]">
                    {t("trackball.activeOnLayers")}
                  </h3>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {t("trackball.configureWhichLayersProcessorActive")}
                  </p>
                </div>
                <div className="flex-shrink-0">
                  <Switch.Root
                    checked={activeLayersMode === "specific"}
                    onCheckedChange={(checked) =>
                      handleActiveLayersModeChange(checked ? "specific" : "all")
                    }
                    className="w-11 h-6 rounded-full relative data-[state=checked]:bg-[var(--color-electric)] bg-[var(--color-surface)] border border-[var(--color-border)] transition-colors cursor-pointer"
                  >
                    <Switch.Thumb className="block w-5 h-5 rounded-full transition-transform data-[state=checked]:translate-x-5 translate-x-0.5 will-change-transform bg-white border border-[var(--color-border)]" />
                  </Switch.Root>
                </div>
              </div>

              {activeLayersMode === "specific" && (
                <div className="space-y-2 mt-4">
                  {layers.length > 0 ? (
                    layers.map((layer) => {
                      const isChecked =
                        (displayActiveLayers & (1 << layer.id)) !== 0;
                      return (
                        <label
                          key={layer.id}
                          className="flex items-center gap-3 p-2 rounded-lg hover:bg-[var(--color-border)]/50 cursor-pointer transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleLayerToggle(layer.id)}
                            className="w-4 h-4 rounded border-[var(--color-border)] text-[var(--color-electric)] focus:ring-[var(--color-electric)] focus:ring-offset-0 cursor-pointer"
                          />
                          <span className="text-sm text-[var(--color-text-secondary)]">
                            {t("trackball.layerName", { name: layer.name || `Layer ${layer.id}` })}
                          </span>
                        </label>
                      );
                    })
                  ) : (
                    <p className="text-xs text-[var(--color-text-muted)]">
                      {t("trackball.loadingLayers")}
                    </p>
                  )}
                </div>
              )}

              {activeLayersMode === "all" && (
                <p className="text-sm text-[var(--color-text-secondary)] mt-4">
                  {t("trackball.processorActiveAllLayers")}
                </p>
              )}
            </div>

            {/* Scaling Setting */}
            <div className="glass-card p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-medium text-[var(--color-text)]">
                    {t("trackball.scaling")}
                  </h3>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {t("trackball.adjustSensitivity")}
                  </p>
                </div>
                <span className="text-lg font-mono text-[var(--color-electric)]">
                  {finalScalingValue.toFixed(2)}x
                </span>
              </div>

              {/* Multiplier and Divisor Controls */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="text-sm text-[var(--color-text-secondary)] mb-2 block">
                    {t("trackball.multiplier")}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    value={displayScalingMultiplier}
                    onChange={(e) =>
                      handleScalingMultiplierChange(Number(e.target.value))
                    }
                    className="w-full px-3 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] text-sm focus:outline-none focus:border-[var(--color-electric)] transition-colors"
                  />
                </div>
                <div>
                  <label className="text-sm text-[var(--color-text-secondary)] mb-2 block">
                    {t("trackball.divisor")}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    value={displayScalingDivisor}
                    onChange={(e) =>
                      handleScalingDivisorChange(Number(e.target.value))
                    }
                    className="w-full px-3 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] text-sm focus:outline-none focus:border-[var(--color-electric)] transition-colors"
                  />
                </div>
              </div>

              {/* Preset Type Tabs */}
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setScalingPresetType("wheel")}
                  className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    scalingPresetType === "wheel"
                      ? "bg-[var(--color-electric)] text-white"
                      : "bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]"
                  }`}
                >
                  {t("trackball.wheelMouse")}
                </button>
                <button
                  onClick={() => setScalingPresetType("scroll")}
                  className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    scalingPresetType === "scroll"
                      ? "bg-[var(--color-electric)] text-white"
                      : "bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]"
                  }`}
                >
                  {t("trackball.scroll")}
                </button>
              </div>

              {/* Preset Buttons */}
              <div className="grid grid-cols-5 gap-2">
                {(scalingPresetType === "wheel"
                  ? WHEEL_PRESETS
                  : SCROLL_PRESETS
                ).map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() =>
                      handleScalingPreset(preset.multiplier, preset.divisor)
                    }
                    className={`px-2 sm:px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      displayScalingMultiplier / displayScalingDivisor ===
                      preset.multiplier / preset.divisor
                        ? "bg-[var(--color-electric)] text-white"
                        : "bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Rotation Setting */}
            <div className="glass-card p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-medium text-[var(--color-text)]">
                    {t("trackball.sensorRotation")}
                  </h3>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {t("trackball.rotateInputMountingAngles")}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-lg font-mono text-[var(--color-electric)]">
                    {displayRotation}°
                  </span>
                  <div className="flex-shrink-0">
                    <Switch.Root
                      checked={rotationEnabled}
                      onCheckedChange={handleRotationEnabledChange}
                      className="w-11 h-6 rounded-full relative data-[state=checked]:bg-[var(--color-electric)] bg-[var(--color-surface)] border border-[var(--color-border)] transition-colors cursor-pointer"
                    >
                      <Switch.Thumb className="block w-5 h-5 rounded-full transition-transform data-[state=checked]:translate-x-5 translate-x-0.5 will-change-transform bg-white border border-[var(--color-border)]" />
                    </Switch.Root>
                  </div>
                </div>
              </div>

              {rotationEnabled && (
                <div>
                  {/* Slider centered at 0, ranging from -180 to +180 */}
                  <input
                    type="range"
                    min={-180}
                    max={180}
                    step={1}
                    value={displayRotation}
                    onChange={(e) =>
                      handleRotationChange(Number(e.target.value))
                    }
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
                  <div className="flex justify-between mt-2 text-xs text-[var(--color-text-muted)]">
                    <span>-180°</span>
                    <span>0°</span>
                    <span>+180°</span>
                  </div>
                </div>
              )}
            </div>

            {/* Axis Snapping */}
            <div className="glass-card p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-medium text-[var(--color-text)]">
                    {t("trackball.axisSnapping")}
                  </h3>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {t("trackball.axisSnappingDescription")}
                  </p>
                </div>
                <div className="flex-shrink-0">
                  <Switch.Root
                    checked={
                      displayAxisSnapMode !== AxisSnapMode.AXIS_SNAP_MODE_NONE
                    }
                    onCheckedChange={handleAxisSnapEnabledChange}
                    className="w-11 h-6 rounded-full relative data-[state=checked]:bg-[var(--color-electric)] bg-[var(--color-surface)] border border-[var(--color-border)] transition-colors cursor-pointer"
                  >
                    <Switch.Thumb className="block w-5 h-5 rounded-full transition-transform data-[state=checked]:translate-x-5 translate-x-0.5 will-change-transform bg-white border border-[var(--color-border)]" />
                  </Switch.Root>
                </div>
              </div>

              {displayAxisSnapMode !== AxisSnapMode.AXIS_SNAP_MODE_NONE && (
                <div className="space-y-4 mt-6">
                  {/* Axis Selection */}
                  <div>
                    <label className="text-sm text-[var(--color-text-secondary)] mb-3 block">
                      {t("trackball.snapAxis")}
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() =>
                          handleAxisSnapModeChange(
                            AxisSnapMode.AXIS_SNAP_MODE_Y,
                          )
                        }
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          displayAxisSnapMode === AxisSnapMode.AXIS_SNAP_MODE_Y
                            ? "bg-[var(--color-electric)] text-white"
                            : "bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]"
                        }`}
                      >
                        {t("trackball.yAxisVertical")}
                      </button>
                      <button
                        onClick={() =>
                          handleAxisSnapModeChange(
                            AxisSnapMode.AXIS_SNAP_MODE_X,
                          )
                        }
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          displayAxisSnapMode === AxisSnapMode.AXIS_SNAP_MODE_X
                            ? "bg-[var(--color-electric)] text-white"
                            : "bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]"
                        }`}
                      >
                        {t("trackball.xAxisHorizontal")}
                      </button>
                    </div>
                  </div>
                  {/* Snap Threshold */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm text-[var(--color-text-secondary)]">
                        {t("trackball.snapThreshold")}
                      </label>
                      <span className="text-sm font-mono text-[var(--color-electric)]">
                        {displayAxisSnapThreshold}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1000}
                      step={1}
                      value={displayAxisSnapThreshold}
                      onChange={(e) =>
                        handleAxisSnapThresholdChange(Number(e.target.value))
                      }
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
                    <p className="text-xs text-[var(--color-text-muted)] mt-2">
                      {t("trackball.thresholdDescription")}
                    </p>
                  </div>

                  {/* Snap Timeout */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm text-[var(--color-text-secondary)]">
                        {t("trackball.snapTimeout")}
                      </label>
                      <span className="text-sm font-mono text-[var(--color-electric)]">
                        {displayAxisSnapTimeout}ms
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={600}
                      step={50}
                      value={displayAxisSnapTimeout}
                      onChange={(e) =>
                        handleAxisSnapTimeoutChange(Number(e.target.value))
                      }
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
                    <p className="text-xs text-[var(--color-text-muted)] mt-2">
                      {t("trackball.timeoutDescription")}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Axis Inversion */}
            <div className="glass-card p-6">
              <div className="mb-4">
                <h3 className="text-sm font-medium text-[var(--color-text)]">
                  {t("trackball.axisInversion")}
                </h3>
                <p className="text-xs text-[var(--color-text-muted)]">
                  {t("trackball.axisInversionDescription")}
                </p>
              </div>

              <div className="space-y-4">
                {/* X Invert */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      {t("trackball.invertXAxis")}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      {t("trackball.reverseHorizontal")}
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    <Switch.Root
                      checked={displayXInvert}
                      onCheckedChange={handleXInvertChange}
                      className="w-11 h-6 rounded-full relative data-[state=checked]:bg-[var(--color-electric)] bg-[var(--color-surface)] border border-[var(--color-border)] transition-colors cursor-pointer"
                    >
                      <Switch.Thumb className="block w-5 h-5 rounded-full transition-transform data-[state=checked]:translate-x-5 translate-x-0.5 will-change-transform bg-white border border-[var(--color-border)]" />
                    </Switch.Root>
                  </div>
                </div>

                {/* Y Invert */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      {t("trackball.invertYAxis")}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      {t("trackball.reverseVertical")}
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    <Switch.Root
                      checked={displayYInvert}
                      onCheckedChange={handleYInvertChange}
                      className="w-11 h-6 rounded-full relative data-[state=checked]:bg-[var(--color-electric)] bg-[var(--color-surface)] border border-[var(--color-border)] transition-colors cursor-pointer"
                    >
                      <Switch.Thumb className="block w-5 h-5 rounded-full transition-transform data-[state=checked]:translate-x-5 translate-x-0.5 will-change-transform bg-white border border-[var(--color-border)]" />
                    </Switch.Root>
                  </div>
                </div>
              </div>
            </div>

            {/* Code Mapping */}
            <div className="glass-card p-6">
              <div className="mb-4">
                <h3 className="text-sm font-medium text-[var(--color-text)]">
                  {t("trackball.codeMapping")}
                </h3>
                <p className="text-xs text-[var(--color-text-muted)]">
                  {t("trackball.codeMappingDescription")}
                </p>
              </div>

              <div className="space-y-4">
                {/* XY to Scroll */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      {t("trackball.xyToScroll")}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      {t("trackball.xyToScrollDescription")}
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    <Switch.Root
                      checked={displayXyToScrollEnabled}
                      onCheckedChange={handleXyToScrollEnabledChange}
                      className="w-11 h-6 rounded-full relative data-[state=checked]:bg-[var(--color-electric)] bg-[var(--color-surface)] border border-[var(--color-border)] transition-colors cursor-pointer"
                    >
                      <Switch.Thumb className="block w-5 h-5 rounded-full transition-transform data-[state=checked]:translate-x-5 translate-x-0.5 will-change-transform bg-white border border-[var(--color-border)]" />
                    </Switch.Root>
                  </div>
                </div>

                {/* XY Swap */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      {t("trackball.xySwap")}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      {t("trackball.xySwapDescription")}
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    <Switch.Root
                      checked={displayXySwapEnabled}
                      onCheckedChange={handleXySwapEnabledChange}
                      className="w-11 h-6 rounded-full relative data-[state=checked]:bg-[var(--color-electric)] bg-[var(--color-surface)] border border-[var(--color-border)] transition-colors cursor-pointer"
                    >
                      <Switch.Thumb className="block w-5 h-5 rounded-full transition-transform data-[state=checked]:translate-x-5 translate-x-0.5 will-change-transform bg-white border border-[var(--color-border)]" />
                    </Switch.Root>
                  </div>
                </div>
              </div>
            </div>

            {/* Temp Layer Settings */}
            <div className="glass-card p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-medium text-[var(--color-text)]">
                    {t("trackball.tempLayer")}
                  </h3>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {t("trackball.tempLayerDescription")}
                  </p>
                </div>
                <div className="flex-shrink-0">
                  <Switch.Root
                    checked={displayTempLayerEnabled}
                    onCheckedChange={handleTempLayerEnabledChange}
                    className="w-11 h-6 rounded-full relative data-[state=checked]:bg-[var(--color-electric)] bg-[var(--color-surface)] border border-[var(--color-border)] transition-colors cursor-pointer"
                  >
                    <Switch.Thumb className="block w-5 h-5 rounded-full transition-transform data-[state=checked]:translate-x-5 translate-x-0.5 will-change-transform bg-white border border-[var(--color-border)]" />
                  </Switch.Root>
                </div>
              </div>

              {displayTempLayerEnabled && (
                <div className="space-y-4 mt-6">
                  {/* Layer Selection */}
                  <div>
                    <label className="text-sm text-[var(--color-text-secondary)] mb-3 block">
                      {t("trackball.tempLayerLayer")}
                    </label>
                    {layers.length > 0 ? (
                      <select
                        value={displayTempLayerLayer}
                        onChange={(e) =>
                          handleTempLayerLayerChange(Number(e.target.value))
                        }
                        className="w-full px-4 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] text-sm cursor-pointer hover:border-[var(--color-border-hover)] focus:outline-none focus:border-[var(--color-electric)] transition-colors"
                      >
                        {layers.map((layer) => (
                          <option key={layer.id} value={layer.id}>
                            {layer.name || t("trackball.layerName", { name: `Layer ${layer.id}` })}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <p className="text-xs text-[var(--color-text-muted)]">
                        {t("trackball.loadingLayers")}
                      </p>
                    )}
                  </div>

                  {/* Activation Delay */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm text-[var(--color-text-secondary)]">
                        {t("trackball.tempLayerActivationDelay")}
                      </label>
                      <span className="text-sm font-mono text-[var(--color-electric)]">
                        {displayTempLayerActivationDelay}ms
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1000}
                      step={50}
                      value={displayTempLayerActivationDelay}
                      onChange={(e) =>
                        handleTempLayerActivationDelayChange(
                          Number(e.target.value),
                        )
                      }
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
                    <p className="text-xs text-[var(--color-text-muted)] mt-2">
                      {t("trackball.activationDelayDescription")}
                    </p>
                  </div>

                  {/* Deactivation Delay */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm text-[var(--color-text-secondary)]">
                        {t("trackball.deactivationDelay")}
                      </label>
                      <span className="text-sm font-mono text-[var(--color-electric)]">
                        {displayTempLayerDeactivationDelay}ms
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={2000}
                      step={100}
                      value={displayTempLayerDeactivationDelay}
                      onChange={(e) =>
                        handleTempLayerDeactivationDelayChange(
                          Number(e.target.value),
                        )
                      }
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
                    <p className="text-xs text-[var(--color-text-muted)] mt-2">
                      {t("trackball.deactivationDelayDescription")}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
