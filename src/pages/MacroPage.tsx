import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  IconAlertCircle,
  IconChevronDown,
  IconDeviceFloppy,
  IconHistory,
  IconLoader2,
  IconLock,
  IconPlus,
  IconRefresh,
  IconRestore,
  IconSettings,
  IconTrash,
  IconWand,
} from "@tabler/icons-react";
import { KeycodeSelector } from "../components/KeycodeSelector";
import { StatusDot } from "../components/EditStatusIndicator";
import { KeyboardLayoutContext } from "../contexts/KeyboardLayoutContext";
import { useStudioLockState } from "@cormoran/zmk-studio-react-hook";
import { useStudioUnlock } from "../hooks/useStudioUnlock";
import { useDebouncedMemoryWrite } from "../hooks/useDebouncedMemoryWrite";
import { useKeymap } from "../hooks/useKeymap";
import { useLanguage } from "../hooks/useLanguage";
import { useRuntimeMacro } from "../hooks/useRuntimeMacro";
import { getRuntimeMacroEncodedSize } from "../lib/runtimeMacroCodec";
import { formatBehaviorBinding } from "../lib/behaviorMetadata";
import { createHidUsage, HID_USAGE_PAGE_KEYBOARD } from "../lib/keycodes";
import type { BehaviorBinding as KeymapBehaviorBinding } from "../hooks/useKeymap";
import type {
  MacroDetail,
  MacroStep,
} from "../proto/cormoran/runtime_macro/runtime_macro";

type StepAction = "tap" | "down" | "up" | "delay" | "string";

interface MacroStepRow {
  action: StepAction;
  startIndex: number;
  length: number;
  step?: MacroStep;
  value?: string;
}

interface StringDraftRow {
  startIndex: number;
  length: number;
  value: string;
}

const DEFAULT_BINDING = { behaviorId: 0, param1: 0, param2: 0 };
const DEFAULT_STEP: MacroStep = { delay: { delayMs: 0 } };
const LEFT_SHIFT_MODIFIER = 0x02 << 24;
const PACKED_LEFT_SHIFT = 0x80;
const PACKED_USAGE_MASK = 0x7f;
const STRING_MIN_GROUP_LENGTH = 2;

const CHAR_TO_HID_USAGE = new Map<string, number>([
  ["a", 0x04],
  ["b", 0x05],
  ["c", 0x06],
  ["d", 0x07],
  ["e", 0x08],
  ["f", 0x09],
  ["g", 0x0a],
  ["h", 0x0b],
  ["i", 0x0c],
  ["j", 0x0d],
  ["k", 0x0e],
  ["l", 0x0f],
  ["m", 0x10],
  ["n", 0x11],
  ["o", 0x12],
  ["p", 0x13],
  ["q", 0x14],
  ["r", 0x15],
  ["s", 0x16],
  ["t", 0x17],
  ["u", 0x18],
  ["v", 0x19],
  ["w", 0x1a],
  ["x", 0x1b],
  ["y", 0x1c],
  ["z", 0x1d],
  ["1", 0x1e],
  ["2", 0x1f],
  ["3", 0x20],
  ["4", 0x21],
  ["5", 0x22],
  ["6", 0x23],
  ["7", 0x24],
  ["8", 0x25],
  ["9", 0x26],
  ["0", 0x27],
  ["\n", 0x28],
  ["\t", 0x2b],
  [" ", 0x2c],
  ["-", 0x2d],
  ["=", 0x2e],
  ["[", 0x2f],
  ["]", 0x30],
  ["\\", 0x31],
  [";", 0x33],
  ["'", 0x34],
  ["`", 0x35],
  [",", 0x36],
  [".", 0x37],
  ["/", 0x38],
]);

const SHIFTED_CHAR_TO_HID_USAGE = new Map<string, number>([
  ["!", 0x1e],
  ["@", 0x1f],
  ["#", 0x20],
  ["$", 0x21],
  ["%", 0x22],
  ["^", 0x23],
  ["&", 0x24],
  ["*", 0x25],
  ["(", 0x26],
  [")", 0x27],
  ["_", 0x2d],
  ["+", 0x2e],
  ["{", 0x2f],
  ["}", 0x30],
  ["|", 0x31],
  [":", 0x33],
  ['"', 0x34],
  ["~", 0x35],
  ["<", 0x36],
  [">", 0x37],
  ["?", 0x38],
]);

