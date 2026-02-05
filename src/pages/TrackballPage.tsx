import { useState, useRef } from "react";
import { IconPointer, IconCheck } from "@tabler/icons-react";
import * as Switch from "@radix-ui/react-switch";
import { useRuntimeInputProcessor } from "../hooks/useRuntimeInputProcessor";
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
  const {
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
  } = useRuntimeInputProcessor();

  // Selected processor index
  const [selectedProcessorIndex, setSelectedProcessorIndex] = useState(0);

  // Scaling preset type selector
  const [scalingPresetType, setScalingPresetType] =
    useState<ScalingPresetType>("wheel");

  // Rotation enabled state
  const [rotationEnabled, setRotationEnabled] = useState(false);

  // Debounced save hooks for each field
  const scalingMultiplierSave = useDebouncedSave<number>();
  const scalingDivisorSave = useDebouncedSave<number>();
  const rotationSave = useDebouncedSave<number>();
  const tempLayerEnabledSave = useDebouncedSave<boolean>();
  const tempLayerLayerSave = useDebouncedSave<number>();
  const tempLayerActivationDelaySave = useDebouncedSave<number>();
  const tempLayerDeactivationDelaySave = useDebouncedSave<number>();
  const activeLayersSave = useDebouncedSave<number[]>();

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
    setRotationEnabled(processor?.rotationDegrees !== 0);
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
    activeLayersSave.pendingValue ?? processor?.activeLayers ?? [];

  // Calculate final scaling value (multiplier/divisor)
  const finalScalingValue =
    displayScalingDivisor !== 0
      ? displayScalingMultiplier / displayScalingDivisor
      : 1;

  // Aggregate save status from all debounced saves
  const saveStatus =
    scalingMultiplierSave.saveStatus !== "idle"
      ? scalingMultiplierSave.saveStatus
      : scalingDivisorSave.saveStatus !== "idle"
        ? scalingDivisorSave.saveStatus
        : rotationSave.saveStatus !== "idle"
          ? rotationSave.saveStatus
          : tempLayerEnabledSave.saveStatus !== "idle"
            ? tempLayerEnabledSave.saveStatus
            : tempLayerLayerSave.saveStatus !== "idle"
              ? tempLayerLayerSave.saveStatus
              : tempLayerActivationDelaySave.saveStatus !== "idle"
                ? tempLayerActivationDelaySave.saveStatus
                : tempLayerDeactivationDelaySave.saveStatus !== "idle"
                  ? tempLayerDeactivationDelaySave.saveStatus
                  : activeLayersSave.saveStatus !== "idle"
                    ? activeLayersSave.saveStatus
                    : "idle";

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
    scalingMultiplierSave.setPendingValue(multiplier, async (m) => {
      await setScaling(processor.id, m, divisor);
    });
    scalingDivisorSave.setPendingValue(divisor, async (d) => {
      const m = scalingMultiplierSave.pendingValue ?? multiplier;
      await setScaling(processor.id, m, d);
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

  const handleActiveLayersChange = (layerIds: number[]) => {
    if (!processor) return;
    activeLayersSave.setPendingValue(layerIds, async (value) => {
      await setActiveLayers(processor.id, value);
    });
  };

  const handleLayerToggle = (layerId: number) => {
    const currentLayers = displayActiveLayers;
    const newLayers = currentLayers.includes(layerId)
      ? currentLayers.filter((id) => id !== layerId)
      : [...currentLayers, layerId];
    handleActiveLayersChange(newLayers);
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
              Trackball Settings
            </h1>
            <p className="text-sm text-[var(--color-text-muted)]">
              Adjust sensitivity and behavior via runtime input processor
            </p>
          </div>
        </div>

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
              Loading trackball settings...
            </p>
          </div>
        )}

        {/* No processor found */}
        {!isLoading && !processor && !error && (
          <div className="mb-6 p-4 rounded-lg bg-[var(--color-border)] border border-[var(--color-border-hover)]">
            <p className="text-sm text-[var(--color-text-muted)]">
              No runtime input processor found. Make sure your firmware has the
              runtime input processor module enabled.
            </p>
          </div>
        )}

        {/* Settings */}
        {processor && (
          <div className="space-y-6">
            {/* Processor Selector (if multiple processors) */}
            {processors.length > 1 && (
              <div className="glass-card p-6">
                <h3 className="text-sm font-medium text-[var(--color-text)] mb-4">
                  Select Processor
                </h3>
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

            {/* Processor Info with Save Status */}
            <div className="glass-card p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[var(--color-text)]">
                  Active Processor
                </p>
                <p className="text-xs text-[var(--color-text-muted)]">
                  {processors.length > 1
                    ? "Selected processor"
                    : "Detected from device"}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-mono text-[var(--color-neon)]">
                  {processor.name}
                </span>
                {saveStatus !== "idle" && (
                  <div className="flex items-center gap-2">
                    {saveStatus === "pending" && (
                      <span className="text-xs text-[var(--color-text-muted)]">
                        Pending...
                      </span>
                    )}
                    {saveStatus === "saving" && (
                      <span className="text-xs text-[var(--color-electric)]">
                        Saving...
                      </span>
                    )}
                    {saveStatus === "saved" && (
                      <div className="flex items-center gap-1 text-[var(--color-neon)]">
                        <IconCheck size={16} />
                        <span className="text-xs">Saved</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Active Layers Selection */}
            <div className="glass-card p-6">
              <h3 className="text-sm font-medium text-[var(--color-text)] mb-4">
                Active on Layers
              </h3>
              <p className="text-xs text-[var(--color-text-muted)] mb-4">
                Select which layers this processor should be active on. Empty
                selection means active on all layers.
              </p>
              <div className="space-y-2">
                {layers.length > 0 ? (
                  layers.map((layer) => (
                    <label
                      key={layer.id}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-[var(--color-border)]/50 cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={displayActiveLayers.includes(layer.id)}
                        onChange={() => handleLayerToggle(layer.id)}
                        className="w-4 h-4 rounded border-[var(--color-border)] text-[var(--color-electric)] focus:ring-[var(--color-electric)] focus:ring-offset-0 cursor-pointer"
                      />
                      <span className="text-sm text-[var(--color-text-secondary)]">
                        {layer.name || `Layer ${layer.id}`}
                      </span>
                    </label>
                  ))
                ) : (
                  <p className="text-xs text-[var(--color-text-muted)]">
                    Loading layers...
                  </p>
                )}
              </div>
            </div>

            {/* Scaling Setting */}
            <div className="glass-card p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-medium text-[var(--color-text)]">
                    Scaling
                  </h3>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    Adjust sensitivity multiplier and divisor
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
                    Multiplier
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
                    Divisor
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
                  Wheel/Mouse
                </button>
                <button
                  onClick={() => setScalingPresetType("scroll")}
                  className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    scalingPresetType === "scroll"
                      ? "bg-[var(--color-electric)] text-white"
                      : "bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]"
                  }`}
                >
                  Scroll
                </button>
              </div>

              {/* Preset Buttons */}
              <div className="grid grid-cols-3 gap-2">
                {(scalingPresetType === "wheel"
                  ? WHEEL_PRESETS
                  : SCROLL_PRESETS
                ).map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() =>
                      handleScalingPreset(preset.multiplier, preset.divisor)
                    }
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      displayScalingMultiplier === preset.multiplier &&
                      displayScalingDivisor === preset.divisor
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
                    Sensor Rotation
                  </h3>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    Rotate input for different mounting angles
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-lg font-mono text-[var(--color-electric)]">
                    {displayRotation}°
                  </span>
                  <Switch.Root
                    checked={rotationEnabled}
                    onCheckedChange={handleRotationEnabledChange}
                    className="w-11 h-6 rounded-full relative data-[state=checked]:bg-[var(--color-electric)] bg-[var(--color-surface)] border border-[var(--color-border)] transition-colors cursor-pointer"
                  >
                    <Switch.Thumb className="block w-5 h-5 bg-white rounded-full transition-transform data-[state=checked]:translate-x-5 translate-x-0.5 will-change-transform" />
                  </Switch.Root>
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

            {/* Temp Layer Settings */}
            <div className="glass-card p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-medium text-[var(--color-text)]">
                    Temporary Layer
                  </h3>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    Auto-activate layer when trackball is in use
                  </p>
                </div>
                <Switch.Root
                  checked={displayTempLayerEnabled}
                  onCheckedChange={handleTempLayerEnabledChange}
                  className="w-11 h-6 rounded-full relative data-[state=checked]:bg-[var(--color-electric)] bg-[var(--color-surface)] border border-[var(--color-border)] transition-colors cursor-pointer"
                >
                  <Switch.Thumb className="block w-5 h-5 bg-white rounded-full transition-transform data-[state=checked]:translate-x-5 translate-x-0.5 will-change-transform" />
                </Switch.Root>
              </div>

              {displayTempLayerEnabled && (
                <div className="space-y-4 mt-6">
                  {/* Layer Selection */}
                  <div>
                    <label className="text-sm text-[var(--color-text-secondary)] mb-3 block">
                      Target Layer
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
                            {layer.name || `Layer ${layer.id}`}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <p className="text-xs text-[var(--color-text-muted)]">
                        Loading layers...
                      </p>
                    )}
                  </div>

                  {/* Activation Delay */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm text-[var(--color-text-secondary)]">
                        Activation Delay
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
                      Delay before activating layer when trackball moves
                    </p>
                  </div>

                  {/* Deactivation Delay */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm text-[var(--color-text-secondary)]">
                        Deactivation Delay
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
                      Delay before deactivating layer when trackball stops
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Current Settings Display */}
            <div className="glass-card p-6">
              <h3 className="text-sm font-medium text-[var(--color-text)] mb-4">
                Current Configuration
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="data-card">
                  <span className="data-card-label">Scale Multiplier</span>
                  <span className="data-card-value text-[var(--color-neon)]">
                    {processor.scaleMultiplier}
                  </span>
                </div>
                <div className="data-card">
                  <span className="data-card-label">Scale Divisor</span>
                  <span className="data-card-value text-[var(--color-neon)]">
                    {processor.scaleDivisor}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Info */}
        <div className="mt-8 p-4 rounded-lg bg-[var(--color-border)] border border-[var(--color-border-hover)]">
          <p className="text-xs text-[var(--color-text-muted)]">
            Runtime input processor allows you to adjust trackball sensitivity,
            rotation, and temporary layer activation without rebuilding
            firmware. Changes are automatically saved to the device after 1
            second and persist across reboots.
          </p>
        </div>
      </div>
    </div>
  );
}
