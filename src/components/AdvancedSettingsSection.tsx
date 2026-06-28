import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  IconAlertTriangleFilled,
  IconCode,
  IconDeviceFloppy,
  IconRefresh,
  IconRotateClockwise,
  IconX,
} from "@tabler/icons-react";
import {
  CUSTOM_SETTINGS_SOURCE_ALL,
  useCustomSettings,
} from "../hooks/useCustomSettings";
import { useKeymap, type BehaviorDefinition } from "../hooks/useKeymap";
import {
  type Setting,
  type SettingConstraint,
  type SettingScalarValue,
  type SettingValue,
} from "../proto/cormoran/zmk/custom_settings/custom_settings";

type ValueKind = "bytes" | "int32" | "bool" | "string" | "unknown";

const MEMORY_WRITE_DEBOUNCE_MS = 500;

function scalarValue(setting: Setting): SettingScalarValue | undefined {
  return setting.value?.arrayValue?.value ?? setting.value;
}

function valueKind(setting: Setting): ValueKind {
  const scalar = scalarValue(setting);
  if (!scalar) return "unknown";
  if (scalar.bytesValue !== undefined) return "bytes";
  if (scalar.int32Value !== undefined) return "int32";
  if (scalar.boolValue !== undefined) return "bool";
  if (scalar.stringValue !== undefined) return "string";
  return "unknown";
}

function scalarToSettingValue(kind: ValueKind, value: unknown): SettingValue {
  if (kind === "bytes") {
    return { bytesValue: value as Uint8Array };
  }
  if (kind === "bool") {
    return { boolValue: Boolean(value) };
  }
  if (kind === "string") {
    return { stringValue: String(value) };
  }
  return { int32Value: Number(value) || 0 };
}

function scalarToInputValue(setting: Setting): string {
  const scalar = scalarValue(setting);
  if (!scalar) return "";
  if (scalar.bytesValue !== undefined) return bytesToHex(scalar.bytesValue);
  if (scalar.int32Value !== undefined) return `${scalar.int32Value}`;
  if (scalar.boolValue !== undefined)
    return scalar.boolValue ? "true" : "false";
  if (scalar.stringValue !== undefined) return scalar.stringValue;
  return "";
}

function formatValue(setting: Setting): string {
  if (!setting.value) return "(hidden)";
  const arrayPrefix = setting.value.arrayValue
    ? `[${setting.value.arrayValue.index + 1}/${setting.value.arrayValue.size}] `
    : "";
  return `${arrayPrefix}${scalarToInputValue(setting)}`;
}

function sourceLabel(source: number): string {
  if (source === 0) return "Local";
  if (source === CUSTOM_SETTINGS_SOURCE_ALL) return "All";
  return `Source ${source}`;
}

function settingLabel(setting: Setting): string {
  const arraySuffix = setting.value?.arrayValue
    ? `[${setting.value.arrayValue.index}]`
    : "";
  return `${setting.key}${arraySuffix}`;
}

function constraints(setting: Setting): SettingConstraint[] {
  return setting.meta?.constraints ?? [];
}

function hasLayerConstraint(setting: Setting): boolean {
  return constraints(setting).some(
    (constraint) => constraint.layerId !== undefined,
  );
}

function hasBehaviorConstraint(setting: Setting): boolean {
  return constraints(setting).some(
    (constraint) => constraint.behaviorId !== undefined,
  );
}

function optionsConstraint(setting: Setting) {
  return constraints(setting).find((constraint) => constraint.options)?.options;
}

function rangeConstraint(setting: Setting) {
  return constraints(setting).find((constraint) => constraint.range)?.range;
}

function scalarOptionValue(value: SettingScalarValue): string {
  if (value.int32Value !== undefined) return `${value.int32Value}`;
  if (value.boolValue !== undefined) return value.boolValue ? "true" : "false";
  if (value.stringValue !== undefined) return value.stringValue;
  if (value.bytesValue !== undefined) return bytesToHex(value.bytesValue);
  return "";
}