const HID_USAGE_TO_CHAR = new Map<number, string>();
for (const [char, usage] of CHAR_TO_HID_USAGE) {
  HID_USAGE_TO_CHAR.set(usage, char);
  HID_USAGE_TO_CHAR.set(createHidUsage(HID_USAGE_PAGE_KEYBOARD, usage), char);
}
for (const [char, usage] of SHIFTED_CHAR_TO_HID_USAGE) {
  HID_USAGE_TO_CHAR.set(LEFT_SHIFT_MODIFIER | usage, char);
  HID_USAGE_TO_CHAR.set(
    LEFT_SHIFT_MODIFIER | createHidUsage(HID_USAGE_PAGE_KEYBOARD, usage),
    char,
  );
}
for (let code = 0x04; code <= 0x1d; code++) {
  const lower = HID_USAGE_TO_CHAR.get(code);
  if (lower) {
    HID_USAGE_TO_CHAR.set(LEFT_SHIFT_MODIFIER | code, lower.toUpperCase());
    HID_USAGE_TO_CHAR.set(
      LEFT_SHIFT_MODIFIER | createHidUsage(HID_USAGE_PAGE_KEYBOARD, code),
      lower.toUpperCase(),
    );
  }
}

function getStepAction(step: MacroStep): Exclude<StepAction, "string"> {
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
  action: Exclude<StepAction, "string">,
  binding: KeymapBehaviorBinding | null,
  delayMs = 0,
): MacroStep {
  if (action === "delay") {
    return { delay: { delayMs } };
  }

  const nextBinding = binding ?? DEFAULT_BINDING;
  return { [action]: nextBinding };
}

function formatMacroName(macro: MacroDetail | null, slot: number): string {
  if (macro?.name) return macro.name;
  return `Macro ${slot}`;
}

function clampUInt32(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(0xffffffff, Math.round(value)));
}

function getKeyPressBehaviorId(
  behaviors: Map<number, { id: number; displayName: string }>,
): number | null {
  for (const behavior of behaviors.values()) {
    if (["kp", "Key Press", "key_press"].includes(behavior.displayName)) {
      return behavior.id;
    }
  }
  return null;
}

function charToPackedKey(char: string): number | null {
  if (char.length !== 1) return null;
  const lower = char.toLowerCase();
  if (char >= "A" && char <= "Z") {
    const usage = CHAR_TO_HID_USAGE.get(lower);
    return usage === undefined ? null : PACKED_LEFT_SHIFT | usage;
  }
  const direct = CHAR_TO_HID_USAGE.get(char);
  if (direct !== undefined) return direct;
  const shifted = SHIFTED_CHAR_TO_HID_USAGE.get(char);
  return shifted === undefined ? null : PACKED_LEFT_SHIFT | shifted;
}

function packedKeyToChar(packedKey: number): string | null {
  if (!Number.isInteger(packedKey) || packedKey < 0 || packedKey > 0xff) {
    return null;
  }
  const usage = packedKey & PACKED_USAGE_MASK;
  const hidUsage = createHidUsage(HID_USAGE_PAGE_KEYBOARD, usage);
  return (
    HID_USAGE_TO_CHAR.get(
      packedKey & PACKED_LEFT_SHIFT ? LEFT_SHIFT_MODIFIER | hidUsage : hidUsage,
    ) ?? null
  );
}

function stringToKeyTapSequenceStep(value: string): MacroStep | null {
  const packedKeys: number[] = [];
  for (const char of value) {
    const packedKey = charToPackedKey(char);
    if (packedKey === null) return null;
    packedKeys.push(packedKey);
  }
  return {
    keyTapSequence: {
      packedKeys: Uint8Array.from(packedKeys),
    },
  };
}

function getKeyTapSequenceString(step: MacroStep): string | null {
  if (!step.keyTapSequence) return null;
  const chars: string[] = [];
  for (const packedKey of step.keyTapSequence.packedKeys) {
    const char = packedKeyToChar(packedKey);
    if (char === null) return null;
    chars.push(char);
  }
  return chars.join("");
}

function getTapCharacter(step: MacroStep, keyPressBehaviorId: number | null) {
  if (!step.tap || keyPressBehaviorId === null) return null;
  if (step.tap.behaviorId !== keyPressBehaviorId || step.tap.param2 !== 0) {
    return null;
  }
  return HID_USAGE_TO_CHAR.get(step.tap.param1) ?? null;
}

function hasValidBinding(step: MacroStep): boolean {
  const binding = getStepBinding(step);
  return !binding || binding.behaviorId !== 0;
}

function canCommitSteps(steps: MacroStep[]): boolean {
  return steps.every(hasValidBinding);
}

