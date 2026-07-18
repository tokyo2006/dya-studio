import {
  useCallback,
  useContext,
  useMemo,
  useState,
  type InputHTMLAttributes,
} from "react";
import {
  IconAlertTriangle,
  IconChevronDown,
  IconCommand,
  IconDeviceFloppy,
  IconLoader2,
  IconLock,
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
import { LoadingIndicator } from "../components/LoadingIndicator";
import { StatusDot, type EditStatus } from "../components/EditStatusIndicator";
import { useDebouncedMemoryWrite } from "../hooks/useDebouncedMemoryWrite";
import { useStudioLockState } from "@cormoran/zmk-studio-react-hook";
import { useStudioUnlock } from "../hooks/useStudioUnlock";
import { useKeymap, getKeymapLoadingLabel } from "../hooks/useKeymap";
import { useLanguage } from "../hooks/useLanguage";
import type { BehaviorBinding, BehaviorDefinition } from "../hooks/useKeymap";
import { useRuntimeCombo } from "../hooks/useRuntimeCombo";
import { useRuntimeMacro } from "../hooks/useRuntimeMacro";
import type { Combo } from "../hooks/useRuntimeCombo";
import {
  formatBehaviorBinding,
  findBehaviorByPredicate,
} from "../lib/behaviorMetadata";
import { createHidUsage, HID_USAGE_PAGE_KEYBOARD } from "../lib/keycodes";
import type { KeyboardLayoutType } from "../lib/keyboardLayouts";
import {
  ComboSource,
  SlowReleaseOverride,
} from "../proto/cormoran/runtime_combo/runtime_combo";

const MAX_POSITIONS_PER_COMBO = 16;
const MAX_NAME_LENGTH = 64;
const DEFAULT_TIMEOUT_MS = 50;

// Defaults applied when creating a new combo from the Add button.
const DEFAULT_COMBO_POSITIONS = [0, 1];
// `&kp a` — HID keyboard usage for the "A" key (matches what the keycode
// selector produces when the user picks "A").
const DEFAULT_COMBO_KEYCODE = createHidUsage(HID_USAGE_PAGE_KEYBOARD, 0x04);

interface ComboDraft {
  index: number;
  name: string;
  keyPositions: number[];
  behavior: BehaviorBinding;
  layerMask: number;
  enabled: boolean;
  timeoutMs: number;
  requirePriorIdleMs: number;
  slowReleaseOverride: SlowReleaseOverride;
  source: ComboSource;
}

// Input that keeps its own local value while focused so parent-driven updates
// (e.g. after a debounced memory write reloads device state) don't reset the
// cursor or steal focus mid-edit. Mirrors the RetainedInput used by
// AdvancedSettingsSection. Only needed for fields driven by device state
// (global settings); the per-combo editor is driven by the local draft.
function RetainedInput({
  value,
  onChange,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & {
  value: string;
  onChange: (value: string) => void;
}) {
  const [local, setLocal] = useState(value);
  const [prevProp, setPrevProp] = useState(value);
  const [focused, setFocused] = useState(false);

  if (prevProp !== value) {
    setPrevProp(value);
    if (!focused) {
      setLocal(value);
    }
  }

  return (
    <input
      {...rest}
      value={local}
      onFocus={(e) => {
        setFocused(true);
        rest.onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        rest.onBlur?.(e);
      }}
      onChange={(e) => {
        setLocal(e.target.value);
        onChange(e.target.value);
      }}
    />
  );
}

function comboSourceLabel(
  source: ComboSource,
  t: (key: string) => string,
): string {
  switch (source) {
    case ComboSource.COMBO_SOURCE_EMPTY:
      return t("Empty");
    case ComboSource.COMBO_SOURCE_DEFAULT:
      return t("Default");
    case ComboSource.COMBO_SOURCE_OVERRIDDEN:
      return t("Overridden");
    case ComboSource.COMBO_SOURCE_RUNTIME:
      return t("Runtime");
    default:
      return t("Unknown");
  }
}

// Unified edit status for a combo slot: green when it has an in-memory change
// not yet persisted, blue when it is persisted but differs from (or is not
// part of) the compile-time default, otherwise no dot.
function comboEditStatus(
  source: ComboSource,
  index: number,
  modifiedIndices: Set<number>,
): EditStatus {
  if (modifiedIndices.has(index)) {
    return "unsaved";
  }
  if (
    source === ComboSource.COMBO_SOURCE_OVERRIDDEN ||
    source === ComboSource.COMBO_SOURCE_RUNTIME
  ) {
    return "modified";
  }
  return "default";
}

function defaultBehaviorBinding(
  behaviors: Map<number, BehaviorDefinition>,
): BehaviorBinding {
  // Match the "Key Press" (kp) behavior specifically — several behaviors share
  // the "keypress" category, so key off its short code instead.
  const keyPressBehavior =
    findBehaviorByPredicate(
      behaviors,
      (metadata) => metadata?.shortCode === "KP",
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
    timeoutMs: combo.timeoutMs,
    requirePriorIdleMs: combo.requirePriorIdleMs,
    slowReleaseOverride: combo.slowReleaseOverride,
    source: combo.source,
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
    timeoutMs: 0,
    requirePriorIdleMs: 0,
    slowReleaseOverride: SlowReleaseOverride.SLOW_RELEASE_OVERRIDE_INHERIT,
    source: ComboSource.COMBO_SOURCE_EMPTY,
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

function formatLayerScope(
  mask: number,
  t: (key: string, params?: Record<string, number | string>) => string,
): string {
  return mask === 0 ? t("All layers") : `0x${mask.toString(16)}`;
}

// Pure validation shared by the error banner and the auto-write guard: an
// invalid draft is shown to the user but never written to the device.
function validateCombo(
  draft: ComboDraft,
  maxCombo: number | undefined,
  t: (key: string, params?: Record<string, number | string>) => string,
): string | null {
  if (draft.index < 0 || !Number.isInteger(draft.index)) {
    return t("Choose a valid slot.");
  }
  if (maxCombo && maxCombo > 0 && draft.index >= maxCombo) {
    return t("Slot must be below {{maxCombo}}.", { maxCombo });
  }
  if (draft.name.length > MAX_NAME_LENGTH) {
    return t("Name must be {{maxLength}} characters or fewer.", {
      maxLength: MAX_NAME_LENGTH,
    });
  }
  if (draft.keyPositions.length < 2) {
    return t("Select at least two key positions.");
  }
  if (draft.keyPositions.length > MAX_POSITIONS_PER_COMBO) {
    return t("Select {{maxPositions}} positions or fewer.", {
      maxPositions: MAX_POSITIONS_PER_COMBO,
    });
  }
  if (draft.keyPositions.some((position) => position > 65535)) {
    return t("Key positions must be below 65536.");
  }
  if (!draft.behavior || draft.behavior.behaviorId === 0) {
    return t("Choose a behavior.");
  }
  if (draft.layerMask < 0 || draft.layerMask > 0xffffffff) {
    return t("Layer mask is out of range.");
  }
  return null;
}

function formatComboBehavior(
  binding: BehaviorBinding,
  behaviors: Map<number, BehaviorDefinition>,
  layers: Array<{ id: number; name: string }>,
  keyboardLayout: KeyboardLayoutType,
  runtimeMacros: Array<{ slot: number; name?: string }>,
  t: (key: string, params?: Record<string, number | string>) => string,
): string {
  const behavior = behaviors.get(binding.behaviorId);
  if (!behavior) {
    return t("Behavior {{id}}", { id: binding.behaviorId });
  }
  return formatBehaviorBinding(binding, behavior, {
    layers,
    keyboardLayout,
    runtimeMacros,
  });
}

export function ComboPage() {
  const { t } = useLanguage();
  const connection = useContext(ConnectionContext);
  const keyboardLayoutContext = useContext(KeyboardLayoutContext);
  const keymap = useKeymap();
  const runtimeCombo = useRuntimeCombo();
  const runtimeMacro = useRuntimeMacro();
  // Proactive lock state: prompt for unlock the moment the user tries to edit,
  // and show a lock badge in place of Save/Discard, instead of letting the edit
  // fail first.
  const { locked } = useStudioLockState();
  // Proactive unlock gate (opens the shared unlock modal); the reactive
  // fail→modal→retry path is handled inside the feature hooks via runWithUnlock.
  const { requireUnlock: requireUnlocked } = useStudioUnlock();

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState<ComboDraft>(() =>
    createDraft([], undefined, new Map()),
  );
  const [showBehaviorSelector, setShowBehaviorSelector] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isGlobalSettingsExpanded, setIsGlobalSettingsExpanded] =
    useState(false);
  const [isAdvancedExpanded, setIsAdvancedExpanded] = useState(false);
  // Client-side green tracking: the proto carries no per-combo "unsaved" flag,
  // so we mark a slot whenever a field auto-writes to memory and clear the set
  // on the global Save/Discard.
  const [modifiedIndices, setModifiedIndices] = useState<Set<number>>(
    new Set(),
  );
  // Global settings likewise have no per-value unsaved flag; track green with a
  // single client flag, cleared on Save/Discard.
  const [globalModified, setGlobalModified] = useState(false);

  const maxCombo = runtimeCombo.globalSettings?.maxCombo;
  const displayTimeoutMs =
    runtimeCombo.globalSettings?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const displaySlowRelease = runtimeCombo.globalSettings?.slowRelease ?? false;
  const displayRequirePriorIdleMs =
    runtimeCombo.globalSettings?.requirePriorIdleMs ?? 0;
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

  // Writer for the debounced auto-write: pushes the whole draft to keyboard
  // MEMORY (persist=false) and marks the slot green. `setCombo` refreshes the
  // combo list from the device (which derives `source`), then the name is
  // written on top.
  const writeComboToMemory = useCallback(
    async (next: ComboDraft) => {
      const comboSaved = await runtimeCombo.setCombo({
        index: next.index,
        keyPositions: next.keyPositions,
        behavior: next.behavior,
        layerMask: next.layerMask,
        enabled: next.enabled,
        timeoutMs: next.timeoutMs,
        requirePriorIdleMs: next.requirePriorIdleMs,
        slowReleaseOverride: next.slowReleaseOverride,
      });
      if (!comboSaved) return;
      await runtimeCombo.setComboName(next.index, next.name);
      setModifiedIndices((prev) => new Set(prev).add(next.index));
    },
    [runtimeCombo],
  );

  const comboMemoryWrite = useDebouncedMemoryWrite(writeComboToMemory);

  const globalTimeoutWrite = useDebouncedMemoryWrite<number>(
    useCallback(
      async (timeoutMs: number) => {
        if (timeoutMs < 1 || timeoutMs > 65535) return;
        const ok = await runtimeCombo.setTimeoutMs(timeoutMs);
        if (ok) setGlobalModified(true);
      },
      [runtimeCombo],
    ),
  );

  const globalIdleWrite = useDebouncedMemoryWrite<number>(
    useCallback(
      async (requirePriorIdleMs: number) => {
        if (requirePriorIdleMs < 0 || requirePriorIdleMs > 65535) return;
        const ok = await runtimeCombo.setRequirePriorIdleMs(requirePriorIdleMs);
        if (ok) setGlobalModified(true);
      },
      [runtimeCombo],
    ),
  );

  const selectDraft = useCallback(
    (nextDraft: ComboDraft) => {
      // Flush any pending write for the previously edited slot before switching
      // (the queued value carries its own index, so it targets the right slot).
      void comboMemoryWrite.flush();
      setSelectedIndex(nextDraft.index);
      setDraft(nextDraft);
      setStatusMessage(null);
    },
    [comboMemoryWrite],
  );

  // Single entry point for every per-combo field edit: update the local draft
  // (keeping inputs responsive) and, when the draft is valid, auto-write it to
  // memory. Discrete controls pass `immediate` to write without the debounce.
  const applyDraftChange = useCallback(
    (next: ComboDraft, immediate = false) => {
      if (!requireUnlocked()) return;
      setDraft(next);
      setStatusMessage(null);
      if (validateCombo(next, maxCombo, t)) {
        // Invalid drafts are shown (with the error banner) but never written.
        return;
      }
      // Optimistic green so the dot reacts immediately, before the debounce.
      setModifiedIndices((prev) => new Set(prev).add(next.index));
      comboMemoryWrite.queue(next);
      if (immediate) {
        void comboMemoryWrite.flush();
      }
    },
    [comboMemoryWrite, maxCombo, requireUnlocked, t],
  );

  const handleNewCombo = useCallback(async () => {
    if (!requireUnlocked()) return;
    const base = createDraft(runtimeCombo.combos, maxCombo, keymap.behaviors);
    const newCombo: ComboDraft = {
      ...base,
      name: t("Combo {{index}}", { index: base.index }),
      keyPositions: [...DEFAULT_COMBO_POSITIONS],
      behavior: {
        ...defaultBehaviorBinding(keymap.behaviors),
        param1: DEFAULT_COMBO_KEYCODE,
      },
    };
    setStatusMessage(null);
    const comboSaved = await runtimeCombo.setCombo({
      index: newCombo.index,
      keyPositions: newCombo.keyPositions,
      behavior: newCombo.behavior,
      layerMask: newCombo.layerMask,
      enabled: newCombo.enabled,
      timeoutMs: newCombo.timeoutMs,
      requirePriorIdleMs: newCombo.requirePriorIdleMs,
      slowReleaseOverride: newCombo.slowReleaseOverride,
    });
    if (!comboSaved) return;
    await runtimeCombo.setComboName(newCombo.index, newCombo.name);
    setModifiedIndices((prev) => new Set(prev).add(newCombo.index));
    selectDraft(newCombo);
  }, [
    keymap.behaviors,
    maxCombo,
    runtimeCombo,
    selectDraft,
    requireUnlocked,
    t,
  ]);

  const handlePositionToggle = useCallback(
    (position: number) => {
      const nextPositions = draft.keyPositions.includes(position)
        ? draft.keyPositions.filter((item) => item !== position)
        : normalizePositions([...draft.keyPositions, position]);
      applyDraftChange({ ...draft, keyPositions: nextPositions }, true);
    },
    [applyDraftChange, draft],
  );

  const validationError = useMemo(
    () => validateCombo(draft, maxCombo, t),
    [draft, maxCombo, t],
  );

  const handleDeleteCombo = useCallback(async () => {
    if (!requireUnlocked()) return;
    comboMemoryWrite.cancel();
    const deleted = await runtimeCombo.deleteCombo(draft.index);
    if (deleted) {
      const remaining = runtimeCombo.combos.filter(
        (combo) => combo.index !== draft.index,
      );
      const nextDraft = remaining.at(0)
        ? comboToDraft(remaining[0], keymap.behaviors)
        : createDraft(remaining, maxCombo, keymap.behaviors);
      setModifiedIndices((prev) => {
        const nextSet = new Set(prev);
        nextSet.delete(draft.index);
        return nextSet;
      });
      selectDraft(nextDraft);
    }
  }, [
    comboMemoryWrite,
    draft.index,
    keymap.behaviors,
    maxCombo,
    runtimeCombo,
    selectDraft,
    requireUnlocked,
  ]);

  const handleResetCombo = useCallback(async () => {
    if (!requireUnlocked()) return;
    comboMemoryWrite.cancel();
    const resetIndex = draft.index;
    const reset = await runtimeCombo.resetCombo(resetIndex);
    if (reset) {
      const updated = runtimeCombo.combos.find(
        (combo) => combo.index === resetIndex,
      );
      const nextDraft = updated
        ? comboToDraft(updated, keymap.behaviors)
        : createDraft(runtimeCombo.combos, maxCombo, keymap.behaviors);
      // Reset clears any local unsaved marker for the slot; the device now
      // reports its source (default/empty), which drives the dot.
      setModifiedIndices((prev) => {
        const nextSet = new Set(prev);
        nextSet.delete(resetIndex);
        return nextSet;
      });
      selectDraft(nextDraft);
    }
  }, [
    comboMemoryWrite,
    draft.index,
    keymap.behaviors,
    maxCombo,
    runtimeCombo,
    selectDraft,
    requireUnlocked,
  ]);

  const handleSavePending = useCallback(async () => {
    if (!requireUnlocked()) return;
    // Persist any still-queued edits to memory first, then flush memory→flash.
    await comboMemoryWrite.flush();
    await globalTimeoutWrite.flush();
    await globalIdleWrite.flush();
    const status = await runtimeCombo.saveChanges();
    if (status) {
      setModifiedIndices(new Set());
      setGlobalModified(false);
      setStatusMessage(
        t("Saved {{count}} runtime combo changes.", {
          count: status.affectedCount,
        }),
      );
    }
  }, [
    comboMemoryWrite,
    globalIdleWrite,
    globalTimeoutWrite,
    runtimeCombo,
    t,
    requireUnlocked,
  ]);

  const handleDiscardPending = useCallback(async () => {
    if (!requireUnlocked()) return;
    comboMemoryWrite.cancel();
    globalTimeoutWrite.cancel();
    globalIdleWrite.cancel();
    const status = await runtimeCombo.discardChanges();
    if (status) {
      setModifiedIndices(new Set());
      setGlobalModified(false);
      setStatusMessage(
        t("Discarded {{count}} runtime combo changes.", {
          count: status.affectedCount,
        }),
      );
      setSelectedIndex(null);
    }
  }, [
    comboMemoryWrite,
    globalIdleWrite,
    globalTimeoutWrite,
    runtimeCombo,
    t,
    requireUnlocked,
  ]);

  const selectedCombo = useMemo(
    () =>
      runtimeCombo.combos.find((combo) => combo.index === draft.index) ?? null,
    [runtimeCombo.combos, draft.index],
  );
  const selectedComboExists = selectedCombo !== null;
  const editorSource = selectedCombo?.source ?? draft.source;

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
                {t("Combo")}
              </h1>
              <p className="text-sm text-[var(--color-text-muted)]">
                {t("Configure runtime combo slots")}
              </p>
            </div>
          </div>

          {connection.isConnected && runtimeCombo.isAvailable && (
            <div className="flex items-center gap-2 ml-auto flex-wrap">
              <button
                className="btn-ghost text-sm flex items-center gap-1.5"
                onClick={() => void runtimeCombo.reload()}
                disabled={runtimeCombo.isLoading}
              >
                <IconRefresh size={16} />
                {t("Refresh")}
              </button>
              {locked ? (
                <button
                  type="button"
                  onClick={() => requireUnlocked()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border border-[var(--color-warning)]/40 bg-[var(--color-warning)]/10 text-[var(--color-warning)] hover:bg-[var(--color-warning)]/20 transition-colors"
                  title={t("Studio is locked — click to unlock")}
                >
                  <IconLock size={16} />
                  {t("Locked")}
                </button>
              ) : (
                <>
                  {runtimeCombo.hasPendingChanges && (
                    <span className="flex items-center gap-1 text-xs text-[var(--color-neon)] mr-2">
                      <StatusDot status="unsaved" />
                      {t("Unsaved changes")}
                    </span>
                  )}
                  <button
                    className="btn-ghost text-sm flex items-center gap-1.5"
                    onClick={handleDiscardPending}
                    disabled={
                      runtimeCombo.isLoading || !runtimeCombo.hasPendingChanges
                    }
                  >
                    <IconRestore size={16} />
                    {t("Discard")}
                  </button>
                  <button
                    className="btn-electric text-sm flex items-center gap-1.5"
                    onClick={handleSavePending}
                    disabled={
                      runtimeCombo.isLoading || !runtimeCombo.hasPendingChanges
                    }
                  >
                    <IconDeviceFloppy size={16} />
                    {t("Save")}
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {!connection.isConnected && (
          <div className="glass-card p-6 text-center">
            <p className="text-sm text-[var(--color-text-muted)]">
              {t("Connect your keyboard to edit runtime combos")}
            </p>
          </div>
        )}

        {connection.isConnected && !runtimeCombo.isAvailable && (
          <div className="glass-card p-4 warning-banner border flex items-center gap-3">
            <IconAlertTriangle size={24} className="flex-shrink-0" />
            <p className="text-sm">
              {t("Runtime combo subsystem is not available for your keyboard.")}
              <a
                href="https://github.com/cormoran/zmk-feature-runtime-combo"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--color-electric)] underline mx-1"
              >
                cormoran/zmk-feature-runtime-combo
              </a>
              {t("is required in firmware.")}
            </p>
          </div>
        )}

        {(runtimeCombo.error || keymap.error) && (
          <div className="glass-card p-4 mb-4 border-red-500/20 bg-red-500/10 flex items-center gap-3">
            <IconAlertTriangle size={20} className="text-red-400" />
            <p className="text-sm text-red-400">
              {t(runtimeCombo.error || keymap.error || "")}
            </p>
            {runtimeCombo.error && (
              <button
                className="ml-auto text-xs text-red-300 hover:text-red-200"
                onClick={runtimeCombo.clearError}
              >
                {t("Dismiss")}
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
            <LoadingIndicator
              className="mb-6"
              label={
                keymap.isLoading
                  ? getKeymapLoadingLabel(t, keymap.loadingProgress)
                  : t("Loading combo data...")
              }
              current={
                keymap.isLoading ? keymap.loadingProgress?.current : undefined
              }
              total={
                keymap.isLoading ? keymap.loadingProgress?.total : undefined
              }
            />
          )}

        {connection.isConnected &&
          runtimeCombo.isAvailable &&
          keymap.keymap && (
            <div className="grid grid-cols-1 desktop:grid-cols-[320px_1fr] gap-4 min-w-0">
              <div className="space-y-4">
                {/* Global Settings - collapsible, above Slots */}
                <section className="glass-card overflow-hidden">
                  <button
                    className="flex items-center gap-2 w-full p-4 text-left"
                    onClick={() =>
                      setIsGlobalSettingsExpanded(!isGlobalSettingsExpanded)
                    }
                  >
                    <IconSettings
                      size={16}
                      className="text-[var(--color-electric)] flex-shrink-0"
                    />
                    <h2 className="text-sm font-medium text-[var(--color-text)] flex-1">
                      {t("Global Settings")}
                    </h2>
                    {globalModified && <StatusDot status="unsaved" />}
                    <IconChevronDown
                      size={14}
                      className={`text-[var(--color-text-muted)] flex-shrink-0 transition-transform ${
                        isGlobalSettingsExpanded ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {isGlobalSettingsExpanded && (
                    <div className="px-4 pb-4 border-t border-[var(--color-border)]">
                      <div className="space-y-3 mt-3">
                        <p className="text-xs text-[var(--color-text-muted)]">
                          {t(
                            "Changes are written to keyboard memory after a short delay. Save a section to persist them.",
                          )}
                        </p>
                        <label className="block">
                          <span className="text-xs text-[var(--color-text-muted)]">
                            {t("Max slots")}
                          </span>
                          <input
                            className="mt-1 w-full px-3 py-2 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text)]"
                            value={maxCombo ?? ""}
                            readOnly
                          />
                        </label>
                        <label className="block">
                          <span className="text-xs text-[var(--color-text-muted)]">
                            {t("Timeout ms")}
                          </span>
                          <RetainedInput
                            type="number"
                            min={1}
                            max={65535}
                            className="mt-1 w-full px-3 py-2 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text)]"
                            value={String(displayTimeoutMs)}
                            onChange={(value) => {
                              if (!requireUnlocked()) return;
                              globalTimeoutWrite.queue(Number(value));
                            }}
                          />
                        </label>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm text-[var(--color-text)]">
                            {t("Slow release")}
                          </span>
                          <Switch.Root
                            checked={displaySlowRelease}
                            onCheckedChange={(slowRelease) => {
                              if (!requireUnlocked()) return;
                              void runtimeCombo
                                .setSlowRelease(slowRelease)
                                .then((ok) => {
                                  if (ok) setGlobalModified(true);
                                });
                            }}
                            className="w-10 h-5 rounded-full relative data-[state=checked]:bg-[var(--color-electric)] bg-[var(--color-border)] border border-[var(--color-border)] transition-colors"
                          >
                            <Switch.Thumb className="block w-4 h-4 rounded-full transition-transform data-[state=checked]:translate-x-5 translate-x-0.5 will-change-transform bg-white border border-[var(--color-border)]" />
                          </Switch.Root>
                        </div>
                        <label className="block">
                          <span className="text-xs text-[var(--color-text-muted)]">
                            {t("Require prior idle ms (0 disables)")}
                          </span>
                          <RetainedInput
                            type="number"
                            min={0}
                            max={65535}
                            className="mt-1 w-full px-3 py-2 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text)]"
                            value={String(displayRequirePriorIdleMs)}
                            onChange={(value) => {
                              if (!requireUnlocked()) return;
                              globalIdleWrite.queue(Number(value));
                            }}
                          />
                        </label>
                      </div>
                    </div>
                  )}
                </section>

                {/* Slots list */}
                <section className="glass-card p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h2 className="text-sm font-medium text-[var(--color-text)]">
                        {t("Slots")}
                      </h2>
                      <p className="text-xs text-[var(--color-text-muted)]">
                        {runtimeCombo.combos.length}
                        {maxCombo ? ` / ${maxCombo}` : ""} {t("configured")}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      {runtimeCombo.isLoading && (
                        <IconLoader2
                          size={14}
                          className="animate-spin text-[var(--color-electric)]"
                        />
                      )}
                      <button
                        className="p-1 rounded hover:bg-[var(--color-border)] text-[var(--color-electric)] disabled:opacity-40 transition-colors"
                        onClick={handleNewCombo}
                        title={t("New combo")}
                      >
                        <IconPlus size={15} />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {runtimeCombo.combos.length === 0 && (
                      <p className="text-sm text-[var(--color-text-muted)] py-4 text-center">
                        {t("No runtime combos configured")}
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
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium text-[var(--color-text)] truncate flex-1">
                              {combo.name ||
                                t("Combo {{index}}", {
                                  index: combo.index,
                                })}
                            </span>
                            <span className="flex items-center gap-1.5 shrink-0">
                              <StatusDot
                                status={comboEditStatus(
                                  combo.source,
                                  combo.index,
                                  modifiedIndices,
                                )}
                              />
                              <span className="text-xs font-mono text-[var(--color-text-muted)]">
                                #{combo.index}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-[var(--color-border)] text-[var(--color-text-muted)]">
                                {comboSourceLabel(combo.source, t)}
                              </span>
                            </span>
                          </div>
                          <div className="mt-1 text-xs text-[var(--color-text-muted)] truncate">
                            {combo.keyPositions.join(" + ")} ·{" "}
                            {formatLayerScope(combo.layerMask, t)}
                          </div>
                          <div className="mt-1 text-xs text-[var(--color-text-secondary)] truncate">
                            {formatComboBehavior(
                              binding,
                              keymap.behaviors,
                              layersForSelector,
                              keyboardLayoutContext.layout,
                              runtimeMacro.macros,
                              t,
                            )}
                          </div>
                        </button>
                      );
                    })}
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
                      {t("Select a combo slot")}
                    </h2>
                    <p className="text-sm text-[var(--color-text-muted)] mt-1">
                      {t("Choose an existing slot or create a new combo.")}
                    </p>
                    <button
                      className="btn-electric text-sm mt-4 flex items-center gap-1.5 mx-auto"
                      onClick={handleNewCombo}
                    >
                      <IconPlus size={16} />
                      {t("New Combo")}
                    </button>
                  </div>
                </section>
              ) : (
                <section className="glass-card p-4 tablet:p-6 min-w-0 overflow-hidden">
                  {/* Editor header */}
                  <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-sm font-medium text-[var(--color-text)]">
                          {t("Combo Editor")}
                        </h2>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-[var(--color-border)] text-[var(--color-text-muted)]">
                          {comboSourceLabel(editorSource, t)}
                        </span>
                        <StatusDot
                          status={comboEditStatus(
                            editorSource,
                            draft.index,
                            modifiedIndices,
                          )}
                        />
                      </div>
                      <p className="text-xs text-[var(--color-text-muted)]">
                        {selectedComboExists
                          ? t("Existing slot")
                          : t("New slot")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {(editorSource === ComboSource.COMBO_SOURCE_DEFAULT ||
                        editorSource ===
                          ComboSource.COMBO_SOURCE_OVERRIDDEN) && (
                        <button
                          className="btn-ghost text-sm flex items-center gap-1.5"
                          onClick={handleResetCombo}
                          disabled={runtimeCombo.isLoading}
                        >
                          <IconRestore size={16} />
                          {t("Reset to Default")}
                        </button>
                      )}
                      {/* Enabled toggle inline with action buttons */}
                      <div className="flex items-center gap-2 px-2">
                        <span className="text-xs text-[var(--color-text-muted)]">
                          {t("Enabled")}
                        </span>
                        <Switch.Root
                          checked={draft.enabled}
                          onCheckedChange={(enabled) =>
                            applyDraftChange({ ...draft, enabled }, true)
                          }
                          className="w-8 h-4 rounded-full relative data-[state=checked]:bg-[var(--color-electric)] bg-[var(--color-border)] border border-[var(--color-border)] transition-colors"
                        >
                          <Switch.Thumb className="block w-3 h-3 rounded-full transition-transform data-[state=checked]:translate-x-4 translate-x-0.5 will-change-transform bg-white border border-[var(--color-border)]" />
                        </Switch.Root>
                      </div>
                      <button
                        className="btn-ghost text-sm flex items-center gap-1.5"
                        onClick={handleDeleteCombo}
                        disabled={
                          !selectedComboExists || runtimeCombo.isLoading
                        }
                      >
                        <IconTrash size={16} />
                        {t("Delete")}
                      </button>
                    </div>
                  </div>

                  {validationError && (
                    <div className="mb-4 p-3 rounded-lg border warning-banner text-sm flex items-center gap-2">
                      <IconAlertTriangle size={16} className="shrink-0" />
                      <span>{validationError}</span>
                    </div>
                  )}

                  {/* Name (Slot removed) */}
                  <div className="mb-4">
                    <label>
                      <span className="text-xs text-[var(--color-text-muted)]">
                        {t("Name")}
                      </span>
                      <input
                        maxLength={MAX_NAME_LENGTH}
                        className="mt-1 w-full px-3 py-2 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text)]"
                        value={draft.name}
                        onChange={(event) =>
                          applyDraftChange({
                            ...draft,
                            name: event.target.value,
                          })
                        }
                      />
                    </label>
                  </div>

                  {/* Behavior — full width */}
                  <div className="mb-4">
                    <button
                      className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] hover:border-[var(--color-electric)]/50 text-left transition-colors"
                      onClick={() => setShowBehaviorSelector(true)}
                    >
                      <span className="block text-xs text-[var(--color-text-muted)]">
                        {t("Behavior")}
                      </span>
                      <span className="block text-sm text-[var(--color-text)] truncate mt-1">
                        {formatComboBehavior(
                          draft.behavior,
                          keymap.behaviors,
                          layersForSelector,
                          keyboardLayoutContext.layout,
                          runtimeMacro.macros,
                          t,
                        )}
                      </span>
                    </button>
                  </div>

                  {/* Layers */}
                  <div className="mb-4">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <span className="text-xs text-[var(--color-text-muted)]">
                        {t("Layers")}
                      </span>
                      <button
                        className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                          draft.layerMask === 0
                            ? "bg-[var(--color-electric)]/20 text-[var(--color-electric)] border-[var(--color-electric)]/40"
                            : "bg-[var(--color-bg)] text-[var(--color-text-secondary)] border-[var(--color-border)]"
                        }`}
                        onClick={() =>
                          applyDraftChange({ ...draft, layerMask: 0 }, true)
                        }
                      >
                        {t("All")}
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
                            applyDraftChange(
                              {
                                ...draft,
                                layerMask: toggleLayer(
                                  draft.layerMask,
                                  layer.id,
                                ),
                              },
                              true,
                            )
                          }
                          disabled={layer.id >= 32}
                        >
                          {layer.name || t("Layer {{id}}", { id: layer.id })}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      {formatLayerScope(draft.layerMask, t)}
                    </p>
                  </div>

                  {/* Positions — read-only, updated via keyboard clicks */}
                  <label className="block mb-4">
                    <span className="text-xs text-[var(--color-text-muted)]">
                      {t("Positions")}
                    </span>
                    <input
                      readOnly
                      className="mt-1 w-full px-3 py-2 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text)] cursor-default select-none"
                      value={positionsToText(draft.keyPositions)}
                    />
                  </label>

                  {/* Keyboard layout preview */}
                  {currentLayout && previewLayer && (
                    <div className="rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] p-3 overflow-x-auto mb-4">
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
                        runtimeMacros={runtimeMacro.macros}
                        highlightedKeys={highlightedKeys}
                      />
                    </div>
                  )}

                  {/* Advanced Options — collapsible */}
                  <div className="rounded-lg border border-[var(--color-border)] overflow-hidden">
                    <button
                      className="flex items-center gap-2 w-full px-3 py-2.5 text-left bg-[var(--color-bg)] hover:bg-[var(--color-border)]/50 transition-colors"
                      onClick={() => setIsAdvancedExpanded(!isAdvancedExpanded)}
                    >
                      <span className="text-xs font-medium text-[var(--color-text-muted)] flex-1">
                        {t("Advanced Options")}
                      </span>
                      <IconChevronDown
                        size={13}
                        className={`text-[var(--color-text-muted)] flex-shrink-0 transition-transform ${
                          isAdvancedExpanded ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                    {isAdvancedExpanded && (
                      <div className="p-3 border-t border-[var(--color-border)] bg-[var(--color-bg)]">
                        <div className="grid grid-cols-1 tablet:grid-cols-3 gap-3">
                          <label>
                            <span className="text-xs text-[var(--color-text-muted)]">
                              {t("Timeout ms (0 = inherit global)")}
                            </span>
                            <input
                              type="number"
                              min={0}
                              max={65535}
                              className="mt-1 w-full px-3 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)]"
                              value={draft.timeoutMs}
                              onChange={(event) =>
                                applyDraftChange({
                                  ...draft,
                                  timeoutMs: Number(event.target.value),
                                })
                              }
                            />
                          </label>
                          <label>
                            <span className="text-xs text-[var(--color-text-muted)]">
                              {t("Require prior idle ms (0 = inherit global)")}
                            </span>
                            <input
                              type="number"
                              min={0}
                              max={65535}
                              className="mt-1 w-full px-3 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)]"
                              value={draft.requirePriorIdleMs}
                              onChange={(event) =>
                                applyDraftChange({
                                  ...draft,
                                  requirePriorIdleMs: Number(
                                    event.target.value,
                                  ),
                                })
                              }
                            />
                          </label>
                          <label>
                            <span className="text-xs text-[var(--color-text-muted)]">
                              {t("Slow release override")}
                            </span>
                            <select
                              className="select-field mt-1 w-full text-sm"
                              value={draft.slowReleaseOverride}
                              onChange={(event) =>
                                applyDraftChange(
                                  {
                                    ...draft,
                                    slowReleaseOverride: Number(
                                      event.target.value,
                                    ) as SlowReleaseOverride,
                                  },
                                  true,
                                )
                              }
                            >
                              <option
                                value={
                                  SlowReleaseOverride.SLOW_RELEASE_OVERRIDE_INHERIT
                                }
                              >
                                {t("Inherit global")}
                              </option>
                              <option
                                value={
                                  SlowReleaseOverride.SLOW_RELEASE_OVERRIDE_ON
                                }
                              >
                                {t("On")}
                              </option>
                              <option
                                value={
                                  SlowReleaseOverride.SLOW_RELEASE_OVERRIDE_OFF
                                }
                              >
                                {t("Off")}
                              </option>
                            </select>
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                </section>
              )}
            </div>
          )}
      </div>

      <KeycodeSelector
        open={showBehaviorSelector}
        onClose={() => setShowBehaviorSelector(false)}
        onSelect={(binding) =>
          applyDraftChange({ ...draft, behavior: binding }, true)
        }
        currentBinding={draft.behavior}
        behaviors={keymap.behaviors}
        layers={layersForSelector}
        keyboardLayout={keyboardLayoutContext.layout}
        behaviorQuickSelects={["kp", "lt", "mt", "none", "transparent"]}
        runtimeMacros={runtimeMacro.macros}
      />
    </div>
  );
}
