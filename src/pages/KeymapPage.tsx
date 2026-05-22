import { useTranslation } from "react-i18next";
import { useState, useContext, useCallback, useMemo } from "react";
import {
  IconKeyboard,
  IconDeviceFloppy,
  IconChevronUp,
  IconChevronDown,
  IconAlertCircle,
  IconLoader2,
  IconPlus,
  IconTrash,
  IconRestore,
  IconAlertTriangle,
  IconInfoCircle,
} from "@tabler/icons-react";
import * as Tooltip from "@radix-ui/react-tooltip";
import { ConnectionContext } from "../components/DeviceConnection";
import { KeyboardLayoutContext } from "../contexts/KeyboardLayoutContext";
import { KeyboardLayout } from "../components/KeyboardLayout";
import { KeycodeSelector } from "../components/KeycodeSelector";
import { UnlockPrompt } from "../components/UnlockPrompt";
import { SensorRotationConfig } from "../components/SensorRotationConfig";
import { useKeymap } from "../hooks/useKeymap";
import { usePhysicalLayoutModules } from "../hooks/usePhysicalLayoutModules";
import { useRuntimeSensorRotate } from "../hooks/useRuntimeSensorRotate";
import { getAvailableLayouts, getLayoutLabel } from "../lib/keyboardLayouts";
import type { BehaviorBinding } from "../hooks/useKeymap";

