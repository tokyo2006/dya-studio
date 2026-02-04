import { useState, useEffect, useRef } from "react";
import { IconPointer, IconCheck } from "@tabler/icons-react";
import * as Switch from "@radix-ui/react-switch";
import { useRuntimeInputProcessor } from "../hooks/useRuntimeInputProcessor";
import { useKeymap } from "../hooks/useKeymap";
import { ButtonListSelector } from "../components/ButtonListSelector";

// Speed multiplier options for trackball scaling
const SPEED_OPTIONS = [
  { value: 50, label: "0.5x", shortLabel: "0.5x" },
  { value: 75, label: "0.75x", shortLabel: "0.75x" },
  { value: 100, label: "1.0x", shortLabel: "1.0x" },
  { value: 150, label: "1.5x", shortLabel: "1.5x" },
  { value: 200, label: "2.0x", shortLabel: "2.0x" },
  { value: 300, label: "3.0x", shortLabel: "3.0x" },
];

// Rotation angle options
const ROTATION_OPTIONS = [
  { value: 0, label: "0°", shortLabel: "0°" },
  { value: 90, label: "90°", shortLabel: "90°" },
  { value: 180, label: "180°", shortLabel: "180°" },
  { value: 270, label: "270°", shortLabel: "270°" },
];

// Auto-save debounce delay in milliseconds
const AUTO_SAVE_DELAY_MS = 1000;