function buildMacroStepRows(
  steps: MacroStep[],
  keyPressBehaviorId: number | null,
  stringDraft: StringDraftRow | null,
): MacroStepRow[] {
  const rows: MacroStepRow[] = [];
  let index = 0;
  let insertedDraft = false;

  while (
    index < steps.length ||
    (!insertedDraft &&
      stringDraft !== null &&
      stringDraft.startIndex <= steps.length)
  ) {
    if (
      stringDraft !== null &&
      !insertedDraft &&
      index === stringDraft.startIndex
    ) {
      rows.push({
        action: "string",
        startIndex: stringDraft.startIndex,
        length: stringDraft.length,
        value: stringDraft.value,
      });
      insertedDraft = true;
      if (stringDraft.length > 0) {
        index += stringDraft.length;
        continue;
      }
    }

    if (index >= steps.length) break;

    const keyTapSequenceString = getKeyTapSequenceString(steps[index]);
    if (keyTapSequenceString !== null) {
      rows.push({
        action: "string",
        startIndex: index,
        length: 1,
        value: keyTapSequenceString,
      });
      index++;
      continue;
    }

    const chars: string[] = [];
    let endIndex = index;
    while (endIndex < steps.length) {
      if (
        stringDraft !== null &&
        !insertedDraft &&
        endIndex === stringDraft.startIndex
      ) {
        break;
      }
      const char = getTapCharacter(steps[endIndex], keyPressBehaviorId);
      if (char === null) break;
      chars.push(char);
      endIndex++;
    }

    if (chars.length >= STRING_MIN_GROUP_LENGTH) {
      rows.push({
        action: "string",
        startIndex: index,
        length: chars.length,
        value: chars.join(""),
      });
      index = endIndex;
      continue;
    }

    rows.push({
      action: getStepAction(steps[index]),
      startIndex: index,
      length: 1,
      step: steps[index],
    });
    index++;
  }

  return rows;
}

