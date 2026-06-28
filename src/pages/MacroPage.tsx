import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  IconAlertCircle,
  IconDeviceFloppy,
  IconLoader2,
  IconPlus,
  IconRefresh,
  IconRestore,
  IconTrash,
  IconWand,
} from "@tabler/icons-react";
import { KeycodeSelector } from "../components/KeycodeSelector";
import { UnlockPrompt } from "../components/UnlockPrompt";
import { KeyboardLayoutContext } from "../contexts/KeyboardLayoutContext";
import { useKeymap } from "../hooks/useKeymap";
import { useRuntimeMacro } from "../hooks/useRuntimeMacro";
import {
  getRuntimeMacroEncodedSize,
  RUNTIME_MACRO_FORMAT_VERSION,
} from "../lib/runtimeMacroCodec";
import { formatBehaviorBinding } from "../lib/behaviorMetadata";
import type { BehaviorBinding as KeymapBehaviorBinding } from "../hooks/useKeymap";
import type {
  MacroSlot,
  MacroStep,
} from "../proto/cormoran/runtime_macro/runtime_macro";

type StepAction = "tap" | "down" | "up" | "delay";

const DEFAULT_BINDING = { behaviorId: 0, param1: 0, param2: 0 };
const DEFAULT_STEP: MacroStep = { tap: DEFAULT_BINDING };

function getStepAction(step: MacroStep): StepAction {
  if (step.down) return "down";
  if (step.up) return "up";
  if (step.delay) return "delay";
  return "tap";
}

function getStepBinding(step: MacroStep): KeymapBehaviorBinding | null {
  const binding = step.down ?? step.up ?? step.tap;
  return binding ? { ...binding } : null;
}

function createStep(
  action: StepAction,
  binding: KeymapBehaviorBinding | null,
  delayMs = 0,
): MacroStep {
  if (action === "delay") {
    return { delay: { delayMs } };
  }

  const nextBinding = binding ?? DEFAULT_BINDING;
  return { [action]: nextBinding };
}

function formatMacroName(macro: MacroSlot | null, index: number): string {
  if (macro?.name) return macro.name;
  return `Macro ${index}`;
}

function clampUInt32(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(0xffffffff, Math.round(value)));
}