function scalarOptionToSettingValue(value: SettingScalarValue): SettingValue {
  if (value.int32Value !== undefined) return { int32Value: value.int32Value };
  if (value.boolValue !== undefined) return { boolValue: value.boolValue };
  if (value.stringValue !== undefined)
    return { stringValue: value.stringValue };
  if (value.bytesValue !== undefined) return { bytesValue: value.bytesValue };
  return {};
}

function bytesToHex(value: Uint8Array): string {
  return Array.from(value)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join(" ");
}

function parseHexBytes(value: string): Uint8Array {
  const trimmed = value.trim();
  if (!trimmed) return new Uint8Array();

  const normalized = trimmed.replace(/0x/gi, "");
  const tokens = normalized.split(/[\s,]+/).filter(Boolean);
  if (tokens.some((token) => !/^[0-9a-fA-F]{1,2}$/.test(token))) {
    throw new Error("Use hexadecimal bytes such as 00 ff 2a.");
  }

  return Uint8Array.from(tokens.map((token) => Number.parseInt(token, 16)));
}

function bytesToPrintableAscii(value: Uint8Array): string {
  return Array.from(value)
    .map((byte) =>
      byte >= 0x20 && byte <= 0x7e ? String.fromCharCode(byte) : ".",
    )
    .join("");
}

function sourceSortValue(source: number): number {
  if (source === 0) return -1;
  if (source === CUSTOM_SETTINGS_SOURCE_ALL) return Number.MAX_SAFE_INTEGER;
  return source;
}

function settingSortValue(setting: Setting): string {
  return [
    setting.key,
    `${setting.value?.arrayValue?.index ?? -1}`.padStart(8, "0"),
    `${sourceSortValue(setting.source)}`.padStart(12, "0"),
  ].join(":");
}

interface ByteEditorModalProps {
  bytes: Uint8Array;
  title: string;
  onApply: (bytes: Uint8Array) => void;
  onClose: () => void;
}

