/**
 * SensorRotationConfig Component
 *
 * Displays and configures rotary encoder sensor bindings for the selected layer.
 * Shows multiple sensors horizontally with wrapping.
 */
import { useState, useCallback, useEffect, useMemo } from "react";
import {
  IconRotateClockwise,
  IconRotateClockwise2,
  IconLoader2,
} from "@tabler/icons-react";
import { useRuntimeSensorRotate } from "../hooks/useRuntimeSensorRotate";
import type { LayerBindings, Binding } from "../hooks/useRuntimeSensorRotate";
import type { BehaviorDefinition } from "../hooks/useKeymap";
import type { BehaviorBinding } from "../hooks/useKeymap";
import { KeycodeSelector } from "./KeycodeSelector";

interface SensorRotationConfigProps {
  selectedLayerId: number;
  behaviors: Map<number, BehaviorDefinition>;
  layers: Array<{ id: number; name: string }>;
}

export function SensorRotationConfig({
  selectedLayerId,
  behaviors,
  layers,
}: SensorRotationConfigProps) {
  const sensorRotate = useRuntimeSensorRotate();

  // Local state for sensor bindings per sensor
  const [sensorBindings, setSensorBindings] = useState<
    Map<number, LayerBindings[]>
  >(new Map());

  // State for behavior selector dialog
  const [showBehaviorSelector, setShowBehaviorSelector] = useState(false);
  const [editingConfig, setEditingConfig] = useState<{
    sensorIndex: number;
    direction: "clockwise" | "counterClockwise";
    currentBinding: Binding | null;
  } | null>(null);

  // Load bindings for all sensors
  useEffect(() => {
    if (!sensorRotate.isAvailable || sensorRotate.sensors.length === 0) {
      return;
    }

    const loadAllBindings = async () => {
      const allBindings = new Map<number, LayerBindings[]>();
      for (const sensor of sensorRotate.sensors) {
        const bindings = await sensorRotate.getAllLayerBindings(sensor.index);
        allBindings.set(sensor.index, bindings);
      }
      setSensorBindings(allBindings);
    };

    loadAllBindings();
  }, [sensorRotate.sensors, sensorRotate.isAvailable, sensorRotate]);

  // Get bindings for a specific sensor and layer
  const getBindingsForLayer = useCallback(
    (sensorIndex: number, layerId: number): LayerBindings | null => {
      const bindings = sensorBindings.get(sensorIndex);
      if (!bindings) return null;
      return bindings.find((b) => b.layer === layerId) ?? null;
    },
    [sensorBindings],
  );

  // Handle clicking on a sensor binding to edit it
  const handleBindingClick = useCallback(
    (sensorIndex: number, direction: "clockwise" | "counterClockwise") => {
      const layerBindings = getBindingsForLayer(sensorIndex, selectedLayerId);

      const currentBinding =
        direction === "clockwise"
          ? (layerBindings?.cwBinding ?? null)
          : (layerBindings?.ccwBinding ?? null);

      setEditingConfig({
        sensorIndex,
        direction,
        currentBinding,
      });
      setShowBehaviorSelector(true);
    },
    [getBindingsForLayer, selectedLayerId],
  );

  // Handle behavior selection from the dialog
  const handleBehaviorSelect = useCallback(
    async (binding: BehaviorBinding) => {
      if (!editingConfig) return;

      const { sensorIndex, direction } = editingConfig;
      const layerBindings = getBindingsForLayer(sensorIndex, selectedLayerId);

      // Create new binding with tap_ms from current or default to 5ms
      const tapMs =
        layerBindings?.cwBinding?.tapMs ||
        layerBindings?.ccwBinding?.tapMs ||
        5;

      const newBinding: Binding = {
        behaviorId: binding.behaviorId,
        param1: binding.param1,
        param2: binding.param2,
        tapMs,
      };

      // Determine cw and ccw bindings
      const cwBinding =
        direction === "clockwise"
          ? newBinding
          : (layerBindings?.cwBinding ?? {
              behaviorId: 0,
              param1: 0,
              param2: 0,
              tapMs,
            });

      const ccwBinding =
        direction === "counterClockwise"
          ? newBinding
          : (layerBindings?.ccwBinding ?? {
              behaviorId: 0,
              param1: 0,
              param2: 0,
              tapMs,
            });

      // Send to device
      const success = await sensorRotate.setLayerBindings(
        sensorIndex,
        selectedLayerId,
        cwBinding,
        ccwBinding,
      );

      if (success) {
        // Update local state optimistically
        setSensorBindings((prev) => {
          const newBindings = new Map(prev);
          const sensorBindingsList = newBindings.get(sensorIndex) ?? [];
          const updatedBindings = sensorBindingsList.filter(
            (b) => b.layer !== selectedLayerId,
          );
          updatedBindings.push({
            layer: selectedLayerId,
            cwBinding,
            ccwBinding,
          });
          newBindings.set(sensorIndex, updatedBindings);
          return newBindings;
        });
      }

      setShowBehaviorSelector(false);
      setEditingConfig(null);
    },
    [editingConfig, getBindingsForLayer, selectedLayerId, sensorRotate],
  );

  // Get display name for a sensor binding
  const getBindingDisplayName = useCallback(
    (binding: Binding | null | undefined): string => {
      if (!binding || binding.behaviorId === 0) {
        return "None";
      }
      const behavior = behaviors.get(binding.behaviorId);
      if (!behavior) {
        return `Behavior ${binding.behaviorId}`;
      }
      return behavior.displayName;
    },
    [behaviors],
  );

  // Convert Binding to BehaviorBinding for KeycodeSelector
  const currentBindingForSelector = useMemo(() => {
    if (!editingConfig || !editingConfig.currentBinding) return null;
    return {
      behaviorId: editingConfig.currentBinding.behaviorId,
      param1: editingConfig.currentBinding.param1,
      param2: editingConfig.currentBinding.param2,
    };
  }, [editingConfig]);

  return (
    <>
      <div className="glass-card p-6">
        <h3 className="text-sm font-medium text-[var(--color-text)] mb-4">
          Rotary Encoder Configuration
        </h3>

        {/* Sensors Grid */}
        <div className="flex flex-wrap gap-4">
          {sensorRotate.sensors.map((sensor) => {
            const layerBindings = getBindingsForLayer(
              sensor.index,
              selectedLayerId,
            );
            const cwBinding = layerBindings?.cwBinding;
            const ccwBinding = layerBindings?.ccwBinding;

            return (
              <div
                key={sensor.index}
                className="flex-1 min-w-[280px] max-w-[400px] p-4 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)]"
              >
                {/* Sensor Name */}
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-full bg-[var(--color-electric)]/10 border border-[var(--color-electric)]/20 flex items-center justify-center">
                    <span className="text-xs font-mono text-[var(--color-electric)]">
                      {sensor.index}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[var(--color-text)]">
                      {sensor.name}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      Rotary Encoder
                    </p>
                  </div>
                </div>

                {/* Rotation Bindings */}
                <div className="space-y-3">
                  {/* Clockwise */}
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <IconRotateClockwise
                        size={16}
                        className="text-[var(--color-neon)]"
                      />
                      <span className="text-xs text-[var(--color-text-muted)]">
                        Clockwise
                      </span>
                    </div>
                    <button
                      className="w-full px-3 py-2 rounded bg-[var(--color-border)] hover:bg-[var(--color-border-hover)] text-left text-sm text-[var(--color-text-secondary)] transition-colors"
                      onClick={() =>
                        handleBindingClick(sensor.index, "clockwise")
                      }
                    >
                      {getBindingDisplayName(cwBinding)}
                    </button>
                  </div>

                  {/* Counter-clockwise */}
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <IconRotateClockwise2
                        size={16}
                        className="text-[var(--color-cyber)]"
                      />
                      <span className="text-xs text-[var(--color-text-muted)]">
                        Counter-clockwise
                      </span>
                    </div>
                    <button
                      className="w-full px-3 py-2 rounded bg-[var(--color-border)] hover:bg-[var(--color-border-hover)] text-left text-sm text-[var(--color-text-secondary)] transition-colors"
                      onClick={() =>
                        handleBindingClick(sensor.index, "counterClockwise")
                      }
                    >
                      {getBindingDisplayName(ccwBinding)}
                    </button>
                  </div>

                  {/* Tap Time */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-[var(--color-text-muted)]">
                        Tap Time
                      </span>
                      <span className="text-xs font-mono text-[var(--color-text-secondary)]">
                        {cwBinding?.tapMs || ccwBinding?.tapMs || 5} ms
                      </span>
                    </div>
                    <div className="text-xs text-[var(--color-text-muted)] opacity-70">
                      Time between rotation triggers
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Loading State */}
        {sensorRotate.isLoading && (
          <div className="flex items-center justify-center gap-2 py-4">
            <IconLoader2
              size={16}
              className="animate-spin text-[var(--color-electric)]"
            />
            <span className="text-sm text-[var(--color-text-muted)]">
              Loading sensors...
            </span>
          </div>
        )}

        {/* Empty State */}
        {!sensorRotate.isLoading &&
          sensorRotate.sensors.length === 0 &&
          sensorRotate.isAvailable && (
            <div className="text-center py-4">
              <p className="text-sm text-[var(--color-text-muted)]">
                No rotary encoders detected
              </p>
            </div>
          )}

        {/* Info */}
        <div className="mt-4 p-3 rounded bg-[var(--color-border)] border border-[var(--color-border-hover)]">
          <p className="text-xs text-[var(--color-text-muted)]">
            Configure rotary encoder bindings for the selected layer. Click on a
            binding to change its behavior.
          </p>
        </div>
      </div>

      {/* Behavior Selector Dialog */}
      <KeycodeSelector
        open={showBehaviorSelector}
        onClose={() => {
          setShowBehaviorSelector(false);
          setEditingConfig(null);
        }}
        onSelect={handleBehaviorSelect}
        currentBinding={currentBindingForSelector}
        behaviors={behaviors}
        layers={layers}
      />
    </>
  );
}