export function MacroPage() {
  const runtimeMacro = useRuntimeMacro();
  const keymap = useKeymap();
  const keyboardLayoutContext = useContext(KeyboardLayoutContext);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [loadedMacro, setLoadedMacro] = useState<MacroSlot | null>(null);
  const [editingStepIndex, setEditingStepIndex] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDiscarding, setIsDiscarding] = useState(false);

  const layersForSelector = useMemo(() => {
    if (!keymap.keymap?.layers) return [];
    return keymap.keymap.layers.map((layer) => ({
      id: layer.id,
      name: layer.name,
    }));
  }, [keymap.keymap?.layers]);

  const encodedSize = useMemo(() => {
    if (!loadedMacro) return 0;
    try {
      return getRuntimeMacroEncodedSize(loadedMacro.steps);
    } catch {
      return loadedMacro.encodedSize;
    }
  }, [loadedMacro]);

  const encodedSizeError =
    loadedMacro && encodedSize > runtimeMacro.maxMacroBytes
      ? `Encoded macro is ${encodedSize} bytes; limit is ${runtimeMacro.maxMacroBytes}.`
      : null;

  const selectedStep =
    editingStepIndex !== null ? loadedMacro?.steps[editingStepIndex] : null;

  const loadMacro = useCallback(
    async (index: number) => {
      const macro = await runtimeMacro.getMacro(index);
      if (macro) {
        setSelectedIndex(index);
        setLoadedMacro(macro);
      }
    },
    [runtimeMacro],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!runtimeMacro.isAvailable || runtimeMacro.macros.length === 0) {
        setSelectedIndex(null);
        setLoadedMacro(null);
        return;
      }

      const nextIndex = selectedIndex ?? runtimeMacro.macros[0].index;
      if (selectedIndex === null) {
        setSelectedIndex(nextIndex);
      }
      if (!loadedMacro || loadedMacro.index !== nextIndex) {
        void loadMacro(nextIndex);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [
    loadMacro,
    loadedMacro,
    runtimeMacro.isAvailable,
    runtimeMacro.macros,
    selectedIndex,
  ]);

  const commitMacroName = useCallback(
    async (name: string) => {
      if (!loadedMacro) return;
      const trimmedName = name.slice(0, runtimeMacro.maxNameLength);
      setLoadedMacro({ ...loadedMacro, name: trimmedName });
      await runtimeMacro.setMacroName(loadedMacro.index, trimmedName);
      await runtimeMacro.loadMacros();
    },
    [loadedMacro, runtimeMacro],
  );

  const commitSteps = useCallback(
    async (steps: MacroStep[]) => {
      if (!loadedMacro) return false;
      try {
        const size = getRuntimeMacroEncodedSize(steps);
        if (size > runtimeMacro.maxMacroBytes) {
          runtimeMacro.clearError();
          return false;
        }
      } catch {
        return false;
      }

      const countUpdated = await runtimeMacro.setMacroStepCount(
        loadedMacro.index,
        steps.length,
      );
      if (!countUpdated) return false;

      for (const [stepIndex, step] of steps.entries()) {
        const stepUpdated = await runtimeMacro.setMacroStep(
          loadedMacro.index,
          stepIndex,
          step,
        );
        if (!stepUpdated) return false;
      }

      setLoadedMacro({ ...loadedMacro, steps });
      await runtimeMacro.loadMacros();
      return true;
    },
    [loadedMacro, runtimeMacro],
  );

  const updateStep = useCallback(
    async (stepIndex: number, step: MacroStep) => {
      if (!loadedMacro) return;
      const steps = loadedMacro.steps.map((existingStep, index) =>
        index === stepIndex ? step : existingStep,
      );
      const size = getRuntimeMacroEncodedSize(steps);
      setLoadedMacro({ ...loadedMacro, steps, encodedSize: size });
      if (size <= runtimeMacro.maxMacroBytes) {
        await runtimeMacro.setMacroStep(loadedMacro.index, stepIndex, step);
        await runtimeMacro.loadMacros();
      }
    },
    [loadedMacro, runtimeMacro],
  );

  const handleActionChange = useCallback(
    async (stepIndex: number, action: StepAction) => {
      if (!loadedMacro) return;
      const currentStep = loadedMacro.steps[stepIndex];
      const currentAction = getStepAction(currentStep);
      const nextStep = createStep(
        action,
        getStepBinding(currentStep),
        currentAction === "delay" ? currentStep.delay?.delayMs : 0,
      );
      await updateStep(stepIndex, nextStep);
    },
    [loadedMacro, updateStep],
  );

  const handleDelayChange = useCallback(
    (stepIndex: number, delayMs: number) => {
      if (!loadedMacro) return;
      const steps = loadedMacro.steps.map((step, index) =>
        index === stepIndex
          ? { delay: { delayMs: clampUInt32(delayMs) } }
          : step,
      );
      setLoadedMacro({ ...loadedMacro, steps });
    },
    [loadedMacro],
  );

  const commitDelay = useCallback(
    async (stepIndex: number) => {
      if (!loadedMacro) return;
      await updateStep(stepIndex, loadedMacro.steps[stepIndex]);
    },
    [loadedMacro, updateStep],
  );

  const handleBehaviorSelect = useCallback(
    async (binding: KeymapBehaviorBinding) => {
      if (!loadedMacro || editingStepIndex === null) return;
      const action = getStepAction(loadedMacro.steps[editingStepIndex]);
      if (action === "delay") return;
      await updateStep(editingStepIndex, createStep(action, binding));
      setEditingStepIndex(null);
    },
    [editingStepIndex, loadedMacro, updateStep],
  );

  const handleAddStep = useCallback(async () => {
    if (!loadedMacro) return;
    const steps = [...loadedMacro.steps, DEFAULT_STEP];
    await commitSteps(steps);
  }, [commitSteps, loadedMacro]);

  const handleRemoveStep = useCallback(
    async (stepIndex: number) => {
      if (!loadedMacro) return;
      const steps = loadedMacro.steps.filter((_, index) => index !== stepIndex);
      await commitSteps(steps);
    },
    [commitSteps, loadedMacro],
  );

  const handleDeleteMacro = useCallback(async () => {
    if (!loadedMacro) return;
    const ok = await runtimeMacro.deleteMacro(loadedMacro.index);
    if (ok) {
      const emptyMacro = {
        ...loadedMacro,
        name: "",
        steps: [],
        encodedSize: RUNTIME_MACRO_FORMAT_VERSION === 1 ? 1 : 0,
      };
      setLoadedMacro(emptyMacro);
      await runtimeMacro.loadMacros();
    }
  }, [loadedMacro, runtimeMacro]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await runtimeMacro.saveMacros();
    } finally {
      setIsSaving(false);
    }
  }, [runtimeMacro]);

  const handleDiscard = useCallback(async () => {
    setIsDiscarding(true);
    try {
      await runtimeMacro.discardMacros();
      if (selectedIndex !== null) {
        await loadMacro(selectedIndex);
      }
    } finally {
      setIsDiscarding(false);
    }
  }, [loadMacro, runtimeMacro, selectedIndex]);

  const handleTapMsChange = useCallback(
    async (tapMs: number) => {
      await runtimeMacro.setTapMs(clampUInt32(tapMs));
    },
    [runtimeMacro],
  );

  const getStepDisplayName = useCallback(
    (step: MacroStep) => {
      const binding = getStepBinding(step);
      if (!binding || binding.behaviorId === 0) return "Select behavior";
      const behavior = keymap.behaviors.get(binding.behaviorId);
      if (!behavior) return `Behavior ${binding.behaviorId}`;
      return formatBehaviorBinding(binding, behavior, {
        layers: layersForSelector,
        keyboardLayout: keyboardLayoutContext.layout,
      });
    },
    [keymap.behaviors, keyboardLayoutContext.layout, layersForSelector],
  );

  return (
    <div className="p-6 h-full overflow-auto">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col tablet:flex-row tablet:items-center gap-3 mb-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-[var(--color-electric)]/10 border border-[var(--color-electric)]/20">
              <IconWand size={24} className="text-[var(--color-electric)]" />
            </div>
            <div>
              <h1 className="text-xl font-medium text-[var(--color-text)]">
                Macro
              </h1>
              <p className="text-sm text-[var(--color-text-muted)]">
                Edit runtime macro slots
              </p>
            </div>
          </div>

          {runtimeMacro.isAvailable && (
            <div className="flex items-center gap-2 ml-auto">
              {runtimeMacro.hasUnsavedChanges && (
                <span className="text-xs text-[var(--color-neon)] mr-2">
                  ● Unsaved changes
                </span>
              )}
              <button
                className="btn-ghost text-sm flex items-center gap-1.5"
                onClick={() => void runtimeMacro.loadMacros()}
                disabled={runtimeMacro.isLoading}
              >
                <IconRefresh size={16} />
                Refresh
              </button>
              <button
                className="btn-ghost text-sm flex items-center gap-1.5"
                onClick={handleDiscard}
                disabled={
                  isDiscarding ||
                  runtimeMacro.isLoading ||
                  !runtimeMacro.hasUnsavedChanges
                }
              >
                {isDiscarding ? (
                  <IconLoader2 size={16} className="animate-spin" />
                ) : (
                  <IconRestore size={16} />
                )}
                Reset
              </button>
              <button
                className="btn-electric text-sm flex items-center gap-1.5"
                onClick={handleSave}
                disabled={
                  isSaving ||
                  runtimeMacro.isLoading ||
                  !runtimeMacro.hasUnsavedChanges ||
                  Boolean(encodedSizeError)
                }
              >
                {isSaving ? (
                  <IconLoader2 size={16} className="animate-spin" />
                ) : (
                  <IconDeviceFloppy size={16} />
                )}
                Save
              </button>
            </div>
          )}
        </div>

        {!runtimeMacro.isAvailable && (
          <div className="glass-card p-6 text-center">
            <p className="text-sm text-[var(--color-text-muted)]">
              Runtime macro subsystem not found. Build firmware with{" "}
              <a
                href="https://github.com/cormoran/zmk-feature-runtime-macro"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--color-electric)] underline"
              >
                cormoran/zmk-feature-runtime-macro
              </a>
              .
            </p>
          </div>
        )}

        {(runtimeMacro.error || encodedSizeError || keymap.error) && (
          <div className="glass-card p-4 mb-4 border-red-500/20 bg-red-500/10 flex items-center gap-3">
            <IconAlertCircle size={20} className="text-red-400" />
            <p className="text-sm text-red-400">
              {runtimeMacro.error || encodedSizeError || keymap.error}
            </p>
          </div>
        )}

        {runtimeMacro.isAvailable && (
          <div className="grid grid-cols-1 tablet:grid-cols-[240px_1fr] gap-4">
            <div className="glass-card p-3 h-fit">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-medium text-[var(--color-text)]">
                  Slots
                </h2>
                {runtimeMacro.isLoading && (
                  <IconLoader2
                    size={16}
                    className="animate-spin text-[var(--color-electric)]"
                  />
                )}
              </div>
              <div className="space-y-1">
                {runtimeMacro.macros.map((macro) => (
                  <button
                    key={macro.index}
                    className={`w-full px-3 py-2 rounded-lg text-left transition-colors ${
                      selectedIndex === macro.index
                        ? "bg-[var(--color-electric)]/20 text-[var(--color-electric)] border border-[var(--color-electric)]/30"
                        : "text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]"
                    }`}
                    onClick={() => void loadMacro(macro.index)}
                  >
                    <span className="block text-sm font-medium truncate">
                      {macro.name || `Macro ${macro.index}`}
                    </span>
                    <span className="block text-xs text-[var(--color-text-muted)]">
                      {macro.encodedSize}/{runtimeMacro.maxMacroBytes} bytes
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="glass-card p-4 min-w-0">
              {loadedMacro ? (
                <>
                  <div className="flex flex-col tablet:flex-row tablet:items-end gap-3 mb-4">
                    <div className="flex-1 min-w-0">
                      <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">
                        Name
                      </label>
                      <input
                        className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text)] focus:outline-none focus:border-[var(--color-electric)]/50"
                        value={loadedMacro.name}
                        maxLength={runtimeMacro.maxNameLength}
                        placeholder={formatMacroName(
                          loadedMacro,
                          loadedMacro.index,
                        )}
                        onChange={(event) =>
                          setLoadedMacro({
                            ...loadedMacro,
                            name: event.target.value,
                          })
                        }
                        onBlur={(event) =>
                          void commitMacroName(event.target.value)
                        }
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2 tablet:w-64">
                      <div>
                        <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">
                          Global Tap
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={10000}
                          className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text)] focus:outline-none focus:border-[var(--color-electric)]/50"
                          value={runtimeMacro.globalSettings?.tapMs ?? 0}
                          onChange={(event) =>
                            void handleTapMsChange(Number(event.target.value))
                          }
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">
                          Size
                        </label>
                        <div
                          className={`px-3 py-2 rounded-lg border text-sm ${
                            encodedSizeError
                              ? "border-red-500/40 text-red-400 bg-red-500/10"
                              : "border-[var(--color-border)] text-[var(--color-text-secondary)] bg-[var(--color-bg)]"
                          }`}
                        >
                          {encodedSize}/{runtimeMacro.maxMacroBytes}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-medium text-[var(--color-text)]">
                      Steps
                    </h2>
                    <div className="flex items-center gap-2">
                      <button
                        className="btn-ghost text-sm flex items-center gap-1.5"
                        onClick={handleDeleteMacro}
                        disabled={runtimeMacro.isLoading}
                      >
                        <IconTrash size={16} />
                        Clear
                      </button>
                      <button
                        className="btn-electric text-sm flex items-center gap-1.5"
                        onClick={handleAddStep}
                        disabled={runtimeMacro.isLoading}
                      >
                        <IconPlus size={16} />
                        Step
                      </button>
                    </div>
                  </div>

                  {loadedMacro.steps.length === 0 ? (
                    <div className="p-6 text-center rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)]">
                      <p className="text-sm text-[var(--color-text-muted)]">
                        No steps in this macro
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {loadedMacro.steps.map((step, index) => {
                        const action = getStepAction(step);
                        return (
                          <div
                            key={index}
                            className="grid grid-cols-1 tablet:grid-cols-[64px_128px_1fr_40px] gap-2 items-center p-3 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)]"
                          >
                            <div className="text-xs font-mono text-[var(--color-text-muted)]">
                              #{index + 1}
                            </div>
                            <select
                              className="px-3 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-electric)]/50"
                              value={action}
                              onChange={(event) =>
                                void handleActionChange(
                                  index,
                                  event.target.value as StepAction,
                                )
                              }
                            >
                              <option value="tap">Tap</option>
                              <option value="down">Down</option>
                              <option value="up">Up</option>
                              <option value="delay">Delay</option>
                            </select>

                            {action === "delay" ? (
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  min={0}
                                  className="w-full px-3 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-electric)]/50"
                                  value={step.delay?.delayMs ?? 0}
                                  onChange={(event) =>
                                    handleDelayChange(
                                      index,
                                      Number(event.target.value),
                                    )
                                  }
                                  onBlur={() => void commitDelay(index)}
                                />
                                <span className="text-xs text-[var(--color-text-muted)]">
                                  ms
                                </span>
                              </div>
                            ) : (
                              <button
                                className="w-full px-3 py-2 rounded-lg bg-[var(--color-surface)] hover:bg-[var(--color-border)] border border-[var(--color-border)] text-left text-sm text-[var(--color-text-secondary)] transition-colors"
                                onClick={() => setEditingStepIndex(index)}
                              >
                                {getStepDisplayName(step)}
                              </button>
                            )}

                            <button
                              className="p-2 rounded-lg hover:bg-[var(--color-border)] disabled:opacity-40"
                              onClick={() => void handleRemoveStep(index)}
                              disabled={runtimeMacro.isLoading}
                              aria-label={`Remove step ${index + 1}`}
                            >
                              <IconTrash
                                size={16}
                                className="text-[var(--color-text-muted)]"
                              />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              ) : (
                <div className="p-6 text-center">
                  <p className="text-sm text-[var(--color-text-muted)]">
                    Select a macro slot
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <KeycodeSelector
        open={editingStepIndex !== null}
        onClose={() => setEditingStepIndex(null)}
        onSelect={handleBehaviorSelect}
        currentBinding={selectedStep ? getStepBinding(selectedStep) : null}
        behaviors={keymap.behaviors}
        layers={layersForSelector}
        keyboardLayout={keyboardLayoutContext.layout}
        behaviorQuickSelects={["kp", "rmacro", "none", "transparent"]}
      />

      <UnlockPrompt
        open={keymap.unlockRequired}
        onClose={() => keymap.clearUnlockRequired()}
        onRetry={() => keymap.loadKeymapData()}
      />
    </div>
  );
}
