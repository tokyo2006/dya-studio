import { useCallback, useContext, useMemo, useState } from "react";
import {
  IconAlertTriangle,
  IconCommand,
  IconDeviceFloppy,
  IconLoader2,
  IconPlus,
  IconRefresh,
  IconRestore,
  IconSettings,
  IconTrash,
} from "@tabler/icons-react";
import * as Switch from "@radix-ui/react-switch";
import { ConnectionContext } from "../components/DeviceConnection";
import { KeyboardLayoutContext } from "../contexts/KeyboardLayoutContext";
import { KeyboardLayout } from "../components/KeyboardLayout";
import { KeycodeSelector } from "../components/KeycodeSelector";
import { UnlockPrompt } from "../components/UnlockPrompt";
import { useKeymap } from "../hooks/useKeymap";
import type { BehaviorBinding, BehaviorDefinition } from "../hooks/useKeymap";
import { useRuntimeCombo } from "../hooks/useRuntimeCombo";
import type { Combo } from "../hooks/useRuntimeCombo";
import { formatBehaviorBinding } from "../lib/behaviorMetadata";
import type { KeyboardLayoutType } from "../lib/keyboardLayouts";

const MAX_POSITIONS_PER_COMBO = 16;
const MAX_NAME_LENGTH = 64;
const DEFAULT_TIMEOUT_MS = 50;

interface ComboDraft {
  index: number;
  name: string;
  keyPositions: number[];
  behavior: BehaviorBinding;
  layerMask: number;
  enabled: boolean;
}

interface GlobalSettingsDraft {
  timeoutMs: number | null;
  slowRelease: boolean | null;
}

function defaultBehaviorBinding(
  behaviors: Map<number, BehaviorDefinition>,
): BehaviorBinding {
  const keyPressBehavior =
    Array.from(behaviors.values()).find(
      (behavior) => behavior.displayName === "kp",
    ) ?? Array.from(behaviors.values()).at(0);

  return {
    behaviorId: keyPressBehavior?.id ?? 0,
    param1: 0,
    param2: 0,
  };
}

function normalizePositions(positions: number[]): number[] {
  return [...new Set(positions)]
    .filter((position) => Number.isInteger(position) && position >= 0)
    .sort((a, b) => a - b);
}

function parsePositions(value: string): number[] {
  return normalizePositions(
    value
      .split(",")
      .map((part) => Number.parseInt(part.trim(), 10))
      .filter((position) => Number.isFinite(position)),
  );
}

function positionsToText(positions: number[]): string {
  return positions.join(", ");
}

function comboToDraft(
  combo: Combo,
  behaviors: Map<number, BehaviorDefinition>,
): ComboDraft {
  return {
    index: combo.index,
    name: combo.name,
    keyPositions: normalizePositions(combo.keyPositions),
    behavior: combo.behavior
      ? { ...combo.behavior }
      : defaultBehaviorBinding(behaviors),
    layerMask: combo.layerMask,
    enabled: combo.enabled,
  };
}

function createDraft(
  combos: Combo[],
  maxCombo: number | undefined,
  behaviors: Map<number, BehaviorDefinition>,
): ComboDraft {
  const usedSlots = new Set(combos.map((combo) => combo.index));
  const slotLimit = maxCombo && maxCombo > 0 ? maxCombo : 16;
  let index = 0;
  while (index < slotLimit && usedSlots.has(index)) {
    index++;
  }
  if (index >= slotLimit) {
    index = Math.max(0, slotLimit - 1);
  }

  return {
    index,
    name: "",
    keyPositions: [],
    behavior: defaultBehaviorBinding(behaviors),
    layerMask: 0,
    enabled: true,
  };
}

function hasLayer(mask: number, layerId: number): boolean {
  if (layerId < 0 || layerId >= 32) return false;
  return Math.floor(mask / 2 ** layerId) % 2 === 1;
}