function ByteEditorModal({
  bytes,
  title,
  onApply,
  onClose,
}: ByteEditorModalProps) {
  const [hexText, setHexText] = useState(bytesToHex(bytes));
  const [asciiText, setAsciiText] = useState(bytesToPrintableAscii(bytes));
  const [error, setError] = useState<string | null>(null);

  const parsedBytes = useMemo(() => {
    try {
      return parseHexBytes(hexText);
    } catch {
      return null;
    }
  }, [hexText]);

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-2xl rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
          <div>
            <h3 className="text-sm font-medium text-[var(--color-text)]">
              Bytecode Editor
            </h3>
            <p className="text-xs text-[var(--color-text-muted)]">{title}</p>
          </div>
          <button
            type="button"
            className="theme-toggle h-9 w-9"
            onClick={onClose}
            title="Close"
          >
            <IconX size={18} />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <label className="block">
            <span className="mb-2 block text-xs font-medium text-[var(--color-text-muted)]">
              Hex bytes
            </span>
            <textarea
              className="input-field min-h-32 font-mono text-sm"
              spellCheck={false}
              value={hexText}
              onChange={(event) => {
                setHexText(event.target.value);
                setError(null);
              }}
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-medium text-[var(--color-text-muted)]">
              ASCII helper
            </span>
            <div className="flex gap-2">
              <input
                className="input-field font-mono text-sm"
                value={asciiText}
                onChange={(event) => setAsciiText(event.target.value)}
              />
              <button
                type="button"
                className="btn-ghost whitespace-nowrap border border-[var(--color-border)]"
                onClick={() => {
                  const encoded = new TextEncoder().encode(asciiText);
                  setHexText(bytesToHex(encoded));
                  setError(null);
                }}
              >
                Encode
              </button>
            </div>
          </label>

          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
            <p className="text-xs text-[var(--color-text-muted)]">
              Length: {parsedBytes?.length ?? 0} bytes
            </p>
            <p className="mt-2 break-all font-mono text-xs text-[var(--color-text-secondary)]">
              {parsedBytes ? bytesToPrintableAscii(parsedBytes) : "Invalid hex"}
            </p>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-[var(--color-border)] px-5 py-4">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-electric text-sm"
            onClick={() => {
              try {
                onApply(parseHexBytes(hexText));
                onClose();
              } catch (err) {
                setError(err instanceof Error ? err.message : "Invalid bytes");
              }
            }}
          >
            Apply
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

interface SettingEditorProps {
  setting: Setting;
  layers: { id: number; name: string }[];
  behaviors: Map<number, BehaviorDefinition>;
  onChange: (value: SettingValue) => void;
}

function SettingEditor({
  setting,
  layers,
  behaviors,
  onChange,
}: SettingEditorProps) {
  const kind = valueKind(setting);
  const currentValue = scalarToInputValue(setting);
  const [isBytesOpen, setIsBytesOpen] = useState(false);
  const range = rangeConstraint(setting);
  const options = optionsConstraint(setting);

  if (!setting.value) {
    return (
      <span className="text-sm text-[var(--color-text-muted)]">
        Value is hidden by firmware permissions
      </span>
    );
  }

  if (hasLayerConstraint(setting)) {
    return (
      <select
        className="input-field max-w-xs text-sm"
        value={currentValue}
        onChange={(event) =>
          onChange({ int32Value: Number.parseInt(event.target.value, 10) })
        }
      >
        {layers.map((layer) => (
          <option key={layer.id} value={layer.id}>
            {layer.name || `Layer ${layer.id}`} ({layer.id})
          </option>
        ))}
        {layers.length === 0 && (
          <option value={currentValue}>{currentValue}</option>
        )}
      </select>
    );
  }

  if (hasBehaviorConstraint(setting)) {
    const behaviorList = Array.from(behaviors.values()).sort((a, b) =>
      a.displayName.localeCompare(b.displayName),
    );
    return (
      <select
        className="input-field max-w-xs text-sm"
        value={currentValue}
        onChange={(event) =>
          onChange({ int32Value: Number.parseInt(event.target.value, 10) })
        }
      >
        {behaviorList.map((behavior) => (
          <option key={behavior.id} value={behavior.id}>
            {behavior.displayName} ({behavior.id})
          </option>
        ))}
        {behaviorList.length === 0 && (
          <option value={currentValue}>{currentValue}</option>
        )}
      </select>
    );
  }

  if (options) {
    return (
      <select
        className="input-field max-w-xs text-sm"
        value={currentValue}
        onChange={(event) => {
          const selectedIndex = options.values.findIndex(
            (value) => scalarOptionValue(value) === event.target.value,
          );
          if (selectedIndex >= 0) {
            onChange(scalarOptionToSettingValue(options.values[selectedIndex]));
          }
        }}
      >
        {options.values.map((value, index) => (
          <option
            key={`${scalarOptionValue(value)}:${index}`}
            value={scalarOptionValue(value)}
          >
            {options.labels[index] || scalarOptionValue(value)}
          </option>
        ))}
      </select>
    );
  }

  if (kind === "bool") {
    return (
      <label className="inline-flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
        <input
          type="checkbox"
          checked={currentValue === "true"}
          onChange={(event) => onChange({ boolValue: event.target.checked })}
        />
        Enabled
      </label>
    );
  }

  if (kind === "bytes") {
    const bytes = scalarValue(setting)?.bytesValue ?? new Uint8Array();
    return (
      <div className="flex min-w-0 items-center gap-2">
        <code className="min-w-0 max-w-sm truncate rounded bg-[var(--color-bg)] px-3 py-2 font-mono text-xs text-[var(--color-text-secondary)]">
          {bytesToHex(bytes) || "(empty)"}
        </code>
        <button
          type="button"
          className="theme-toggle h-10 w-10"
          onClick={() => setIsBytesOpen(true)}
          title="Edit bytecode"
        >
          <IconCode size={18} />
        </button>
        {isBytesOpen && (
          <ByteEditorModal
            bytes={bytes}
            title={settingLabel(setting)}
            onApply={(nextBytes) => onChange({ bytesValue: nextBytes })}
            onClose={() => setIsBytesOpen(false)}
          />
        )}
      </div>
    );
  }

  if (kind === "int32") {
    const min = range?.min?.int32Value;
    const max = range?.max?.int32Value;
    return (
      <input
        className="input-field max-w-xs text-sm"
        type="number"
        min={min}
        max={max}
        value={currentValue}
        onChange={(event) =>
          onChange(
            scalarToSettingValue(
              "int32",
              Number.parseInt(event.target.value, 10),
            ),
          )
        }
      />
    );
  }

  return (
    <input
      className="input-field max-w-xs text-sm"
      value={currentValue}
      onChange={(event) => onChange({ stringValue: event.target.value })}
    />
  );
}

interface SettingRowProps {
  setting: Setting;
  layers: { id: number; name: string }[];
  behaviors: Map<number, BehaviorDefinition>;
  isLoading: boolean;
  onWrite: (setting: Setting, value: SettingValue) => Promise<void>;
  onDiscard: (setting: Setting) => Promise<void>;
  onReset: (setting: Setting) => Promise<void>;
}

function SettingRow({
  setting,
  layers,
  behaviors,
  isLoading,
  onWrite,
  onDiscard,
  onReset,
}: SettingRowProps) {
  const [saveState, setSaveState] = useState<"idle" | "queued" | "saving">(
    "idle",
  );
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const queueMemoryWrite = (value: SettingValue) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setSaveState("queued");
    timeoutRef.current = setTimeout(() => {
      setSaveState("saving");
      void onWrite(setting, value).finally(() => setSaveState("idle"));
    }, MEMORY_WRITE_DEBOUNCE_MS);
  };

  return (
    <div className="grid gap-3 border-t border-[var(--color-border)] py-4 md:grid-cols-[minmax(0,1fr)_7rem_minmax(14rem,22rem)_8rem_7rem] md:items-center">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-[var(--color-text)]">
            {settingLabel(setting)}
          </p>
          {setting.hasUnsavedValue && (
            <span className="rounded border border-[var(--color-neon)]/30 bg-[var(--color-neon)]/10 px-2 py-0.5 text-[10px] font-medium text-[var(--color-neon)]">
              Unsaved
            </span>
          )}
        </div>
        <p className="mt-1 truncate font-mono text-xs text-[var(--color-text-muted)]">
          {formatValue(setting)}
        </p>
      </div>

      <span className="text-xs text-[var(--color-text-muted)]">
        {sourceLabel(setting.source)}
      </span>

      <SettingEditor
        setting={setting}
        layers={layers}
        behaviors={behaviors}
        onChange={queueMemoryWrite}
      />

      <span className="text-xs text-[var(--color-text-muted)]">
        {saveState === "queued"
          ? "Queued"
          : saveState === "saving"
            ? "Memory..."
            : setting.hasUnsavedValue
              ? "In memory"
              : "Current"}
      </span>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          className="theme-toggle h-9 w-9"
          disabled={isLoading}
          onClick={() => onDiscard(setting)}
          title="Discard item changes"
        >
          <IconRefresh size={17} />
        </button>
        <button
          type="button"
          className="theme-toggle h-9 w-9"
          disabled={isLoading}
          onClick={() => onReset(setting)}
          title="Reset item to default"
        >
          <IconRotateClockwise size={17} />
        </button>
      </div>
    </div>
  );
}