export function MacroPage() {
  const { t } = useLanguage();
  const runtimeMacro = useRuntimeMacro();
  const keymap = useKeymap();
  const keyboardLayoutContext = useContext(KeyboardLayoutContext);
  // Proactive lock state: prompt for unlock on edit intent and show a lock
  // badge in place of Save/Reset, instead of letting the edit fail first.
  const { locked } = useStudioLockState();
  // Proactive unlock gate (opens the shared unlock modal); the reactive
  // fail→modal→retry path is handled inside the feature hooks via runWithUnlock.
  const { requireUnlock: requireUnlocked } = useStudioUnlock();
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [loadedMacro, setLoadedMacro] = useState<MacroDetail | null>(null);
  const [editingStepIndex, setEditingStepIndex] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDiscarding, setIsDiscarding] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [renameDraft, setRenameDraft] = useState("");
  const [stringConversionError, setStringConversionError] = useState<
    string | null
  >(null);
  const [stringDraft, setStringDraft] = useState<StringDraftRow | null>(null);
  const [isGlobalSettingsExpanded, setIsGlobalSettingsExpanded] =
    useState(false);
  // Tap ms has no device-side unsaved flag (it is a global setting, not a
  // MacroSummary slot), so its green dot stays client-tracked.
  const [globalSettingsModified, setGlobalSettingsModified] = useState(false);
  // Local draft for the debounced tap-ms input so typing stays responsive
  // while the memory write is deferred until the quiet period.
  const [tapMsDraft, setTapMsDraft] = useState(0);

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
      ? t(
          "Encoded macro is {{encodedSize}} bytes; limit is {{maxMacroBytes}}.",
          {
            encodedSize,
            maxMacroBytes: runtimeMacro.maxMacroBytes,
          },
        )
      : null;

  const keyPressBehaviorId = useMemo(
    () =>
      runtimeMacro.globalSettings?.keyPressBehaviorId ||
      getKeyPressBehaviorId(keymap.behaviors),
    [keymap.behaviors, runtimeMacro.globalSettings?.keyPressBehaviorId],
  );

  const stepRows = useMemo(
    () =>
      loadedMacro
        ? buildMacroStepRows(loadedMacro.steps, keyPressBehaviorId, stringDraft)
        : [],
    [keyPressBehaviorId, loadedMacro, stringDraft],
  );

  const selectedStep =
    editingStepIndex !== null ? loadedMacro?.steps[editingStepIndex] : null;

  const loadMacro = useCallback(
    async (slot: number) => {
      const macro = await runtimeMacro.getMacro(slot);
      if (macro) {
        setSelectedName(macro.name);
        setLoadedMacro(macro);
        setRenameDraft(macro.name);
        setStringDraft(null);
        setStringConversionError(null);
      }
    },
    [runtimeMacro],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!runtimeMacro.isAvailable || runtimeMacro.macros.length === 0) {
        setSelectedName(null);
        setLoadedMacro(null);
        return;
      }

      // Reselect by name (not slot) after a create/delete/rename, since a
      // macro's slot can change identity across a re-list.
      const stillSelected = runtimeMacro.macros.find(
        (macro) => macro.name === selectedName,
      );
      const nextMacro = stillSelected ?? runtimeMacro.macros[0];
      if (selectedName === null) {
        setSelectedName(nextMacro.name);
      }
      if (!loadedMacro || loadedMacro.slot !== nextMacro.slot) {
        void loadMacro(nextMacro.slot);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [
    loadMacro,
    loadedMacro,
    runtimeMacro.isAvailable,
    runtimeMacro.macros,
    selectedName,
  ]);

  // The listMacros RPC requires unlock: useRuntimeMacro fires loadMacros on
  // mount, and while locked that call is parked by the shared unlock gate,
  // which opens the modal and auto-retries the load once the user unlocks.

  const commitRename = useCallback(async () => {
    if (!requireUnlocked()) return;
    if (!loadedMacro) return;
    const trimmedName = renameDraft.slice(0, runtimeMacro.maxNameLength).trim();
    if (!trimmedName || trimmedName === loadedMacro.name) {
      setRenameDraft(loadedMacro.name);
      return;
    }
    const ok = await runtimeMacro.renameMacro(loadedMacro.name, trimmedName);
    if (ok) {
      setSelectedName(trimmedName);
      setLoadedMacro({ ...loadedMacro, name: trimmedName });
    } else {
      setRenameDraft(loadedMacro.name);
    }
  }, [loadedMacro, renameDraft, runtimeMacro, requireUnlocked]);

  const commitSteps = useCallback(
    async (steps: MacroStep[]) => {
      if (!requireUnlocked()) return false;
      if (!loadedMacro) return false;
      if (!canCommitSteps(steps)) {
        return false;
      }
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
        loadedMacro.slot,
        steps.length,
      );
      if (!countUpdated) return false;

      for (const [stepIndex, step] of steps.entries()) {
        const stepUpdated = await runtimeMacro.setMacroStep(
          loadedMacro.slot,
          stepIndex,
          step,
        );
        if (!stepUpdated) return false;
      }

      setLoadedMacro({ ...loadedMacro, steps });
      await runtimeMacro.loadMacros();
      return true;
    },
    [loadedMacro, runtimeMacro, requireUnlocked],
  );

  const updateStep = useCallback(
    async (stepIndex: number, step: MacroStep) => {
      if (!loadedMacro) return;
      const steps = loadedMacro.steps.map((existingStep, index) =>
        index === stepIndex ? step : existingStep,
      );
      const size = getRuntimeMacroEncodedSize(steps);
      setLoadedMacro({ ...loadedMacro, steps, encodedSize: size });
      if (size <= runtimeMacro.maxMacroBytes && canCommitSteps(steps)) {
        await commitSteps(steps);
      }
    },
    [commitSteps, loadedMacro, runtimeMacro.maxMacroBytes],
  );

  const handleActionChange = useCallback(
    async (stepIndex: number, action: StepAction) => {
      if (!loadedMacro) return;
      const currentStep = loadedMacro.steps[stepIndex];
      const currentAction = getStepAction(currentStep);
      if (action === "string") {
        const binding = getStepBinding(currentStep);
        const initialString =
          getKeyTapSequenceString(currentStep) ??
          (binding && binding.behaviorId === keyPressBehaviorId
            ? (HID_USAGE_TO_CHAR.get(binding.param1) ?? "")
            : "");
        const value =
          initialString.length >= STRING_MIN_GROUP_LENGTH
            ? initialString
            : `${initialString || "a"}a`;
        const step = stringToKeyTapSequenceStep(value);
        if (!step) {
          setStringConversionError(
            t("Only HID keyboard-page printable characters are supported."),
          );
          return;
        }
        setStringConversionError(null);
        setStringDraft({
          startIndex: stepIndex,
          length: 1,
          value,
        });
        await commitSteps([
          ...loadedMacro.steps.slice(0, stepIndex),
          step,
          ...loadedMacro.steps.slice(stepIndex + 1),
        ]);
        return;
      }
      setStringDraft(null);
      const nextStep = createStep(
        action,
        getStepBinding(currentStep),
        currentAction === "delay" ? currentStep.delay?.delayMs : 0,
      );
      await updateStep(stepIndex, nextStep);
    },
    [commitSteps, keyPressBehaviorId, loadedMacro, t, updateStep],
  );

  const handleStringChange = useCallback(
    (row: MacroStepRow, value: string) => {
      if (!loadedMacro) return;
      const replacementStep = stringToKeyTapSequenceStep(value);
      if (!replacementStep) {
        setStringConversionError(
          t("Only HID keyboard-page printable characters are supported."),
        );
        return;
      }
      setStringConversionError(null);
      setStringDraft({
        startIndex: row.startIndex,
        length: 1,
        value,
      });
      const steps = [
        ...loadedMacro.steps.slice(0, row.startIndex),
        replacementStep,
        ...loadedMacro.steps.slice(row.startIndex + row.length),
      ];
      setLoadedMacro({
        ...loadedMacro,
        steps,
        encodedSize: getRuntimeMacroEncodedSize(steps),
      });
    },
    [loadedMacro, t],
  );

  const commitStringChange = useCallback(async () => {
    if (!loadedMacro || stringConversionError) return;
    const ok = await commitSteps(loadedMacro.steps);
    if (ok) setStringDraft(null);
  }, [commitSteps, loadedMacro, stringConversionError]);

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

  // Debounced memory writes for free-text/number edits: typing auto-writes to
  // keyboard memory after a quiet period (flushed on blur / before Save).
  // Discrete dropdown selections keep committing immediately (see updateStep).
  const delayDebounce = useDebouncedMemoryWrite<number>(
    useCallback(
      async (stepIndex: number) => {
        await commitDelay(stepIndex);
      },
      [commitDelay],
    ),
  );

  const stringDebounce = useDebouncedMemoryWrite<void>(
    useCallback(async () => {
      await commitStringChange();
    }, [commitStringChange]),
  );

  const tapMsDebounce = useDebouncedMemoryWrite<number>(
    useCallback(
      async (tapMs: number) => {
        if (!requireUnlocked()) return;
        const ok = await runtimeMacro.setTapMs(clampUInt32(tapMs));
        if (ok) setGlobalSettingsModified(true);
      },
      [requireUnlocked, runtimeMacro],
    ),
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
    if (!requireUnlocked()) return;
    if (!loadedMacro) return;
    const steps = [...loadedMacro.steps, DEFAULT_STEP];
    try {
      const size = getRuntimeMacroEncodedSize(steps);
      if (size > runtimeMacro.maxMacroBytes) return;
    } catch {
      return;
    }
    setStringDraft(null);
    const ok = await runtimeMacro.appendMacroStep(
      loadedMacro.slot,
      DEFAULT_STEP,
    );
    if (ok) {
      setLoadedMacro({
        ...loadedMacro,
        steps,
        encodedSize: getRuntimeMacroEncodedSize(steps),
      });
      await runtimeMacro.loadMacros();
    }
  }, [loadedMacro, runtimeMacro, requireUnlocked]);

  const handleDeleteMacro = useCallback(async () => {
    if (!requireUnlocked()) return;
    if (!loadedMacro) return;
    setIsDeleting(true);
    try {
      const ok = await runtimeMacro.deleteMacro(loadedMacro.name);
      if (ok) {
        setSelectedName(null);
        setLoadedMacro(null);
      }
    } finally {
      setIsDeleting(false);
    }
  }, [loadedMacro, runtimeMacro, requireUnlocked]);

  const generateMacroName = useCallback((): string => {
    const existingNames = new Set(runtimeMacro.macros.map((m) => m.name));
    let n = runtimeMacro.macros.length + 1;
    while (existingNames.has(`Macro ${n}`)) n++;
    return `Macro ${n}`;
  }, [runtimeMacro.macros]);

  const handleCreateMacro = useCallback(async () => {
    if (!requireUnlocked()) return;
    const name = generateMacroName();
    setIsCreating(true);
    try {
      const ok = await runtimeMacro.createMacro(name);
      if (ok) {
        setSelectedName(name);
      }
    } finally {
      setIsCreating(false);
    }
  }, [generateMacroName, runtimeMacro, requireUnlocked]);

  const handleResetMacro = useCallback(async () => {
    if (!requireUnlocked()) return;
    if (!loadedMacro) return;
    if (!window.confirm(t("Reset this macro to its default?"))) return;
    setIsResetting(true);
    try {
      const ok = await runtimeMacro.resetMacro(loadedMacro.slot);
      if (ok) {
        await loadMacro(loadedMacro.slot);
      }
    } finally {
      setIsResetting(false);
    }
  }, [loadMacro, loadedMacro, requireUnlocked, runtimeMacro, t]);

  const handleSave = useCallback(async () => {
    if (!requireUnlocked()) return;
    setIsSaving(true);
    try {
      // Flush any queued debounced edits so they are part of this persist.
      await tapMsDebounce.flush();
      await delayDebounce.flush();
      await stringDebounce.flush();
      await runtimeMacro.saveMacros();
      setGlobalSettingsModified(false);
    } finally {
      setIsSaving(false);
    }
  }, [
    delayDebounce,
    requireUnlocked,
    runtimeMacro,
    stringDebounce,
    tapMsDebounce,
  ]);

  const handleDiscard = useCallback(async () => {
    if (!requireUnlocked()) return;
    setIsDiscarding(true);
    try {
      // Drop queued edits — discard restores the persisted values.
      tapMsDebounce.cancel();
      delayDebounce.cancel();
      stringDebounce.cancel();
      await runtimeMacro.discardMacros();
      setGlobalSettingsModified(false);
      if (loadedMacro) {
        await loadMacro(loadedMacro.slot);
      }
    } finally {
      setIsDiscarding(false);
    }
  }, [
    delayDebounce,
    loadMacro,
    loadedMacro,
    requireUnlocked,
    runtimeMacro,
    stringDebounce,
    tapMsDebounce,
  ]);

  const handleTapMsChange = useCallback(
    (tapMs: number) => {
      setTapMsDraft(tapMs);
      tapMsDebounce.queue(tapMs);
    },
    [tapMsDebounce],
  );

  const getStepDisplayName = useCallback(
    (step: MacroStep) => {
      const binding = getStepBinding(step);
      if (!binding || binding.behaviorId === 0) return t("Select behavior");
      const behavior = keymap.behaviors.get(binding.behaviorId);
      if (!behavior) return t("Behavior {{id}}", { id: binding.behaviorId });
      return formatBehaviorBinding(binding, behavior, {
        layers: layersForSelector,
        keyboardLayout: keyboardLayoutContext.layout,
        runtimeMacros: runtimeMacro.macros,
      });
    },
    [
      keymap.behaviors,
      keyboardLayoutContext.layout,
      layersForSelector,
      runtimeMacro.macros,
      t,
    ],
  );

  // Keep the debounced tap-ms input in sync with device state (initial load,
  // discard, external refresh) while leaving in-flight typing untouched.
  useEffect(() => {
    setTapMsDraft(runtimeMacro.globalSettings?.tapMs ?? 0);
  }, [runtimeMacro.globalSettings?.tapMs]);

  const loadedMacroHasUnsavedChanges =
    loadedMacro !== null && runtimeMacro.isSlotUnsaved(loadedMacro.slot);

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
                {t("Macro")}
              </h1>
              <p className="text-sm text-[var(--color-text-muted)]">
                {t("Edit runtime macro slots")}
              </p>
            </div>
          </div>

          {runtimeMacro.isAvailable && (
            <div className="flex items-center gap-2 ml-auto">
              <button
                className="btn-ghost text-sm flex items-center gap-1.5"
                onClick={() => void runtimeMacro.loadMacros()}
                disabled={runtimeMacro.isLoading}
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
                  {runtimeMacro.hasUnsavedChanges && (
                    <span className="flex items-center gap-1 text-xs text-[var(--color-neon)] mr-2">
                      <StatusDot status="unsaved" />
                      {t("Unsaved changes")}
                    </span>
                  )}
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
                    {t("Discard")}
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
                    {t("Save")}
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {!runtimeMacro.isAvailable && (
          <div className="glass-card p-6 text-center">
            <p className="text-sm text-[var(--color-text-muted)]">
              {t("Runtime macro subsystem not found. Build firmware with")}{" "}
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

        {(runtimeMacro.error ||
          encodedSizeError ||
          stringConversionError ||
          keymap.error) && (
          <div className="glass-card p-4 mb-4 border-red-500/20 bg-red-500/10 flex items-center gap-3">
            <IconAlertCircle size={20} className="text-red-400" />
            <p className="text-sm text-red-400">
              {runtimeMacro.error ||
                encodedSizeError ||
                stringConversionError ||
                keymap.error}
            </p>
          </div>
        )}

        {runtimeMacro.isAvailable && (
          <div className="grid grid-cols-1 tablet:grid-cols-[240px_1fr] gap-4">
            <div className="space-y-4">
              {/* Global Settings - collapsible, above Macros */}
              <div className="glass-card overflow-hidden">
                <button
                  className="flex items-center gap-2 w-full p-3 text-left"
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
                  {globalSettingsModified && <StatusDot status="unsaved" />}
                  <IconChevronDown
                    size={14}
                    className={`text-[var(--color-text-muted)] flex-shrink-0 transition-transform ${
                      isGlobalSettingsExpanded ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {isGlobalSettingsExpanded && (
                  <div className="px-3 pb-3 border-t border-[var(--color-border)]">
                    <div className="mt-3">
                      <label className="block">
                        <span className="text-xs text-[var(--color-text-muted)]">
                          {t("Tap ms")}
                        </span>
                        <input
                          type="number"
                          min={0}
                          max={10000}
                          className="mt-1 w-full px-3 py-2 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text)] focus:outline-none focus:border-[var(--color-electric)]/50"
                          value={tapMsDraft}
                          onChange={(event) =>
                            handleTapMsChange(Number(event.target.value))
                          }
                          onBlur={() => void tapMsDebounce.flush()}
                        />
                      </label>
                      {runtimeMacro.globalSettings &&
                        runtimeMacro.globalSettings.poolBytesTotal > 0 && (
                          <p
                            className={`mt-3 text-xs ${
                              runtimeMacro.globalSettings.poolBytesUsed >=
                              runtimeMacro.globalSettings.poolBytesTotal
                                ? "text-amber-400"
                                : "text-[var(--color-text-muted)]"
                            }`}
                          >
                            {t("Shared macro pool: {{used}}/{{total}} B", {
                              used: runtimeMacro.globalSettings.poolBytesUsed,
                              total: runtimeMacro.globalSettings.poolBytesTotal,
                            })}
                          </p>
                        )}
                    </div>
                  </div>
                )}
              </div>

              {/* Macros list */}
              <div className="glass-card p-3">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-medium text-[var(--color-text)]">
                    {t("Macros")}
                  </h2>
                  <div className="flex items-center gap-1">
                    {runtimeMacro.isLoading && (
                      <IconLoader2
                        size={14}
                        className="animate-spin text-[var(--color-electric)]"
                      />
                    )}
                    <button
                      className="p-1 rounded hover:bg-[var(--color-border)] text-[var(--color-electric)] disabled:opacity-40 transition-colors"
                      onClick={() => void handleCreateMacro()}
                      disabled={isCreating || runtimeMacro.isLoading}
                      title={t("Create macro")}
                    >
                      {isCreating ? (
                        <IconLoader2 size={15} className="animate-spin" />
                      ) : (
                        <IconPlus size={15} />
                      )}
                    </button>
                  </div>
                </div>
                <div className="space-y-1">
                  {runtimeMacro.macros.length === 0 && (
                    <p className="text-sm text-[var(--color-text-muted)] py-4 text-center">
                      {t("No macros yet. Create one above.")}
                    </p>
                  )}
                  {runtimeMacro.macros.map((macro) => (
                    <button
                      key={macro.name}
                      className={`w-full px-3 py-2 rounded-lg text-left transition-colors ${
                        selectedName === macro.name
                          ? "bg-[var(--color-electric)]/20 text-[var(--color-electric)] border border-[var(--color-electric)]/30"
                          : "text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]"
                      }`}
                      onClick={() => void loadMacro(macro.slot)}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="block text-sm font-medium truncate flex-1">
                          {macro.name ||
                            t("Macro {{slot}}", { slot: macro.slot })}
                        </span>
                        {macro.hasUnsavedChanges && (
                          <StatusDot status="unsaved" />
                        )}
                      </div>
                      <span className="block text-xs text-[var(--color-text-muted)]">
                        {t("{{encodedSize}}/{{maxMacroBytes}} bytes", {
                          encodedSize: macro.encodedSize,
                          maxMacroBytes: runtimeMacro.maxMacroBytes,
                        })}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="glass-card p-4 min-w-0">
              {loadedMacro ? (
                <>
                  <div className="flex flex-col tablet:flex-row tablet:items-end gap-3 mb-4">
                    <div className="flex-1 min-w-0">
                      <label className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-text-muted)] mb-1">
                        {t("Name")}
                        {loadedMacroHasUnsavedChanges && (
                          <StatusDot status="unsaved" />
                        )}
                      </label>
                      <input
                        className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text)] focus:outline-none focus:border-[var(--color-electric)]/50"
                        value={renameDraft}
                        maxLength={runtimeMacro.maxNameLength}
                        placeholder={formatMacroName(
                          loadedMacro,
                          loadedMacro.slot,
                        )}
                        onChange={(event) => setRenameDraft(event.target.value)}
                        onBlur={() => void commitRename()}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">
                        {t("Size")}
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

                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-medium text-[var(--color-text)]">
                        {t("Steps")}
                      </h2>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        className="btn-ghost text-sm flex items-center gap-1.5"
                        onClick={() => void handleResetMacro()}
                        disabled={isResetting || runtimeMacro.isLoading}
                        title={t("Reset this macro to its default")}
                      >
                        {isResetting ? (
                          <IconLoader2 size={16} className="animate-spin" />
                        ) : (
                          <IconHistory size={16} />
                        )}
                        {t("Reset")}
                      </button>
                      <button
                        className="btn-ghost text-sm flex items-center gap-1.5 text-red-400"
                        onClick={() => void handleDeleteMacro()}
                        disabled={isDeleting || runtimeMacro.isLoading}
                      >
                        {isDeleting ? (
                          <IconLoader2 size={16} className="animate-spin" />
                        ) : (
                          <IconTrash size={16} />
                        )}
                        {t("Delete")}
                      </button>
                      <button
                        className="btn-electric text-sm flex items-center gap-1.5"
                        onClick={handleAddStep}
                        disabled={runtimeMacro.isLoading}
                      >
                        <IconPlus size={16} />
                        {t("Step")}
                      </button>
                    </div>
                  </div>

                  {stepRows.length === 0 ? (
                    <div className="p-6 text-center rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)]">
                      <p className="text-sm text-[var(--color-text-muted)]">
                        {t("No steps in this macro")}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {stepRows.map((row, rowIndex) => {
                        const step = row.step;
                        const action = row.action;
                        return (
                          <div
                            key={`${row.action}-${row.startIndex}-${rowIndex}`}
                            className="grid grid-cols-1 tablet:grid-cols-[64px_128px_1fr_40px] gap-2 items-center p-3 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)]"
                          >
                            <div className="text-xs font-mono text-[var(--color-text-muted)]">
                              #{row.startIndex + 1}
                            </div>
                            <select
                              className="px-3 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-electric)]/50"
                              value={action}
                              onChange={(event) =>
                                void handleActionChange(
                                  row.startIndex,
                                  event.target.value as StepAction,
                                )
                              }
                            >
                              <option value="tap">{t("Tap")}</option>
                              <option value="down">{t("Down")}</option>
                              <option value="up">{t("Up")}</option>
                              <option value="delay">{t("Delay")}</option>
                              <option value="string">{t("String")}</option>
                            </select>

                            {action === "delay" ? (
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  min={0}
                                  className="w-full px-3 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-electric)]/50"
                                  value={step?.delay?.delayMs ?? 0}
                                  onChange={(event) => {
                                    handleDelayChange(
                                      row.startIndex,
                                      Number(event.target.value),
                                    );
                                    delayDebounce.queue(row.startIndex);
                                  }}
                                  onBlur={() => void delayDebounce.flush()}
                                />
                                <span className="text-xs text-[var(--color-text-muted)]">
                                  {t("ms")}
                                </span>
                              </div>
                            ) : action === "string" ? (
                              <input
                                className="w-full px-3 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-electric)]/50"
                                value={row.value ?? ""}
                                onChange={(event) => {
                                  handleStringChange(row, event.target.value);
                                  stringDebounce.queue();
                                }}
                                onBlur={() => void stringDebounce.flush()}
                              />
                            ) : (
                              <button
                                className="w-full px-3 py-2 rounded-lg bg-[var(--color-surface)] hover:bg-[var(--color-border)] border border-[var(--color-border)] text-left text-sm text-[var(--color-text-secondary)] transition-colors"
                                onClick={() =>
                                  setEditingStepIndex(row.startIndex)
                                }
                              >
                                {step ? getStepDisplayName(step) : ""}
                              </button>
                            )}

                            <button
                              className="p-2 rounded-lg hover:bg-[var(--color-border)] disabled:opacity-40"
                              onClick={() =>
                                void commitSteps([
                                  ...loadedMacro.steps.slice(0, row.startIndex),
                                  ...loadedMacro.steps.slice(
                                    row.startIndex + row.length,
                                  ),
                                ])
                              }
                              disabled={runtimeMacro.isLoading}
                              aria-label={t("Remove step {{n}}", {
                                n: row.startIndex + 1,
                              })}
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
                    {runtimeMacro.macros.length === 0
                      ? t("No macros yet. Create one to get started.")
                      : t("Select a macro")}
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
        runtimeMacros={runtimeMacro.macros}
      />
    </div>
  );
}
