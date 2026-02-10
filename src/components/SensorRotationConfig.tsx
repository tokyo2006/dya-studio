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
import type {
  SensorLayerConfig,
  SensorBinding,
} from "../hooks/useRuntimeSensorRotate";
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

  // Local state for sensor configurations
  const [sensorConfigs, setSensorConfigs] = useState<
    Map<number, SensorLayerConfig>
  >(new Map());

  // State for behavior selector dialog
  const [showBehaviorSelector, setShowBehaviorSelector] = useState(false);
  const [editingConfig, setEditingConfig] = useState<{
    sensorIndex: number;
    direction: "clockwise" | "counterClockwise";
    currentBinding: SensorBinding;
  } | null>(null);

  // Load configurations for all sensors on the current layer
  useEffect(() => {
    if (!sensorRotate.isAvailable || sensorRotate.sensors.length === 0) {
      return;
    }

    const loadConfigs = async () => {
      const configs = new Map<number, SensorLayerConfig>();
      for (const sensor of sensorRotate.sensors) {
        const config = await sensorRotate.getLayerSensorConfig(
          selectedLayerId,
          sensor.index,
        );
        if (config) {
          configs.set(sensor.index, config);
        }
      }
      setSensorConfigs(configs);
    };

    loadConfigs();
  }, [
    selectedLayerId,
    sensorRotate.sensors,
    sensorRotate.isAvailable,
    sensorRotate,
  ]);

  // Handle clicking on a sensor binding to edit it
  const handleBindingClick = useCallback(
    (sensorIndex: number, direction: "clockwise" | "counterClockwise") => {
      const config = sensorConfigs.get(sensorIndex);
      if (!config) return;

      const currentBinding =
        direction === "clockwise" ? config.clockwise : config.counterClockwise;

      setEditingConfig({
        sensorIndex,
        direction,
        currentBinding,
      });
      setShowBehaviorSelector(true);
    },
    [sensorConfigs],
  );

  // Handle behavior selection from the dialog
  const handleBehaviorSelect = useCallback(
    async (binding: BehaviorBinding) => {
      if (!editingConfig) return;

      const { sensorIndex, direction } = editingConfig;
      const currentConfig = sensorConfigs.get(sensorIndex);

      if (!currentConfig) return;

      const updatedConfig: SensorLayerConfig = {
        ...currentConfig,
        [direction]:
          direction === "clockwise"
            ? {
                behaviorId: binding.behaviorId,
                param1: binding.param1,
                param2: binding.param2,
              }
            : currentConfig.clockwise,
        counterClockwise:
          direction === "counterClockwise"
            ? {
                behaviorId: binding.behaviorId,
                param1: binding.param1,
                param2: binding.param2,
              }
            : currentConfig.counterClockwise,
      };

      // Update local state optimistically
      setSensorConfigs((prev) => {
        const newConfigs = new Map(prev);
        newConfigs.set(sensorIndex, updatedConfig);
        return newConfigs;
      });

      // Send to device
      await sensorRotate.setLayerSensorConfig(updatedConfig);

      setShowBehaviorSelector(false);
      setEditingConfig(null);
    },
    [editingConfig, sensorConfigs, sensorRotate],
  );

  // Get display name for a sensor binding
  const getBindingDisplayName = useCallback(
    (binding: SensorBinding): string => {
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

  // Convert SensorBinding to BehaviorBinding for KeycodeSelector
  const currentBindingForSelector = useMemo(() => {
    if (!editingConfig) return null;
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
            const config = sensorConfigs.get(sensor.index);
            const cwBinding = config?.clockwise;
            const ccwBinding = config?.counterClockwise;

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
                      {cwBinding
                        ? getBindingDisplayName(cwBinding)
                        : "Not configured"}
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
                      {ccwBinding
                        ? getBindingDisplayName(ccwBinding)
                        : "Not configured"}
                    </button>
                  </div>

                  {/* Tap Time */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-[var(--color-text-muted)]">
                        Tap Time
                      </span>
                      <span className="text-xs font-mono text-[var(--color-text-secondary)]">
                        {config?.tapMs || 5} ms
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