export function AdvancedSettingsSection() {
  const customSettings = useCustomSettings();
  const { keymap, behaviors, isLoading: keymapLoading } = useKeymap();

  const layers = useMemo(
    () =>
      keymap?.layers.map((layer, index) => ({
        id: layer.id,
        name: layer.name || `Layer ${index}`,
      })) ?? [],
    [keymap?.layers],
  );

  return (
    <div className="glass-card p-6">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 className="text-sm font-medium text-[var(--color-text)]">
            Advanced Settings
          </h3>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
            Changes are written to keyboard memory after a short delay. Save a
            section to persist them.
          </p>
        </div>
        <button
          type="button"
          className="btn-ghost flex items-center gap-2 border border-[var(--color-border)] text-sm"
          onClick={customSettings.loadSettings}
          disabled={customSettings.isLoading}
        >
          <IconRefresh size={16} />
          Reload
        </button>
      </div>

      <div className="mb-4 flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
        <IconAlertTriangleFilled
          size={18}
          className="mt-0.5 flex-shrink-0 text-amber-400"
        />
        <p className="text-xs leading-relaxed text-[var(--color-text-secondary)]">
          Advanced settings can change firmware behavior immediately. Incorrect
          values may make the keyboard hard to use; discard or reset a section
          if the device starts behaving unexpectedly.
        </p>
      </div>

      {!customSettings.isAvailable ? (
        <p className="text-sm text-[var(--color-text-muted)]">
          Custom settings subsystem is not available for this keyboard.
        </p>
      ) : customSettings.isLoading && customSettings.sections.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)]">
          Loading advanced settings...
        </p>
      ) : customSettings.sections.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)]">
          No advanced settings were reported by the keyboard.
        </p>
      ) : (
        <div className="space-y-6">
          {customSettings.sections.map((section) => {
            const hasUnsavedChanges = section.settings.some(
              (setting) => setting.hasUnsavedValue,
            );
            const sortedSettings = [...section.settings].sort((a, b) =>
              settingSortValue(a).localeCompare(settingSortValue(b)),
            );

            return (
              <section
                key={section.customSubsystemIndex}
                className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]"
              >
                <div className="flex flex-col gap-3 border-b border-[var(--color-border)] p-4 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <h4 className="truncate text-sm font-medium text-[var(--color-text)]">
                      {section.identifier}
                    </h4>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      {section.settings.length} settings
                      {keymapLoading
                        ? " - loading layer and behavior names"
                        : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      className="btn-electric flex items-center gap-2 px-3 py-2 text-sm"
                      disabled={customSettings.isLoading || !hasUnsavedChanges}
                      onClick={() =>
                        customSettings.saveSection(section.customSubsystemIndex)
                      }
                    >
                      <IconDeviceFloppy size={16} />
                      Save
                    </button>
                    <button
                      type="button"
                      className="btn-ghost flex items-center gap-2 border border-[var(--color-border)] text-sm"
                      disabled={customSettings.isLoading}
                      onClick={() =>
                        customSettings.discardSection(
                          section.customSubsystemIndex,
                        )
                      }
                    >
                      <IconRefresh size={16} />
                      Discard
                    </button>
                    <button
                      type="button"
                      className="btn-ghost flex items-center gap-2 border border-red-500/30 text-sm text-red-400"
                      disabled={customSettings.isLoading}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Reset all settings in ${section.identifier}?`,
                          )
                        ) {
                          void customSettings.resetSection(
                            section.customSubsystemIndex,
                          );
                        }
                      }}
                    >
                      <IconRotateClockwise size={16} />
                      Reset
                    </button>
                  </div>
                </div>

                <div className="px-4">
                  <div className="hidden grid-cols-[minmax(0,1fr)_7rem_minmax(14rem,22rem)_8rem_7rem] gap-3 py-3 text-xs font-medium uppercase text-[var(--color-text-muted)] md:grid">
                    <span>Setting</span>
                    <span>Source</span>
                    <span>Editor</span>
                    <span>Status</span>
                    <span className="text-right">Item</span>
                  </div>
                  {sortedSettings.map((setting) => (
                    <SettingRow
                      key={[
                        setting.customSubsystemIndex,
                        setting.key,
                        setting.source,
                        setting.value?.arrayValue?.index ?? "scalar",
                      ].join(":")}
                      setting={setting}
                      layers={layers}
                      behaviors={behaviors}
                      isLoading={customSettings.isLoading}
                      onWrite={customSettings.writeSettingToMemory}
                      onDiscard={customSettings.discardSetting}
                      onReset={customSettings.resetSetting}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {customSettings.error && (
        <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3">
          <p className="text-sm text-red-400">{customSettings.error}</p>
        </div>
      )}
    </div>
  );
}