function toggleLayer(mask: number, layerId: number): number {
  if (layerId < 0 || layerId >= 32) return mask;
  const bit = 2 ** layerId;
  return hasLayer(mask, layerId) ? mask - bit : mask + bit;
}

function formatLayerScope(mask: number): string {
  return mask === 0 ? "All layers" : `0x${mask.toString(16)}`;
}

function formatComboBehavior(
  binding: BehaviorBinding,
  behaviors: Map<number, BehaviorDefinition>,
  layers: Array<{ id: number; name: string }>,
  keyboardLayout: KeyboardLayoutType,
): string {
  const behavior = behaviors.get(binding.behaviorId);
  if (!behavior) {
    return `Behavior ${binding.behaviorId}`;
  }
  return formatBehaviorBinding(binding, behavior, {
    layers,
    keyboardLayout,
  });
}

export function ComboPage() {
  const connection = useContext(ConnectionContext);
  const keyboardLayoutContext = useContext(KeyboardLayoutContext);
  const keymap = useKeymap();
  const runtimeCombo = useRuntimeCombo();

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState<ComboDraft>(() =>
    createDraft([], undefined, new Map()),
  );
  const [positionsText, setPositionsText] = useState("");
  const [globalDraft, setGlobalDraft] = useState<GlobalSettingsDraft>({
    timeoutMs: null,
    slowRelease: null,
  });
  const [showBehaviorSelector, setShowBehaviorSelector] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const maxCombo = runtimeCombo.globalSettings?.maxCombo;
  const displayTimeoutMs =
    globalDraft.timeoutMs ??
    runtimeCombo.globalSettings?.timeoutMs ??
    DEFAULT_TIMEOUT_MS;
  const displaySlowRelease =
    globalDraft.slowRelease ??
    runtimeCombo.globalSettings?.slowRelease ??
    false;
  const keymapLayers = keymap.keymap?.layers;
  const physicalLayouts = keymap.physicalLayouts?.layouts;
  const activeLayoutIndex = keymap.physicalLayouts?.activeLayoutIndex;

  const layersForSelector = useMemo(() => {
    if (!keymapLayers) return [];
    return keymapLayers.map((layer) => ({
      id: layer.id,
      name: layer.name,
    }));
  }, [keymapLayers]);

  const currentLayout = useMemo(() => {
    if (!physicalLayouts || activeLayoutIndex === undefined) return null;
    return physicalLayouts[activeLayoutIndex];
  }, [activeLayoutIndex, physicalLayouts]);

  const previewLayer = keymap.keymap?.layers[0] ?? null;

  const highlightedKeys = useMemo(
    () => new Set(draft.keyPositions),
    [draft.keyPositions],
  );

  const selectDraft = useCallback(
    (nextDraft: ComboDraft) => {
      setSelectedIndex(nextDraft.index);
      setDraft(nextDraft);
      setPositionsText(positionsToText(nextDraft.keyPositions));
      setStatusMessage(null);
    },
    [setDraft],
  );

  const handleNewCombo = useCallback(() => {
    selectDraft(createDraft(runtimeCombo.combos, maxCombo, keymap.behaviors));
  }, [keymap.behaviors, maxCombo, runtimeCombo.combos, selectDraft]);

  const handlePositionToggle = useCallback((position: number) => {
    setDraft((prev) => {
      const nextPositions = prev.keyPositions.includes(position)
        ? prev.keyPositions.filter((item) => item !== position)
        : normalizePositions([...prev.keyPositions, position]);
      setPositionsText(positionsToText(nextPositions));
      return { ...prev, keyPositions: nextPositions };
    });
  }, []);

  const handlePositionsTextChange = useCallback((value: string) => {
    setPositionsText(value);
    setDraft((prev) => ({ ...prev, keyPositions: parsePositions(value) }));
  }, []);

  const validationError = useMemo(() => {
    if (draft.index < 0 || !Number.isInteger(draft.index)) {
      return "Choose a valid slot.";
    }
    if (maxCombo && maxCombo > 0 && draft.index >= maxCombo) {
      return `Slot must be below ${maxCombo}.`;
    }
    if (draft.name.length > MAX_NAME_LENGTH) {
      return `Name must be ${MAX_NAME_LENGTH} characters or fewer.`;
    }
    if (draft.keyPositions.length < 2) {
      return "Select at least two key positions.";
    }
    if (draft.keyPositions.length > MAX_POSITIONS_PER_COMBO) {
      return `Select ${MAX_POSITIONS_PER_COMBO} positions or fewer.`;
    }
    if (draft.keyPositions.some((position) => position > 65535)) {
      return "Key positions must be below 65536.";
    }
    if (!draft.behavior || draft.behavior.behaviorId === 0) {
      return "Choose a behavior.";
    }
    if (draft.layerMask < 0 || draft.layerMask > 0xffffffff) {
      return "Layer mask is out of range.";
    }
    return null;
  }, [draft, maxCombo]);

  const handleSaveCombo = useCallback(async () => {
    if (validationError) return;
    setStatusMessage(null);
    const comboSaved = await runtimeCombo.setCombo({
      index: draft.index,
      keyPositions: draft.keyPositions,
      behavior: draft.behavior,
      layerMask: draft.layerMask,
      enabled: draft.enabled,
    });
    if (!comboSaved) return;

    const nameSaved = await runtimeCombo.setComboName(draft.index, draft.name);
    if (nameSaved) {
      setSelectedIndex(draft.index);
      setStatusMessage("Combo changes are pending.");
    }
  }, [draft, runtimeCombo, validationError]);

  const handleDeleteCombo = useCallback(async () => {
    const deleted = await runtimeCombo.deleteCombo(draft.index);
    if (deleted) {
      const remaining = runtimeCombo.combos.filter(
        (combo) => combo.index !== draft.index,
      );
      const nextDraft = remaining.at(0)
        ? comboToDraft(remaining[0], keymap.behaviors)
        : createDraft(remaining, maxCombo, keymap.behaviors);
      selectDraft(nextDraft);
      setStatusMessage("Combo deletion is pending.");
    }
  }, [draft.index, keymap.behaviors, maxCombo, runtimeCombo, selectDraft]);

  const handleApplyGlobalSettings = useCallback(async () => {
    setStatusMessage(null);
    const current = runtimeCombo.globalSettings;
    let ok = true;
    if (!current || current.timeoutMs !== displayTimeoutMs) {
      ok = (await runtimeCombo.setTimeoutMs(displayTimeoutMs)) && ok;
    }
    if (!current || current.slowRelease !== displaySlowRelease) {
      ok = (await runtimeCombo.setSlowRelease(displaySlowRelease)) && ok;
    }
    if (ok) {
      setGlobalDraft({ timeoutMs: null, slowRelease: null });
      setStatusMessage("Global settings are pending.");
    }
  }, [displaySlowRelease, displayTimeoutMs, runtimeCombo]);

  const handleSavePending = useCallback(async () => {
    const status = await runtimeCombo.saveChanges();
    if (status) {
      setStatusMessage(`Saved ${status.affectedCount} runtime combo changes.`);
    }
  }, [runtimeCombo]);

  const handleDiscardPending = useCallback(async () => {
    const status = await runtimeCombo.discardChanges();
    if (status) {
      setStatusMessage(
        `Discarded ${status.affectedCount} runtime combo changes.`,
      );
      setSelectedIndex(null);
    }
  }, [runtimeCombo]);

  const selectedComboExists = runtimeCombo.combos.some(
    (combo) => combo.index === draft.index,
  );

  return (
    <div className="p-6 h-full overflow-auto">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col tablet:flex-row tablet:items-center gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[var(--color-electric)]/10 border border-[var(--color-electric)]/20">
              <IconCommand size={24} className="text-[var(--color-electric)]" />
            </div>
            <div>
              <h1 className="text-xl font-medium text-[var(--color-text)]">
                Combo
              </h1>
              <p className="text-sm text-[var(--color-text-muted)]">
                Configure runtime combo slots
              </p>
            </div>
          </div>

          {connection.isConnected && runtimeCombo.isAvailable && (
            <div className="flex items-center gap-2 ml-auto flex-wrap">
              {runtimeCombo.hasPendingChanges && (
                <span className="text-xs text-[var(--color-neon)] mr-2">
                  ● Pending changes
                </span>
              )}
              <button
                className="btn-ghost text-sm flex items-center gap-1.5"
                onClick={() => void runtimeCombo.reload()}
                disabled={runtimeCombo.isLoading}
              >
                <IconRefresh size={16} />
                Refresh
              </button>
              <button
                className="btn-ghost text-sm flex items-center gap-1.5"
                onClick={handleDiscardPending}
                disabled={
                  runtimeCombo.isLoading || !runtimeCombo.hasPendingChanges
                }
              >
                <IconRestore size={16} />
                Discard
              </button>
              <button
                className="btn-electric text-sm flex items-center gap-1.5"
                onClick={handleSavePending}
                disabled={
                  runtimeCombo.isLoading || !runtimeCombo.hasPendingChanges
                }
              >
                <IconDeviceFloppy size={16} />
                Save
              </button>
            </div>
          )}
        </div>

        {!connection.isConnected && (
          <div className="glass-card p-6 text-center">
            <p className="text-sm text-[var(--color-text-muted)]">
              Connect your keyboard to edit runtime combos
            </p>
          </div>
        )}

        {connection.isConnected && !runtimeCombo.isAvailable && (
          <div className="glass-card p-4 border-yellow-500/20 bg-yellow-500/10 flex items-center gap-3">
            <IconAlertTriangle size={24} />
            <p className="text-sm">
              Runtime combo subsystem is not available for your keyboard.
              <a
                href="https://github.com/cormoran/zmk-feature-runtime-combo"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--color-electric)] underline mx-1"
              >
                cormoran/zmk-feature-runtime-combo
              </a>
              is required in firmware.
            </p>
          </div>
        )}

        {(runtimeCombo.error || keymap.error) && !keymap.unlockRequired && (
          <div className="glass-card p-4 mb-4 border-red-500/20 bg-red-500/10 flex items-center gap-3">
            <IconAlertTriangle size={20} className="text-red-400" />
            <p className="text-sm text-red-400">
              {runtimeCombo.error || keymap.error}
            </p>
            {runtimeCombo.error && (
              <button
                className="ml-auto text-xs text-red-300 hover:text-red-200"
                onClick={runtimeCombo.clearError}
              >
                Dismiss
              </button>
            )}
          </div>
        )}

        {statusMessage && (
          <div className="glass-card p-3 mb-4 border-[var(--color-electric)]/20 bg-[var(--color-electric)]/10">
            <p className="text-sm text-[var(--color-electric)]">
              {statusMessage}
            </p>
          </div>
        )}

        {connection.isConnected &&
          runtimeCombo.isAvailable &&
          (runtimeCombo.isLoading || keymap.isLoading) &&
          !keymap.keymap && (
            <div className="glass-card p-6 text-center mb-6">
              <IconLoader2
                size={24}
                className="animate-spin mx-auto mb-2 text-[var(--color-electric)]"
              />
              <p className="text-sm text-[var(--color-text-muted)]">
                Loading combo data...
              </p>
            </div>
          )}

        {connection.isConnected &&
          runtimeCombo.isAvailable &&
          keymap.keymap && (
            <div className="grid grid-cols-1 desktop:grid-cols-[320px_1fr] gap-4">
              <div className="space-y-4">
                <section className="glass-card p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h2 className="text-sm font-medium text-[var(--color-text)]">
                        Slots
                      </h2>
                      <p className="text-xs text-[var(--color-text-muted)]">
                        {runtimeCombo.combos.length}
                        {maxCombo ? ` / ${maxCombo}` : ""} configured
                      </p>
                    </div>
                    <button
                      className="btn-ghost text-sm flex items-center gap-1.5"
                      onClick={handleNewCombo}
                    >
                      <IconPlus size={16} />
                      New
                    </button>
                  </div>

                  <div className="space-y-2">
                    {runtimeCombo.combos.length === 0 && (
                      <p className="text-sm text-[var(--color-text-muted)] py-4 text-center">
                        No runtime combos configured
                      </p>
                    )}
                    {runtimeCombo.combos.map((combo) => {
                      const binding =
                        combo.behavior ??
                        defaultBehaviorBinding(keymap.behaviors);
                      return (
                        <button
                          key={combo.index}
                          className={`w-full text-left p-3 rounded-lg border transition-colors ${
                            selectedIndex === combo.index
                              ? "bg-[var(--color-electric)]/10 border-[var(--color-electric)]/40"
                              : "bg-[var(--color-surface)] border-[var(--color-border)] hover:border-[var(--color-electric)]/40"
                          } ${combo.enabled ? "" : "opacity-60"}`}
                          onClick={() =>
                            selectDraft(comboToDraft(combo, keymap.behaviors))
                          }
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-sm font-medium text-[var(--color-text)] truncate">
                              {combo.name || `Combo ${combo.index}`}
                            </span>
                            <span className="text-xs font-mono text-[var(--color-text-muted)]">
                              #{combo.index}
                            </span>
                          </div>
                          <div className="mt-1 text-xs text-[var(--color-text-muted)] truncate">
                            {combo.keyPositions.join(" + ")} ·{" "}
                            {formatLayerScope(combo.layerMask)}
                          </div>
                          <div className="mt-1 text-xs text-[var(--color-text-secondary)] truncate">
                            {formatComboBehavior(
                              binding,
                              keymap.behaviors,
                              layersForSelector,
                              keyboardLayoutContext.layout,
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>

                <section className="glass-card p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <IconSettings
                      size={18}
                      className="text-[var(--color-electric)]"
                    />
                    <h2 className="text-sm font-medium text-[var(--color-text)]">
                      Global Settings
                    </h2>
                  </div>

                  <div className="space-y-3">
                    <label className="block">
                      <span className="text-xs text-[var(--color-text-muted)]">
                        Max slots
                      </span>
                      <input
                        className="mt-1 w-full px-3 py-2 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text)]"
                        value={maxCombo ?? ""}
                        readOnly
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs text-[var(--color-text-muted)]">
                        Timeout ms
                      </span>
                      <input
                        type="number"
                        min={1}
                        max={65535}
                        className="mt-1 w-full px-3 py-2 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text)]"
                        value={displayTimeoutMs}
                        onChange={(event) =>
                          setGlobalDraft((prev) => ({
                            ...prev,
                            timeoutMs: Number(event.target.value),
                          }))
                        }
                      />
                    </label>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm text-[var(--color-text)]">
                        Slow release
                      </span>
                      <Switch.Root
                        checked={displaySlowRelease}
                        onCheckedChange={(slowRelease) =>
                          setGlobalDraft((prev) => ({ ...prev, slowRelease }))
                        }
                        className="w-10 h-5 rounded-full relative data-[state=checked]:bg-[var(--color-electric)] bg-[var(--color-border)] border border-[var(--color-border)] transition-colors"
                      >
                        <Switch.Thumb className="block w-4 h-4 rounded-full transition-transform data-[state=checked]:translate-x-5 translate-x-0.5 will-change-transform bg-white border border-[var(--color-border)]" />
                      </Switch.Root>
                    </div>
                    <button
                      className="btn-electric w-full text-sm"
                      onClick={handleApplyGlobalSettings}
                      disabled={
                        runtimeCombo.isLoading ||
                        displayTimeoutMs < 1 ||
                        displayTimeoutMs > 65535
                      }
                    >
                      Apply Global Settings
                    </button>
                  </div>
                </section>
              </div>

              {selectedIndex === null ? (
                <section className="glass-card p-6 flex items-center justify-center min-h-[320px] text-center">
                  <div>
                    <IconCommand
                      size={28}
                      className="mx-auto mb-3 text-[var(--color-electric)]"
                    />
                    <h2 className="text-sm font-medium text-[var(--color-text)]">
                      Select a combo slot
                    </h2>
                    <p className="text-sm text-[var(--color-text-muted)] mt-1">
                      Choose an existing slot or create a new combo.
                    </p>
                    <button
                      className="btn-electric text-sm mt-4 flex items-center gap-1.5 mx-auto"
                      onClick={handleNewCombo}
                    >
                      <IconPlus size={16} />
                      New Combo
                    </button>
                  </div>
                </section>
              ) : (
                <section className="glass-card p-4 tablet:p-6">
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div>
                      <h2 className="text-sm font-medium text-[var(--color-text)]">
                        Combo Editor
                      </h2>
                      <p className="text-xs text-[var(--color-text-muted)]">
                        {selectedComboExists ? "Existing slot" : "New slot"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        className="btn-ghost text-sm flex items-center gap-1.5"
                        onClick={handleDeleteCombo}
                        disabled={
                          !selectedComboExists || runtimeCombo.isLoading
                        }
                      >
                        <IconTrash size={16} />
                        Delete
                      </button>
                      <button
                        className="btn-electric text-sm flex items-center gap-1.5"
                        onClick={handleSaveCombo}
                        disabled={!!validationError || runtimeCombo.isLoading}
                        title={validationError ?? undefined}
                      >
                        {runtimeCombo.isLoading ? (
                          <IconLoader2 size={16} className="animate-spin" />
                        ) : (
                          <IconDeviceFloppy size={16} />
                        )}
                        Save Combo
                      </button>
                    </div>
                  </div>

                  {validationError && (
                    <div className="mb-4 p-3 rounded-lg border border-amber-400/40 bg-amber-500/15 text-sm text-amber-100 flex items-center gap-2">
                      <IconAlertTriangle
                        size={16}
                        className="shrink-0 text-amber-200"
                      />
                      <span>{validationError}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 tablet:grid-cols-2 gap-3 mb-4">
                    <label>
                      <span className="text-xs text-[var(--color-text-muted)]">
                        Slot
                      </span>
                      <input
                        type="number"
                        min={0}
                        max={maxCombo ? Math.max(0, maxCombo - 1) : undefined}
                        className="mt-1 w-full px-3 py-2 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text)]"
                        value={draft.index}
                        onChange={(event) =>
                          setDraft((prev) => ({
                            ...prev,
                            index: Number(event.target.value),
                          }))
                        }
                      />
                    </label>
                    <label>
                      <span className="text-xs text-[var(--color-text-muted)]">
                        Name
                      </span>
                      <input
                        maxLength={MAX_NAME_LENGTH}
                        className="mt-1 w-full px-3 py-2 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text)]"
                        value={draft.name}
                        onChange={(event) =>
                          setDraft((prev) => ({
                            ...prev,
                            name: event.target.value,
                          }))
                        }
                      />
                    </label>
                  </div>

                  <div className="grid grid-cols-1 tablet:grid-cols-[1fr_auto] gap-3 mb-4">
                    <button
                      className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] hover:border-[var(--color-electric)]/50 text-left transition-colors"
                      onClick={() => setShowBehaviorSelector(true)}
                    >
                      <span className="block text-xs text-[var(--color-text-muted)]">
                        Behavior
                      </span>
                      <span className="block text-sm text-[var(--color-text)] truncate mt-1">
                        {formatComboBehavior(
                          draft.behavior,
                          keymap.behaviors,
                          layersForSelector,
                          keyboardLayoutContext.layout,
                        )}
                      </span>
                    </button>
                    <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)]">
                      <span className="text-sm text-[var(--color-text)]">
                        Enabled
                      </span>
                      <Switch.Root
                        checked={draft.enabled}
                        onCheckedChange={(enabled) =>
                          setDraft((prev) => ({ ...prev, enabled }))
                        }
                        className="w-10 h-5 rounded-full relative data-[state=checked]:bg-[var(--color-electric)] bg-[var(--color-border)] border border-[var(--color-border)] transition-colors"
                      >
                        <Switch.Thumb className="block w-4 h-4 rounded-full transition-transform data-[state=checked]:translate-x-5 translate-x-0.5 will-change-transform bg-white border border-[var(--color-border)]" />
                      </Switch.Root>
                    </div>
                  </div>

                  <div className="mb-4">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <span className="text-xs text-[var(--color-text-muted)]">
                        Layers
                      </span>
                      <button
                        className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                          draft.layerMask === 0
                            ? "bg-[var(--color-electric)]/20 text-[var(--color-electric)] border-[var(--color-electric)]/40"
                            : "bg-[var(--color-bg)] text-[var(--color-text-secondary)] border-[var(--color-border)]"
                        }`}
                        onClick={() =>
                          setDraft((prev) => ({ ...prev, layerMask: 0 }))
                        }
                      >
                        All
                      </button>
                      {layersForSelector.map((layer) => (
                        <button
                          key={layer.id}
                          className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                            draft.layerMask !== 0 &&
                            hasLayer(draft.layerMask, layer.id)
                              ? "bg-[var(--color-electric)]/20 text-[var(--color-electric)] border-[var(--color-electric)]/40"
                              : "bg-[var(--color-bg)] text-[var(--color-text-secondary)] border-[var(--color-border)]"
                          }`}
                          onClick={() =>
                            setDraft((prev) => ({
                              ...prev,
                              layerMask: toggleLayer(prev.layerMask, layer.id),
                            }))
                          }
                          disabled={layer.id >= 32}
                        >
                          {layer.name || `Layer ${layer.id}`}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      {formatLayerScope(draft.layerMask)}
                    </p>
                  </div>

                  <label className="block mb-4">
                    <span className="text-xs text-[var(--color-text-muted)]">
                      Positions
                    </span>
                    <input
                      className="mt-1 w-full px-3 py-2 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text)]"
                      value={positionsText}
                      onChange={(event) =>
                        handlePositionsTextChange(event.target.value)
                      }
                    />
                  </label>

                  {currentLayout && previewLayer && (
                    <div className="rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] p-3">
                      <KeyboardLayout
                        layout={currentLayout}
                        layer={previewLayer}
                        layers={keymap.keymap.layers}
                        behaviors={keymap.behaviors}
                        selectedKey={null}
                        onKeyClick={handlePositionToggle}
                        onKeyReset={() => {}}
                        isBindingModified={() => false}
                        getOriginalBinding={() => null}
                        keyboardLayout={keyboardLayoutContext.layout}
                        highlightedKeys={highlightedKeys}
                      />
                    </div>
                  )}
                </section>
              )}
            </div>
          )}
      </div>

      <KeycodeSelector
        open={showBehaviorSelector}
        onClose={() => setShowBehaviorSelector(false)}
        onSelect={(binding) =>
          setDraft((prev) => ({ ...prev, behavior: binding }))
        }
        currentBinding={draft.behavior}
        behaviors={keymap.behaviors}
        layers={layersForSelector}
        keyboardLayout={keyboardLayoutContext.layout}
        behaviorQuickSelects={["kp", "lt", "mt", "none", "transparent"]}
      />

      <UnlockPrompt
        open={keymap.unlockRequired}
        onClose={() => keymap.clearUnlockRequired()}
        onRetry={keymap.loadKeymapData}
      />
    </div>
  );
}