export function KeymapPage() {
  const { t } = useTranslation();
  const connection = useContext(ConnectionContext);
  const keyboardLayoutContext = useContext(KeyboardLayoutContext);
  const keymap = useKeymap();
  const physicalLayoutModules = usePhysicalLayoutModules();
  const sensorRotate = useRuntimeSensorRotate();

  // Local UI state
  const [selectedLayerIndex, setSelectedLayerIndex] = useState(0);
  const [selectedKeyPosition, setSelectedKeyPosition] = useState<number | null>(
    null,
  );
  const [showKeycodeSelector, setShowKeycodeSelector] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDiscarding, setIsDiscarding] = useState(false);

  // Get current layer
  const currentLayer = useMemo(() => {
    if (!keymap.keymap?.layers) return null;
    return keymap.keymap.layers[selectedLayerIndex] ?? null;
  }, [keymap.keymap?.layers, selectedLayerIndex]);

  // Get current physical layout
  const currentLayout = useMemo(() => {
    if (!keymap.physicalLayouts?.layouts) return null;
    const index = keymap.physicalLayouts.activeLayoutIndex;
    return keymap.physicalLayouts.layouts[index] ?? null;
  }, [keymap.physicalLayouts]);

  // Layers for the selector
  const layersForSelector = useMemo(() => {
    if (!keymap.keymap?.layers) return [];
    return keymap.keymap.layers.map((l) => ({ id: l.id, name: l.name }));
  }, [keymap.keymap]);

  // Get current binding for selected key
  const currentBinding = useMemo(() => {
    if (selectedKeyPosition === null || !currentLayer) return null;
    return currentLayer.bindings[selectedKeyPosition] ?? null;
  }, [selectedKeyPosition, currentLayer]);

  // Handle key click
  const handleKeyClick = useCallback((keyPosition: number) => {
    setSelectedKeyPosition(keyPosition);
    setShowKeycodeSelector(true);
  }, []);

  // Handle key reset
  const handleKeyReset = useCallback(
    async (keyPosition: number) => {
      if (!currentLayer) return;
      await keymap.resetBinding(currentLayer.id, keyPosition);
    },
    [currentLayer, keymap],
  );

  // Handle binding selection
  const handleBindingSelect = useCallback(
    async (binding: BehaviorBinding) => {
      if (!currentLayer || selectedKeyPosition === null) return;
      await keymap.setBinding(currentLayer.id, selectedKeyPosition, binding);
      setShowKeycodeSelector(false);
      setSelectedKeyPosition(null);
    },
    [currentLayer, selectedKeyPosition, keymap],
  );

  // Handle save
  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await keymap.saveChanges();
    } finally {
      setIsSaving(false);
    }
  }, [keymap]);

  // Handle discard
  const handleDiscard = useCallback(async () => {
    if (!confirm("Are you sure you want to discard all changes?")) return;
    setIsDiscarding(true);
    try {
      await keymap.discardChanges();
    } finally {
      setIsDiscarding(false);
    }
  }, [keymap]);

  // Handle layer move up
  const handleMoveLayerUp = useCallback(async () => {
    if (selectedLayerIndex <= 0) return;
    const success = await keymap.moveLayer(
      selectedLayerIndex,
      selectedLayerIndex - 1,
    );
    if (success) {
      setSelectedLayerIndex(selectedLayerIndex - 1);
    }
  }, [selectedLayerIndex, keymap]);

  // Handle layer move down
  const handleMoveLayerDown = useCallback(async () => {
    if (!keymap.keymap?.layers) return;
    if (selectedLayerIndex >= keymap.keymap.layers.length - 1) return;
    const success = await keymap.moveLayer(
      selectedLayerIndex,
      selectedLayerIndex + 1,
    );
    if (success) {
      setSelectedLayerIndex(selectedLayerIndex + 1);
    }
  }, [selectedLayerIndex, keymap]);

  // Handle add layer
  const handleAddLayer = useCallback(async () => {
    const result = await keymap.addLayer();
    if (result) {
      // Select the new layer
      setSelectedLayerIndex(result.index);
    }
  }, [keymap]);

  // Handle delete layer
  const handleDeleteLayer = useCallback(async () => {
    if (!keymap.keymap?.layers || keymap.keymap.layers.length <= 1) return;
    if (!confirm("Are you sure you want to delete this layer?")) return;

    const success = await keymap.removeLayer(selectedLayerIndex);
    if (success) {
      // Adjust selected index if we deleted the last layer
      if (selectedLayerIndex >= keymap.keymap.layers.length - 1) {
        setSelectedLayerIndex(Math.max(0, selectedLayerIndex - 1));
      }
    }
  }, [selectedLayerIndex, keymap]);

  // Handle restore layer
  const handleRestoreLayer = useCallback(async () => {
    if (keymap.removedLayerIds.length === 0) return;

    // Restore the most recently removed layer at the end
    const layerId = keymap.removedLayerIds[keymap.removedLayerIds.length - 1];
    const atIndex = keymap.keymap?.layers.length ?? 0;

    const layer = await keymap.restoreLayer(layerId, atIndex);
    if (layer) {
      // Select the restored layer
      setSelectedLayerIndex(atIndex);
    }
  }, [keymap]);

  // Handle unlock retry
  const handleUnlockRetry = useCallback(() => {
    keymap.clearUnlockRequired();
    keymap.loadKeymapData();
  }, [keymap]);

  return (
    <div className="p-6 h-full overflow-auto">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col tablet:flex-row tablet:items-center gap-3 mb-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-[var(--color-electric)]/10 border border-[var(--color-electric)]/20">
              <IconKeyboard
                size={24}
                className="text-[var(--color-electric)]"
              />
            </div>
            <div>
              <h1 className="text-xl font-medium text-[var(--color-text)]">
                {t("keymap.title")}
              </h1>
              <p className="text-sm text-[var(--color-text-muted)]">
                {t("keymap.description")}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          {connection.isConnected && keymap.keymap && (
            <div className="flex items-center gap-2 ml-auto">
              {keymap.hasUnsavedChanges && (
                <span className="text-xs text-[var(--color-neon)] mr-2">
                  {t("keymap.unsavedChanges")}
                </span>
              )}
              <button
                className="btn-ghost text-sm flex items-center gap-1.5 flex-shrink-0"
                onClick={handleDiscard}
                disabled={
                  isDiscarding || !keymap.hasUnsavedChanges || keymap.isLoading
                }
              >
                {isDiscarding ? (
                  <IconLoader2 size={16} className="animate-spin" />
                ) : (
                  <IconRestore size={16} />
                )}
                {t("keymap.resetAll")}
              </button>
              <button
                className="btn-electric text-sm flex items-center gap-1.5"
                onClick={handleSave}
                disabled={
                  isSaving || !keymap.hasUnsavedChanges || keymap.isLoading
                }
              >
                {isSaving ? (
                  <IconLoader2 size={16} className="animate-spin" />
                ) : (
                  <IconDeviceFloppy size={16} />
                )}
                {t("keymap.save")}
              </button>
            </div>
          )}
        </div>

        {/* Not Connected State */}
        {!connection.isConnected && (
          <div className="glass-card p-6 text-center">
            <p className="text-sm text-[var(--color-text-muted)]">
              {t("keymap.connectKeyboardToEdit")}
            </p>
          </div>
        )}

        {/* Error State */}
        {keymap.error && !keymap.unlockRequired && (
          <div className="glass-card p-4 mb-4 border-red-500/20 bg-red-500/10 flex items-center gap-3">
            <IconAlertCircle size={20} className="text-red-400" />
            <p className="text-sm text-red-400">{keymap.error}</p>
          </div>
        )}
        {/* Loading State */}
        {connection.isConnected && keymap.isLoading && (
          <div className="glass-card p-6 text-center mb-6">
            <IconLoader2
              size={24}
              className="animate-spin mx-auto mb-2 text-[var(--color-electric)]"
            />
            <p className="text-sm text-[var(--color-text-muted)]">
              {t("keymap.loadingKeymapData")}
            </p>
          </div>
        )}

        {/* Main Content */}
        {connection.isConnected && keymap.keymap && currentLayout && (
          <>
            {/* Layer Tabs */}
            <div className="flex flex-wrap items-center gap-2 mb-6">
              <div className="flex gap-2 flex-1 overflow-x-auto pb-2 basis-full sm:basis-auto">
                {keymap.keymap.layers.map((layer, index) => (
                  <button
                    key={layer.id}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                      index === selectedLayerIndex
                        ? "bg-[var(--color-electric)]/20 text-[var(--color-electric)] border border-[var(--color-electric)]/30"
                        : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]"
                    }`}
                    onClick={() => setSelectedLayerIndex(index)}
                  >
                    {layer.name || t("keymap.layer", { index: index })}
                  </button>
                ))}
              </div>

              {/* Layer Management Buttons */}
              <Tooltip.Provider delayDuration={200}>
                <div className="flex items-center gap-1 border-l border-[var(--color-border)] pl-2 ml-auto">
                  {/* Layer Sorting Label */}
                  <span className="text-xs text-[var(--color-text-muted)] mr-1">
                    {t("keymap.sort")}
                  </span>

                  {/* Move Up Button */}
                  <Tooltip.Root>
                    <Tooltip.Trigger asChild>
                      <button
                        className="p-2 rounded-lg hover:bg-[var(--color-border)] disabled:opacity-30 disabled:cursor-not-allowed"
                        onClick={handleMoveLayerUp}
                        disabled={selectedLayerIndex <= 0}
                        aria-label="Move layer up (higher priority)"
                      >
                        <IconChevronUp
                          size={16}
                          className="text-[var(--color-text-muted)]"
                        />
                      </button>
                    </Tooltip.Trigger>
                    <Tooltip.Portal>
                      <Tooltip.Content
                        className="px-2 py-1 rounded bg-[var(--color-surface-elevated)] border border-[var(--color-border)] text-xs text-[var(--color-text-secondary)] shadow-lg z-50"
                        sideOffset={5}
                      >
                        {t("keymap.moveLayerUp")}
                        <Tooltip.Arrow className="fill-[var(--color-surface-elevated)]" />
                      </Tooltip.Content>
                    </Tooltip.Portal>
                  </Tooltip.Root>

                  {/* Move Down Button */}
                  <Tooltip.Root>
                    <Tooltip.Trigger asChild>
                      <button
                        className="p-2 rounded-lg hover:bg-[var(--color-border)] disabled:opacity-30 disabled:cursor-not-allowed"
                        onClick={handleMoveLayerDown}
                        disabled={
                          selectedLayerIndex >= keymap.keymap.layers.length - 1
                        }
                        aria-label="Move layer down (lower priority)"
                      >
                        <IconChevronDown
                          size={16}
                          className="text-[var(--color-text-muted)]"
                        />
                      </button>
                    </Tooltip.Trigger>
                    <Tooltip.Portal>
                      <Tooltip.Content
                        className="px-2 py-1 rounded bg-[var(--color-surface-elevated)] border border-[var(--color-border)] text-xs text-[var(--color-text-secondary)] shadow-lg z-50"
                        sideOffset={5}
                      >
                        {t("keymap.moveLayerDown")}
                        <Tooltip.Arrow className="fill-[var(--color-surface-elevated)]" />
                      </Tooltip.Content>
                    </Tooltip.Portal>
                  </Tooltip.Root>
                </div>

                {/* Layer Add/Delete/Restore Buttons */}
                <div className="flex items-center gap-1 border-l border-[var(--color-border)] pl-2">
                  {/* Add Layer Button */}
                  <Tooltip.Root>
                    <Tooltip.Trigger asChild>
                      <button
                        className="p-2 rounded-lg hover:bg-[var(--color-border)] disabled:opacity-30 disabled:cursor-not-allowed"
                        onClick={handleAddLayer}
                        disabled={
                          keymap.availableLayers <= keymap.keymap.layers.length
                        }
                        aria-label="Add new layer"
                      >
                        <IconPlus
                          size={16}
                          className="text-[var(--color-neon)]"
                        />
                      </button>
                    </Tooltip.Trigger>
                    <Tooltip.Portal>
                      <Tooltip.Content
                        className="px-2 py-1 rounded bg-[var(--color-surface-elevated)] border border-[var(--color-border)] text-xs text-[var(--color-text-secondary)] shadow-lg z-50"
                        sideOffset={5}
                      >
                        {t("keymap.addNewLayer")}
                        <Tooltip.Arrow className="fill-[var(--color-surface-elevated)]" />
                      </Tooltip.Content>
                    </Tooltip.Portal>
                  </Tooltip.Root>

                  {/* Delete Layer Button */}
                  <Tooltip.Root>
                    <Tooltip.Trigger asChild>
                      <button
                        className="p-2 rounded-lg hover:bg-[var(--color-border)] disabled:opacity-30 disabled:cursor-not-allowed"
                        onClick={handleDeleteLayer}
                        disabled={keymap.keymap.layers.length <= 1}
                        aria-label="Delete current layer"
                      >
                        <IconTrash size={16} className="text-red-400" />
                      </button>
                    </Tooltip.Trigger>
                    <Tooltip.Portal>
                      <Tooltip.Content
                        className="px-2 py-1 rounded bg-[var(--color-surface-elevated)] border border-[var(--color-border)] text-xs text-[var(--color-text-secondary)] shadow-lg z-50"
                        sideOffset={5}
                      >
                        {t("keymap.deleteCurrentLayer")}
                        <Tooltip.Arrow className="fill-[var(--color-surface-elevated)]" />
                      </Tooltip.Content>
                    </Tooltip.Portal>
                  </Tooltip.Root>

                  {/* Restore Layer Button */}
                  <Tooltip.Root>
                    <Tooltip.Trigger asChild>
                      <button
                        className="p-2 rounded-lg hover:bg-[var(--color-border)] disabled:opacity-30 disabled:cursor-not-allowed"
                        onClick={handleRestoreLayer}
                        disabled={keymap.removedLayerIds.length === 0}
                        aria-label="Restore deleted layer"
                      >
                        <IconRestore
                          size={16}
                          className="text-[var(--color-electric)]"
                        />
                      </button>
                    </Tooltip.Trigger>
                    <Tooltip.Portal>
                      <Tooltip.Content
                        className="px-2 py-1 rounded bg-[var(--color-surface-elevated)] border border-[var(--color-border)] text-xs text-[var(--color-text-secondary)] shadow-lg z-50"
                        sideOffset={5}
                      >
                        {keymap.removedLayerIds.length > 0
                          ? t("keymap.restoreDeletedLayer", {
                              count: keymap.removedLayerIds.length,
                            })
                          : t("keymap.noDeletedLayersToRestore")}
                        <Tooltip.Arrow className="fill-[var(--color-surface-elevated)]" />
                      </Tooltip.Content>
                    </Tooltip.Portal>
                  </Tooltip.Root>
                </div>
              </Tooltip.Provider>
            </div>

            <div className="flex items-center gap-2 justify-between flex-wrap mb-4">
              {/* Physical Layout Selector (if multiple layouts) */}
              {keymap.physicalLayouts &&
                keymap.physicalLayouts.layouts.length > 1 && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[var(--color-text-muted)]">
                      {t("keymap.physicalLayout")}
                    </span>
                    <select
                      value={keymap.physicalLayouts.activeLayoutIndex}
                      onChange={(e) =>
                        keymap.setActiveLayout(Number(e.target.value))
                      }
                      className="px-2 py-1 rounded bg-[var(--color-surface)] border border-[var(--color-border)] text-sm text-[var(--color-text)]"
                    >
                      {keymap.physicalLayouts.layouts.map((_layout, index) => (
                        <option key={index} value={index}>
                          {t("keymap.layer", { index: index + 1 })}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

              {/* Keyboard Layout Selector */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--color-text-muted)]">
                  OS Layout:
                </span>
                <select
                  value={keyboardLayoutContext.layout}
                  onChange={(e) =>
                    keyboardLayoutContext.setLayout(
                      e.target
                        .value as import("../lib/keyboardLayouts").KeyboardLayoutType,
                    )
                  }
                  className="px-2 py-1 rounded bg-[var(--color-surface)] border border-[var(--color-border)] text-sm text-[var(--color-text)]"
                >
                  {getAvailableLayouts().map((layoutType) => (
                    <option key={layoutType} value={layoutType}>
                      {getLayoutLabel(layoutType)}
                    </option>
                  ))}
                </select>
                <Tooltip.Provider delayDuration={200}>
                  {/* Tips: */}
                  <Tooltip.Root>
                    <Tooltip.Trigger asChild>
                      <IconInfoCircle size={14} />
                    </Tooltip.Trigger>
                    <Tooltip.Portal>
                      <Tooltip.Content
                        className="px-3 py-2 rounded bg-[var(--color-surface-elevated)] border border-[var(--color-border)] text-xs text-[var(--color-text-secondary)] shadow-lg z-50 max-w-xs"
                        sideOffset={5}
                      >
                        <div className="mb-1 font-semibold text-[var(--color-electric)]">
                          {t("keymap.osLayoutTooltipTitle")}
                        </div>
                        <ul className="list-disc pl-4 space-y-1">
                          <li>{t("keymap.osLayoutTooltipItem1")}</li>
                          <li>
                            {t("keymap.osLayoutTooltipItem2Prefix")}
                            <strong className="mx-1">
                              {t("keymap.detectedAsUS")}
                            </strong>
                            {t("keymap.osLayoutTooltipItem2Suffix")}
                          </li>
                          <li>{t("keymap.osLayoutTooltipItem3")}</li>
                        </ul>
                        <Tooltip.Arrow className="fill-[var(--color-surface-elevated)]" />
                      </Tooltip.Content>
                    </Tooltip.Portal>
                  </Tooltip.Root>
                </Tooltip.Provider>
              </div>
            </div>

            {/* Keyboard Layout */}
            {currentLayer && (
              <div className="glass-card p-8">
                <KeyboardLayout
                  layout={currentLayout}
                  layer={currentLayer}
                  layers={keymap.keymap.layers}
                  behaviors={keymap.behaviors}
                  selectedKey={selectedKeyPosition}
                  onKeyClick={handleKeyClick}
                  onKeyReset={handleKeyReset}
                  isBindingModified={keymap.isBindingModified}
                  getOriginalBinding={keymap.getOriginalBinding}
                  keyboardLayout={keyboardLayoutContext.layout}
                  modules={
                    physicalLayoutModules.isAvailable
                      ? physicalLayoutModules.modules
                      : []
                  }
                />
              </div>
            )}

            {physicalLayoutModules.error && (
              <div className="glass-card p-4 mt-4 border-yellow-500/20 bg-yellow-500/10 flex items-center gap-3">
                <div className="p-2">
                  <IconAlertTriangle size={24} />
                </div>
                <p className="text-sm">
                  Physical layout module preview could not be loaded:{" "}
                  {physicalLayoutModules.error}
                </p>
              </div>
            )}

            {/* Sensor Rotation Configuration */}
            {!sensorRotate.isAvailable && (
              <div className="glass-card p-4 mb-4 border-yellow-500/20 bg-yellow-500/10 flex items-center gap-3">
                <div className="p-2">
                  <IconAlertTriangle size={24} />
                </div>
                <p className="text-sm">
                  {t("keymap.runtimeSensorRotationNotAvailable")}
                  <br />
                  {t("keymap.rotaryEncoderNotAvailable")}
                  <br />
                  {t("keymap.youCanEnableByApplying")}
                  <a
                    href="https://github.com/cormoran/zmk-behavior-runtime-sensor-rotate"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--color-electric)] underline mx-1"
                  >
                    cormoran/zmk-behavior-runtime-sensor-rotate
                  </a>
                  in your firmware.
                </p>
              </div>
            )}

            {sensorRotate.isAvailable && currentLayer && (
              <div className="mt-6">
                <SensorRotationConfig
                  selectedLayerId={currentLayer.id}
                  behaviors={keymap.behaviors}
                  layers={layersForSelector}
                  keyboardLayout={keyboardLayoutContext.layout}
                />
              </div>
            )}
          </>
        )}
        {/* Info */}
        <div className="mt-8 p-4 rounded-lg bg-[var(--color-border)] border border-[var(--color-border-hover)]">
          <p className="text-xs text-[var(--color-text-muted)]">
            {connection.isConnected
              ? t("keymap.keymapInstructionsConnected")
              : t("keymap.keymapInstructionsDisconnected")}
          </p>
        </div>
      </div>

      {/* Keycode Selector Dialog */}
      <KeycodeSelector
        open={showKeycodeSelector}
        onClose={() => {
          setShowKeycodeSelector(false);
          setSelectedKeyPosition(null);
        }}
        onSelect={handleBindingSelect}
        currentBinding={currentBinding}
        behaviors={keymap.behaviors}
        layers={layersForSelector}
        keyboardLayout={keyboardLayoutContext.layout}
      />

      {/* Unlock Prompt */}
      <UnlockPrompt
        open={keymap.unlockRequired}
        onClose={() => keymap.clearUnlockRequired()}
        onRetry={handleUnlockRetry}
      />
    </div>
  );
}