export function TrackballPage() {
  const {
    processors,
    isLoading,
    error,
    setScaling,
    setRotation,
    setTempLayerEnabled,
    setTempLayerLayer,
    setTempLayerActivationDelay,
    setTempLayerDeactivationDelay,
  } = useRuntimeInputProcessor();

  const keymap = useKeymap();

  // Selected processor index
  const [selectedProcessorIndex, setSelectedProcessorIndex] = useState(0);

  // Local state for pending changes (before auto-save)
  const [pendingSpeed, setPendingSpeed] = useState<number | null>(null);
  const [pendingRotation, setPendingRotation] = useState<number | null>(null);
  const [pendingTempLayerEnabled, setPendingTempLayerEnabled] = useState<
    boolean | null
  >(null);
  const [pendingTempLayerLayer, setPendingTempLayerLayer] = useState<
    number | null
  >(null);
  const [pendingTempLayerActivationDelay, setPendingTempLayerActivationDelay] =
    useState<number | null>(null);
  const [
    pendingTempLayerDeactivationDelay,
    setPendingTempLayerDeactivationDelay,
  ] = useState<number | null>(null);

  // Save status visualization
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "pending" | "saving" | "saved"
  >("idle");

  // Debounce timer refs
  const speedTimerRef = useRef<number | null>(null);
  const rotationTimerRef = useRef<number | null>(null);
  const tempLayerEnabledTimerRef = useRef<number | null>(null);
  const tempLayerLayerTimerRef = useRef<number | null>(null);
  const tempLayerActivationDelayTimerRef = useRef<number | null>(null);
  const tempLayerDeactivationDelayTimerRef = useRef<number | null>(null);
  const saveStatusTimerRef = useRef<number | null>(null);

  // Track previous processor to detect changes
  const previousProcessorRef = useRef<string | null>(null);

  // Get the selected processor
  const processor = processors[selectedProcessorIndex] || null;

  // Reset pending state when processor changes (derived state pattern)
  const currentProcessorName = processor?.name || null;
  if (previousProcessorRef.current !== currentProcessorName) {
    previousProcessorRef.current = currentProcessorName;
    // Reset pending states and status when processor changes
    if (pendingSpeed !== null) setPendingSpeed(null);
    if (pendingRotation !== null) setPendingRotation(null);
    if (pendingTempLayerEnabled !== null) setPendingTempLayerEnabled(null);
    if (pendingTempLayerLayer !== null) setPendingTempLayerLayer(null);
    if (pendingTempLayerActivationDelay !== null)
      setPendingTempLayerActivationDelay(null);
    if (pendingTempLayerDeactivationDelay !== null)
      setPendingTempLayerDeactivationDelay(null);
    if (saveStatus !== "idle") setSaveStatus("idle");
  }

  // Calculate current speed as percentage (multiplier/divisor * 100)
  const currentSpeed = processor
    ? Math.round((processor.scaleMultiplier / processor.scaleDivisor) * 100)
    : 100;

  // Use pending speed if available, otherwise use current speed
  const displaySpeed = pendingSpeed !== null ? pendingSpeed : currentSpeed;
  const displayRotation =
    pendingRotation !== null
      ? pendingRotation
      : processor?.rotationDegrees || 0;

  // Temp layer display values
  const displayTempLayerEnabled =
    pendingTempLayerEnabled !== null
      ? pendingTempLayerEnabled
      : processor?.tempLayerEnabled || false;
  const displayTempLayerLayer =
    pendingTempLayerLayer !== null
      ? pendingTempLayerLayer
      : processor?.tempLayerLayer || 0;
  const displayTempLayerActivationDelay =
    pendingTempLayerActivationDelay !== null
      ? pendingTempLayerActivationDelay
      : processor?.tempLayerActivationDelayMs || 100;
  const displayTempLayerDeactivationDelay =
    pendingTempLayerDeactivationDelay !== null
      ? pendingTempLayerDeactivationDelay
      : processor?.tempLayerDeactivationDelayMs || 500;

  // Get layer options from keymap
  const layerOptions =
    keymap.keymap?.layers.map((layer) => ({
      value: layer.id,
      label: layer.name || `Layer ${layer.id}`,
      shortLabel: layer.name || `L${layer.id}`,
    })) || [];

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (speedTimerRef.current) clearTimeout(speedTimerRef.current);
      if (rotationTimerRef.current) clearTimeout(rotationTimerRef.current);
      if (tempLayerEnabledTimerRef.current)
        clearTimeout(tempLayerEnabledTimerRef.current);
      if (tempLayerLayerTimerRef.current)
        clearTimeout(tempLayerLayerTimerRef.current);
      if (tempLayerActivationDelayTimerRef.current)
        clearTimeout(tempLayerActivationDelayTimerRef.current);
      if (tempLayerDeactivationDelayTimerRef.current)
        clearTimeout(tempLayerDeactivationDelayTimerRef.current);
      if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current);
    };
  }, []);

  // Auto-save speed with debouncing
  const handleSpeedChange = (speedPercent: number) => {
    if (!processor) return;

    setPendingSpeed(speedPercent);
    setSaveStatus("pending");

    // Clear existing timer
    if (speedTimerRef.current) {
      clearTimeout(speedTimerRef.current);
    }

    // Set new timer for auto-save
    speedTimerRef.current = setTimeout(async () => {
      setSaveStatus("saving");
      // Convert percentage to multiplier/divisor
      await setScaling(processor.id, speedPercent, 100);
      setPendingSpeed(null);
      setSaveStatus("saved");

      // Clear "saved" status after 2 seconds
      if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current);
      saveStatusTimerRef.current = setTimeout(() => {
        setSaveStatus("idle");
      }, 2000);
    }, AUTO_SAVE_DELAY_MS);
  };

  // Auto-save rotation with debouncing
  const handleRotationChange = (degrees: number) => {
    if (!processor) return;

    setPendingRotation(degrees);
    setSaveStatus("pending");

    // Clear existing timer
    if (rotationTimerRef.current) {
      clearTimeout(rotationTimerRef.current);
    }

    // Set new timer for auto-save
    rotationTimerRef.current = setTimeout(async () => {
      setSaveStatus("saving");
      await setRotation(processor.id, degrees);
      setPendingRotation(null);
      setSaveStatus("saved");

      // Clear "saved" status after 2 seconds
      if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current);
      saveStatusTimerRef.current = setTimeout(() => {
        setSaveStatus("idle");
      }, 2000);
    }, AUTO_SAVE_DELAY_MS);
  };

  // Handle temp layer enabled toggle
  const handleTempLayerEnabledChange = (enabled: boolean) => {
    if (!processor) return;

    setPendingTempLayerEnabled(enabled);
    setSaveStatus("pending");

    if (tempLayerEnabledTimerRef.current) {
      clearTimeout(tempLayerEnabledTimerRef.current);
    }

    tempLayerEnabledTimerRef.current = setTimeout(async () => {
      setSaveStatus("saving");
      await setTempLayerEnabled(processor.id, enabled);
      setPendingTempLayerEnabled(null);
      setSaveStatus("saved");

      if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current);
      saveStatusTimerRef.current = setTimeout(() => {
        setSaveStatus("idle");
      }, 2000);
    }, AUTO_SAVE_DELAY_MS);
  };

  // Handle temp layer layer selection
  const handleTempLayerLayerChange = (layer: number) => {
    if (!processor) return;

    setPendingTempLayerLayer(layer);
    setSaveStatus("pending");

    if (tempLayerLayerTimerRef.current) {
      clearTimeout(tempLayerLayerTimerRef.current);
    }

    tempLayerLayerTimerRef.current = setTimeout(async () => {
      setSaveStatus("saving");
      await setTempLayerLayer(processor.id, layer);
      setPendingTempLayerLayer(null);
      setSaveStatus("saved");

      if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current);
      saveStatusTimerRef.current = setTimeout(() => {
        setSaveStatus("idle");
      }, 2000);
    }, AUTO_SAVE_DELAY_MS);
  };

  // Handle temp layer activation delay
  const handleTempLayerActivationDelayChange = (delayMs: number) => {
    if (!processor) return;

    setPendingTempLayerActivationDelay(delayMs);
    setSaveStatus("pending");

    if (tempLayerActivationDelayTimerRef.current) {
      clearTimeout(tempLayerActivationDelayTimerRef.current);
    }

    tempLayerActivationDelayTimerRef.current = setTimeout(async () => {
      setSaveStatus("saving");
      await setTempLayerActivationDelay(processor.id, delayMs);
      setPendingTempLayerActivationDelay(null);
      setSaveStatus("saved");

      if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current);
      saveStatusTimerRef.current = setTimeout(() => {
        setSaveStatus("idle");
      }, 2000);
    }, AUTO_SAVE_DELAY_MS);
  };

  // Handle temp layer deactivation delay
  const handleTempLayerDeactivationDelayChange = (delayMs: number) => {
    if (!processor) return;

    setPendingTempLayerDeactivationDelay(delayMs);
    setSaveStatus("pending");

    if (tempLayerDeactivationDelayTimerRef.current) {
      clearTimeout(tempLayerDeactivationDelayTimerRef.current);
    }

    tempLayerDeactivationDelayTimerRef.current = setTimeout(async () => {
      setSaveStatus("saving");
      await setTempLayerDeactivationDelay(processor.id, delayMs);
      setPendingTempLayerDeactivationDelay(null);
      setSaveStatus("saved");

      if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current);
      saveStatusTimerRef.current = setTimeout(() => {
        setSaveStatus("idle");
      }, 2000);
    }, AUTO_SAVE_DELAY_MS);
  };

  // Handle processor selection change
  const handleProcessorChange = (index: number) => {
    // Save any pending changes before switching
    if (speedTimerRef.current) {
      clearTimeout(speedTimerRef.current);
      if (pendingSpeed !== null && processor) {
        setScaling(processor.id, pendingSpeed, 100);
      }
    }
    if (rotationTimerRef.current) {
      clearTimeout(rotationTimerRef.current);
      if (pendingRotation !== null && processor) {
        setRotation(processor.id, pendingRotation);
      }
    }

    setSelectedProcessorIndex(index);
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
                <ButtonListSelector
                  options={processors.map((p, index) => ({
                    value: index,
                    label: p.name,
                    shortLabel: p.name,
                  }))}
                  value={selectedProcessorIndex}
                  onChange={handleProcessorChange}
                  columns={Math.min(processors.length, 3)}
                />
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

            {/* Speed Setting */}
            <div className="glass-card p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-medium text-[var(--color-text)]">
                    Pointer Speed
                  </h3>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    Adjust sensitivity multiplier
                  </p>
                </div>
                <span className="text-lg font-mono text-[var(--color-electric)]">
                  {(displaySpeed / 100).toFixed(1)}x
                </span>
              </div>

              {/* Slider for continuous adjustment */}
              <div className="mb-4">
                <input
                  type="range"
                  min={10}
                  max={500}
                  step={5}
                  value={displaySpeed}
                  onChange={(e) => handleSpeedChange(Number(e.target.value))}
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
                  <span>0.1x</span>
                  <span>5.0x</span>
                </div>
              </div>

              {/* Preset buttons */}
              <ButtonListSelector
                options={SPEED_OPTIONS}
                value={displaySpeed}
                onChange={handleSpeedChange}
                columns={3}
              />
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
                <span className="text-lg font-mono text-[var(--color-electric)]">
                  {displayRotation}°
                </span>
              </div>

              {/* Slider for continuous adjustment */}
              <div className="mb-4">
                <input
                  type="range"
                  min={0}
                  max={359}
                  step={1}
                  value={displayRotation}
                  onChange={(e) => handleRotationChange(Number(e.target.value))}
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
                  <span>0°</span>
                  <span>359°</span>
                </div>
              </div>

              {/* Preset buttons */}
              <ButtonListSelector
                options={ROTATION_OPTIONS}
                value={displayRotation}
                onChange={handleRotationChange}
                columns={4}
              />
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
                    {layerOptions.length > 0 ? (
                      <ButtonListSelector
                        options={layerOptions}
                        value={displayTempLayerLayer}
                        onChange={handleTempLayerLayerChange}
                        columns={Math.min(layerOptions.length, 4)}
                      />
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
