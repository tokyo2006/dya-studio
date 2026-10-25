import { useState, type ReactNode } from "react";
import * as Switch from "@radix-ui/react-switch";
import * as Dialog from "@radix-ui/react-dialog";
import {
  IconAlertTriangle,
  IconAlertTriangleFilled,
  IconArrowsMove,
  IconBolt,
  IconChevronDown,
  IconHandClick,
  IconHandFinger,
  IconLoader2,
  IconMouse,
  IconRefresh,
  IconRestore,
} from "@tabler/icons-react";
import { useLanguage } from "../hooks/useLanguage";
import { useCirque, type UseCirqueReturn } from "../hooks/useCirque";
import { useTps43, type UseTps43Return } from "../hooks/useTps43";
import { useRuntimeInputProcessor } from "../hooks/useRuntimeInputProcessor";
import { LoadingIndicator } from "../components/LoadingIndicator";
import { Tps43GestureMap } from "../components/Tps43GestureMap";
import { TrackpadZoneMap } from "../components/TrackpadZoneMap";
import { ResponsiveButton } from "../components/ResponsiveButton";
import type { CirqueState } from "../proto/tokyo2006/cirque/cirque";
import type { Tps43State, TrackpadInfo } from "../proto/tokyo2006/tps43/tps43";

type NumericKey = {
  [K in keyof CirqueState]-?: NonNullable<CirqueState[K]> extends number
    ? K
    : never;
}[keyof CirqueState];
type BooleanKey = {
  [K in keyof CirqueState]-?: NonNullable<CirqueState[K]> extends boolean
    ? K
    : never;
}[keyof CirqueState];

type Tps43NumericKey = {
  [K in keyof Tps43State]-?: NonNullable<Tps43State[K]> extends number
    ? K
    : never;
}[keyof Tps43State];
type Tps43BooleanKey = {
  [K in keyof Tps43State]-?: NonNullable<Tps43State[K]> extends boolean
    ? K
    : never;
}[keyof Tps43State];

const MODULE_NAME = "tokyo2006/cirque-input-module";
const MODULE_URL = "https://github.com/tokyo2006/cirque-input-module";
const TPS43_MODULE_NAME = "tokyo2006/tps43-input-module";
const TPS43_MODULE_URL = "https://github.com/tokyo2006/tps43-input-module";
const U16_MAX = 65535;

// TPS43 intent-level choices. v1 firmware has no preset RPC for these: the page
// owns the labels/values and writes the raw field, so older revisions work too.
const HOLD_DURATION_OPTIONS = [
  { label: "Short", value: 150 },
  { label: "Medium", value: 250 },
  { label: "Long", value: 400 },
];
const BATTERY_SAVER_OPTIONS = [
  { label: "Off", value: 0 },
  { label: "Balanced", value: 1 },
  { label: "Max", value: 2 },
];
const SENSITIVITY_OPTIONS = [
  { label: "Low", value: 1 },
  { label: "Medium", value: 3 },
  { label: "High", value: 5 },
];

const SLIDER_CLASS = `w-full h-2 rounded-lg appearance-none cursor-pointer
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
  [&::-moz-range-thumb]:shadow-[0_0_8px_var(--color-electric)]`;

function Card({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="glass-card p-6">
      <div className="flex items-start gap-2 mb-4">
        <span className="mt-0.5 text-[var(--color-cyber)]">{icon}</span>
        <div>
          <h2 className="text-sm font-medium text-[var(--color-text)]">
            {title}
          </h2>
          {description && (
            <p className="text-xs text-[var(--color-text-muted)]">
              {description}
            </p>
          )}
        </div>
      </div>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm text-[var(--color-text-secondary)]">{label}</p>
        {description && (
          <p className="text-xs text-[var(--color-text-muted)]">
            {description}
          </p>
        )}
      </div>
      <Switch.Root
        checked={checked}
        onCheckedChange={onChange}
        aria-label={label}
        className="w-11 h-6 shrink-0 rounded-full relative data-[state=checked]:bg-[var(--color-electric)] bg-[var(--color-surface)] border border-[var(--color-border)] transition-colors cursor-pointer"
      >
        <Switch.Thumb className="block w-5 h-5 rounded-full transition-transform data-[state=checked]:translate-x-5 translate-x-0.5 will-change-transform bg-white border border-[var(--color-border)]" />
      </Switch.Root>
    </div>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  step = 1,
  unit = "",
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  format?: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-[var(--color-text-secondary)]">
          {label}
        </span>
        <span className="text-sm font-mono text-[var(--color-electric)]">
          {format ? format(value) : value}
          {unit}
        </span>
      </div>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={SLIDER_CLASS}
      />
    </div>
  );
}

function NumberRow({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  // Free-form draft while typing; commit (clamped) on blur or Enter.
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft === null) return;
    const v = Number(draft);
    if (draft.trim() !== "" && Number.isInteger(v)) {
      const clamped = Math.min(max, Math.max(min, v));
      if (clamped !== value) onChange(clamped);
    }
    setDraft(null);
  };
  return (
    <label className="flex items-center justify-between gap-4">
      <span className="text-sm text-[var(--color-text-secondary)]">
        {label}
      </span>
      <input
        type="number"
        min={min}
        max={max}
        value={draft ?? value}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
        }}
        className="w-28 px-2 py-1 rounded-lg text-sm font-mono text-right bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)]"
      />
    </label>
  );
}

/**
 * Intent-level preset picker. Values stay numeric on the wire; the labels are
 * the user-facing intent ("Short", "Balanced", ...).
 */
function ChoiceRow({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: number;
  options: { label: string; value: number }[];
  onChange: (v: number) => void;
}) {
  const { t } = useLanguage();
  return (
    <div>
      <span className="text-sm text-[var(--color-text-secondary)]">
        {label}
      </span>
      <div
        role="group"
        aria-label={label}
        className="mt-2 inline-flex overflow-hidden rounded-lg border border-[var(--color-border)]"
      >
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
            className={`px-3 py-1.5 text-xs transition-colors ${
              value === option.value
                ? "bg-[var(--color-electric)]/15 text-[var(--color-electric)]"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            }`}
          >
            {t(option.label)}
          </button>
        ))}
      </div>
    </div>
  );
}

function CirquePanel(props: UseCirqueReturn) {
  const { t } = useLanguage();
  const {
    isAvailable,
    values,
    isLoading,
    isResetting,
    error,
    writeState,
    load,
    update,
    reset,
  } = props;
  const [showResetDialog, setShowResetDialog] = useState(false);

  const num = (key: NumericKey) => values?.[key] ?? 0;
  const bool = (key: BooleanKey) => values?.[key] ?? false;
  const setNum = (key: NumericKey) => (v: number) => update({ [key]: v });
  const setBool = (key: BooleanKey) => (v: boolean) => update({ [key]: v });

  const halfX = (num("activeRangeXMax") - num("activeRangeXMin")) / 2 || 762;
  const halfY = (num("activeRangeYMax") - num("activeRangeYMin")) / 2 || 598;

  const handleReset = async () => {
    if (await reset()) setShowResetDialog(false);
  };

  return (
    <div className="app-page p-4 sm:p-6 h-full">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4 mb-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="shrink-0 p-2 rounded-lg bg-[var(--color-cyber)]/10 border border-[var(--color-cyber)]/20">
              <IconHandFinger size={24} className="text-[var(--color-cyber)]" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-medium text-[var(--color-text)]">
                {t("Trackpad Settings")}
              </h1>
              <p className="text-sm text-[var(--color-text-muted)]">
                {t(
                  "Changes are applied and saved to the keyboard automatically",
                )}
              </p>
            </div>
          </div>
          {isAvailable && (
            <div className="flex items-center gap-2">
              {writeState !== "idle" && (
                <span
                  role="status"
                  className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]"
                >
                  <IconLoader2 size={14} className="animate-spin" />
                  {writeState === "queued" ? t("Pending...") : t("Saving...")}
                </span>
              )}
              <ResponsiveButton
                label={t("Reload")}
                className="btn-ghost text-sm flex items-center gap-1.5"
                onClick={() => void load()}
                disabled={isLoading || writeState !== "idle"}
              >
                {isLoading ? (
                  <IconLoader2 size={16} className="animate-spin" />
                ) : (
                  <IconRefresh size={16} />
                )}
              </ResponsiveButton>
              <ResponsiveButton
                label={t("Reset to defaults")}
                className="btn-ghost text-sm flex items-center gap-1.5"
                onClick={() => setShowResetDialog(true)}
                disabled={!values || isResetting}
              >
                <IconRestore size={16} />
              </ResponsiveButton>
            </div>
          )}
        </div>

        {!isAvailable && (
          <div className="mb-6 p-4 rounded-lg bg-[var(--color-border)] border border-[var(--color-border-hover)] flex items-start gap-3">
            <div className="p-2">
              <IconAlertTriangleFilled size={24} className="text-red-500" />
            </div>
            <p className="text-sm text-[var(--color-text-muted)]">
              {t("Trackpad subsystem is not available for your keyboard.")}
              <br />
              {t("Make sure your firmware has the {{module}} enabled.", {
                module: MODULE_NAME,
              })}
              <a
                href={MODULE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--color-electric)] underline mx-1"
              >
                {MODULE_NAME}
              </a>
            </p>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20"
          >
            <p className="text-sm text-red-400">{t(error)}</p>
          </div>
        )}

        {isAvailable && isLoading && !values && (
          <LoadingIndicator
            className="mb-6"
            label={t("Loading trackpad settings...")}
          />
        )}

        {values && (
          <div className="grid grid-cols-1 desktop:grid-cols-[minmax(0,1fr)_minmax(360px,440px)] gap-6 items-start">
            <div className="desktop:sticky desktop:top-6">
              <Card
                icon={<IconHandFinger size={16} />}
                title={t("Zones & gesture preview")}
                description={t(
                  "Drag on the pad to see how the firmware classifies the gesture",
                )}
              >
                <TrackpadZoneMap
                  params={{
                    wedgeWidthDeg: (num("secondaryTapWidthDeg") || 250) / 10,
                    centerDeg: (num("secondaryTapCenterDeg") || 425) / 10,
                    ringPct: num("edgeScrollRingPercent") || 70,
                    halfX,
                    halfY,
                    auxEnabled: bool("auxTapEnable"),
                    auxWidthPct: (num("auxTapAreaWidth") / halfX) * 100,
                    auxHeightPct: (num("auxTapAreaHeight") / halfY) * 100,
                    rightScrollEnabled: bool("rightEdgeScrollEnable"),
                    topScrollEnabled: bool("topEdgeScrollEnable"),
                    tapMaxMs: num("tapMaxMs"),
                    tapMove: num("tapMaxMovement"),
                    divisor: num("scrollDivisor"),
                    invertScroll: bool("invertScroll"),
                    tapDragEnabled: bool("tapDragEnable"),
                    tapDragTimeoutMs: num("tapDragTimeoutMs"),
                    tapDragMaxMovement: num("tapDragMaxMovement"),
                  }}
                />
              </Card>
            </div>

            <div className="space-y-4">
              <Card
                icon={<IconBolt size={16} />}
                title={t("Speed")}
                description={t("Runtime pointer and scroll speed")}
              >
                <SliderRow
                  label={t("Pointer Speed")}
                  value={num("pointerSpeedPosition")}
                  min={0}
                  max={100}
                  onChange={setNum("pointerSpeedPosition")}
                />
              </Card>

              <Card
                icon={<IconHandClick size={16} />}
                title={t("Tap")}
                description={t("Tap to click and tap-and-drag")}
              >
                <ToggleRow
                  label={t("Tap to Click")}
                  checked={bool("primaryTapEnable")}
                  onChange={setBool("primaryTapEnable")}
                />
                <ToggleRow
                  label={t("Secondary Tap (right click)")}
                  checked={bool("secondaryTapEnable")}
                  onChange={setBool("secondaryTapEnable")}
                />
                <SliderRow
                  label={t("Right-click zone width")}
                  value={num("secondaryTapWidthDeg")}
                  min={150}
                  max={400}
                  step={10}
                  unit="°"
                  format={(v) => (v / 10).toFixed(1)}
                  onChange={setNum("secondaryTapWidthDeg")}
                />
                <SliderRow
                  label={t("Max Tap Duration")}
                  value={num("tapMaxMs")}
                  min={50}
                  max={1000}
                  step={10}
                  unit="ms"
                  onChange={setNum("tapMaxMs")}
                />
                <ToggleRow
                  label={t("Tap and Drag")}
                  description={t("Tap, then touch again to hold the button")}
                  checked={bool("tapDragEnable")}
                  onChange={setBool("tapDragEnable")}
                />
                {bool("tapDragEnable") && (
                  <SliderRow
                    label={t("Drag Timeout")}
                    value={num("tapDragTimeoutMs")}
                    min={100}
                    max={1000}
                    step={10}
                    unit="ms"
                    onChange={setNum("tapDragTimeoutMs")}
                  />
                )}
              </Card>

              <Card
                icon={<IconMouse size={16} />}
                title={t("Scroll")}
                description={t("Scroll by sliding along the trackpad edge")}
              >
                <ToggleRow
                  label={t("Right Edge Scroll")}
                  checked={bool("rightEdgeScrollEnable")}
                  onChange={setBool("rightEdgeScrollEnable")}
                />
                <ToggleRow
                  label={t("Top Edge Scroll")}
                  checked={bool("topEdgeScrollEnable")}
                  onChange={setBool("topEdgeScrollEnable")}
                />
                <SliderRow
                  label={t("Edge scroll band")}
                  value={num("edgeScrollRingPercent")}
                  min={50}
                  max={90}
                  step={1}
                  unit="%"
                  onChange={setNum("edgeScrollRingPercent")}
                />
                <SliderRow
                  label={t("Scroll Divisor")}
                  value={num("scrollDivisor")}
                  min={1}
                  max={64}
                  onChange={setNum("scrollDivisor")}
                />
              </Card>

              <Card
                icon={<IconArrowsMove size={16} />}
                title={t("Edge Motion")}
                description={t(
                  "Keep the pointer moving while a finger rests at the edge",
                )}
              >
                <ToggleRow
                  label={t("Edge Motion")}
                  checked={bool("edgeMotionEnable")}
                  onChange={setBool("edgeMotionEnable")}
                />
                {bool("edgeMotionEnable") && (
                  <SliderRow
                    label={t("Edge Motion Speed")}
                    value={num("edgeMotionSpeed")}
                    min={1}
                    max={50}
                    onChange={setNum("edgeMotionSpeed")}
                  />
                )}
                <ToggleRow
                  label={t("Sleep Mode")}
                  description={t(
                    "Let the sensor sleep when idle to save power",
                  )}
                  checked={bool("sleepModeEnable")}
                  onChange={setBool("sleepModeEnable")}
                />
              </Card>

              <details className="glass-card group">
                <summary className="flex cursor-pointer list-none items-center justify-between p-6 text-sm font-medium text-[var(--color-text)]">
                  {t("Advanced")}
                  <IconChevronDown
                    size={16}
                    className="transition-transform group-open:rotate-180"
                  />
                </summary>
                <div className="grid grid-cols-1 desktop:grid-cols-2 gap-x-8 gap-y-4 px-6 pb-6">
                  <NumberRow
                    label={t("Max Tap Movement")}
                    value={num("tapMaxMovement")}
                    min={0}
                    max={U16_MAX}
                    onChange={setNum("tapMaxMovement")}
                  />
                  <NumberRow
                    label={t("Click Duration (ms)")}
                    value={num("tapClickMs")}
                    min={0}
                    max={U16_MAX}
                    onChange={setNum("tapClickMs")}
                  />
                  <NumberRow
                    label={t("Max Drag Movement")}
                    value={num("tapDragMaxMovement")}
                    min={0}
                    max={U16_MAX}
                    onChange={setNum("tapDragMaxMovement")}
                  />
                  <div className="space-y-3">
                    <ToggleRow
                      label={t("Auxiliary Tap (middle click)")}
                      checked={bool("auxTapEnable")}
                      onChange={(v) => {
                        // Give the zone a sensible size on first enable so it
                        // is visible on the map and actually fires.
                        const patch: CirqueState = { auxTapEnable: v };
                        if (v) {
                          if (num("auxTapAreaWidth") === 0) {
                            patch.auxTapAreaWidth = Math.round(halfX * 0.45);
                          }
                          if (num("auxTapAreaHeight") === 0) {
                            patch.auxTapAreaHeight = Math.round(halfY * 0.45);
                          }
                        }
                        update(patch);
                      }}
                    />
                    <NumberRow
                      label={t("Auxiliary Tap Area Width")}
                      value={num("auxTapAreaWidth")}
                      min={0}
                      max={U16_MAX}
                      onChange={setNum("auxTapAreaWidth")}
                    />
                    <NumberRow
                      label={t("Auxiliary Tap Area Height")}
                      value={num("auxTapAreaHeight")}
                      min={0}
                      max={U16_MAX}
                      onChange={setNum("auxTapAreaHeight")}
                    />
                  </div>
                  <div className="desktop:col-span-2 rounded-lg border border-[var(--color-border)] p-3 text-xs leading-relaxed text-[var(--color-text-muted)]">
                    <div className="mb-1 font-medium text-[var(--color-text-secondary)]">
                      {t("Firmware calibration (read-only)")}
                    </div>
                    <div>
                      {t("Active range")}: {num("activeRangeXMin")}–
                      {num("activeRangeXMax")} × {num("activeRangeYMin")}–
                      {num("activeRangeYMax")}
                    </div>
                    <div>
                      {t("Wedge centre")}:{" "}
                      {(num("secondaryTapCenterDeg") / 10).toFixed(1)}° ·{" "}
                      {t("Edge band")}: {num("edgeScrollRingPercent")}%
                    </div>
                  </div>
                </div>
              </details>
            </div>
          </div>
        )}
      </div>

      <Dialog.Root
        open={showResetDialog}
        onOpenChange={(open) => {
          if (!open && !isResetting) setShowResetDialog(false);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-md bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] shadow-2xl z-50 p-6">
            <Dialog.Title className="text-base font-medium text-[var(--color-text)] mb-2 flex items-center gap-2">
              <IconAlertTriangle size={18} className="text-red-400" />
              {t("Reset trackpad settings?")}
            </Dialog.Title>
            <Dialog.Description className="text-sm text-[var(--color-text-muted)] mb-5">
              {t(
                "This restores every trackpad setting to the firmware defaults and clears the saved values. This cannot be undone.",
              )}
            </Dialog.Description>
            {error && (
              <p role="alert" className="mb-4 text-sm text-red-400">
                {t(error)}
              </p>
            )}
            <div className="flex gap-3">
              <button
                className="flex-1 btn-ghost border border-[var(--color-border)]"
                onClick={() => setShowResetDialog(false)}
                disabled={isResetting}
              >
                {t("Cancel")}
              </button>
              <button
                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-500 hover:bg-red-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                onClick={() => void handleReset()}
                disabled={isResetting}
              >
                {isResetting && (
                  <IconLoader2 size={16} className="animate-spin" />
                )}
                {t("Reset to defaults")}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

function sourceLabel(source: number, t: (key: string) => string): string {
  // Main hand is the half Studio is connected to (source 0); the off hand is
  // reached over the split relay. These are logical roles, not physical sides.
  return source === 0 ? t("Main hand") : t("Off hand");
}

function SourceSelector({
  sources,
  selectedSource,
  onSelect,
}: {
  sources: TrackpadInfo[];
  selectedSource: number;
  onSelect: (source: number) => void;
}) {
  const { t } = useLanguage();
  return (
    <div
      data-testid="tps43-source-selector"
      role="group"
      aria-label={t("Trackpad source")}
      className="inline-flex overflow-hidden rounded-lg border border-[var(--color-border)]"
    >
      {sources.map((info) => (
        <button
          key={info.source}
          type="button"
          aria-pressed={info.source === selectedSource}
          onClick={() => onSelect(info.source)}
          className={`px-3 py-1 text-xs transition-colors ${
            info.source === selectedSource
              ? "bg-[var(--color-electric)]/15 text-[var(--color-electric)]"
              : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
          }`}
        >
          {sourceLabel(info.source, t)}
        </button>
      ))}
    </div>
  );
}

function Tps43Panel(props: UseTps43Return) {
  const { t } = useLanguage();
  const {
    isAvailable,
    sources,
    selectedSource,
    selectSource,
    hasDiscovered,
    values,
    isLoading,
    isResetting,
    error,
    writeState,
    load,
    update,
    reset,
    refresh,
  } = props;
  // Pointer speed lives on the central's runtime input processor, not on the
  // half that owns the trackpad. The card is absent when that subsystem is.
  const inputProcessor = useRuntimeInputProcessor();
  const [processorId, setProcessorId] = useState<number | null>(null);
  const pointerProcessors = inputProcessor.processors.filter(
    (item) => item.name !== "scroll",
  );
  const processor =
    pointerProcessors.find((item) => item.id === processorId) ??
    pointerProcessors[0];
  const scrollProcessor = inputProcessor.processors.find(
    (item) => item.name === "scroll",
  );
  const hasSpeedCard =
    inputProcessor.isAvailable &&
    (processor !== undefined || scrollProcessor !== undefined);
  const scalePercent =
    processor && processor.scaleDivisor > 0
      ? Math.round((processor.scaleMultiplier / processor.scaleDivisor) * 100)
      : 100;
  // Clamp for display: a firmware scale outside the slider range would
  // otherwise make the input lie about its own value.
  const speedPercent = Math.min(300, Math.max(10, scalePercent));
  const scrollPercent =
    scrollProcessor && scrollProcessor.scaleDivisor > 0
      ? Math.round(
          (scrollProcessor.scaleMultiplier / scrollProcessor.scaleDivisor) *
            100,
        )
      : 100;
  const scrollSpeedPercent = Math.min(300, Math.max(10, scrollPercent));

  // The main-branch firmware has no palm/battery/sensitivity fields; hide the
  // controls instead of showing switches that cannot be applied.
  const supportsPalmReject = values?.palmReject !== undefined;
  const supportsBatterySaver = values?.batterySaver !== undefined;
  const supportsSensitivity = values?.sensitivity !== undefined;

  const num = (key: Tps43NumericKey) => values?.[key] ?? 0;
  const bool = (key: Tps43BooleanKey) => values?.[key] ?? false;
  const setNum = (key: Tps43NumericKey) => (v: number) => update({ [key]: v });
  const setBool = (key: Tps43BooleanKey) => (v: boolean) =>
    update({ [key]: v });

  // A completed discovery with zero answers is a real state: there is no
  // trackpad on either half. It must not look like loading, and Reload must not
  // silently start another 2 s discovery window.
  const noTrackpad =
    isAvailable && hasDiscovered && sources.length === 0 && !error;
  const showActions = isAvailable && !noTrackpad;

  const handleReset = async () => {
    const confirmed = window.confirm(
      t(
        "Reset trackpad settings to firmware defaults? Saved trackpad settings will be cleared and this cannot be undone. Pointer speed is not affected.",
      ),
    );
    if (!confirmed) return;
    await reset();
  };

  return (
    <div className="app-page p-4 sm:p-6 h-full">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4 mb-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="shrink-0 p-2 rounded-lg bg-[var(--color-cyber)]/10 border border-[var(--color-cyber)]/20">
              <IconHandFinger size={24} className="text-[var(--color-cyber)]" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-medium text-[var(--color-text)]">
                {t("Trackpad Settings")}
              </h1>
              <p className="text-sm text-[var(--color-text-muted)]">
                {t(
                  "Changes are applied and saved to the keyboard automatically",
                )}
              </p>
              {isAvailable && sources.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-[var(--color-text-muted)]">
                    {t("Trackpad found on:")}
                  </span>
                  {sources.length > 1 ? (
                    <SourceSelector
                      sources={sources}
                      selectedSource={selectedSource}
                      onSelect={selectSource}
                    />
                  ) : (
                    <span
                      data-testid="tps43-source-chip"
                      className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-0.5 text-xs text-[var(--color-text-secondary)]"
                    >
                      {sourceLabel(selectedSource, t)}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
          {showActions && (
            <div className="flex items-center gap-2">
              {writeState !== "idle" && (
                <span
                  role="status"
                  className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]"
                >
                  <IconLoader2 size={14} className="animate-spin" />
                  {writeState === "queued" ? t("Pending...") : t("Saving...")}
                </span>
              )}
              <ResponsiveButton
                label={t("Reload")}
                className="btn-ghost text-sm flex items-center gap-1.5"
                onClick={() => void load()}
                disabled={isLoading || writeState !== "idle"}
              >
                {isLoading ? (
                  <IconLoader2 size={16} className="animate-spin" />
                ) : (
                  <IconRefresh size={16} />
                )}
              </ResponsiveButton>
              <ResponsiveButton
                label={t("Reset to defaults")}
                className="btn-ghost text-sm flex items-center gap-1.5"
                onClick={() => void handleReset()}
                disabled={!values || isResetting}
              >
                {isResetting ? (
                  <IconLoader2 size={16} className="animate-spin" />
                ) : (
                  <IconRestore size={16} />
                )}
              </ResponsiveButton>
            </div>
          )}
        </div>

        {!isAvailable && (
          <div className="mb-6 p-4 rounded-lg bg-[var(--color-border)] border border-[var(--color-border-hover)] flex items-start gap-3">
            <div className="p-2">
              <IconAlertTriangleFilled size={24} className="text-red-500" />
            </div>
            <p className="text-sm text-[var(--color-text-muted)]">
              {t("Trackpad subsystem is not available for your keyboard.")}
              <br />
              {t("Make sure your firmware has the {{module}} enabled.", {
                module: TPS43_MODULE_NAME,
              })}
              <a
                href={TPS43_MODULE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--color-electric)] underline mx-1"
              >
                {TPS43_MODULE_NAME}
              </a>
            </p>
          </div>
        )}

        {noTrackpad && (
          <section
            data-testid="tps43-no-trackpad"
            aria-labelledby="tps43-no-trackpad-title"
            className="mb-6 p-6 glass-card"
          >
            <div className="flex items-start gap-3">
              <div className="p-2">
                <IconAlertTriangleFilled size={24} className="text-amber-500" />
              </div>
              <div className="min-w-0">
                <h2
                  id="tps43-no-trackpad-title"
                  className="text-sm font-medium text-[var(--color-text)]"
                >
                  {t("No trackpad found")}
                </h2>
                <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                  {t(
                    "The connected keyboard reported no TPS43 trackpad on either half. Check that the trackpad half is powered and connected.",
                  )}
                </p>
                <ResponsiveButton
                  label={t("Search again")}
                  className="btn-ghost mt-3 text-sm flex items-center gap-1.5"
                  onClick={() => void refresh()}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <IconLoader2 size={16} className="animate-spin" />
                  ) : (
                    <IconRefresh size={16} />
                  )}
                </ResponsiveButton>
              </div>
            </div>
          </section>
        )}

        {error && (
          <div
            role="alert"
            className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20"
          >
            <p className="text-sm text-red-400">{t(error)}</p>
          </div>
        )}

        {isAvailable && isLoading && !values && !noTrackpad && (
          <LoadingIndicator
            className="mb-6"
            label={t("Loading trackpad settings...")}
          />
        )}

        {values && !noTrackpad && (
          <div className="grid grid-cols-1 desktop:grid-cols-[minmax(0,1fr)_minmax(360px,440px)] gap-6 items-start">
            <div className="desktop:sticky desktop:top-6">
              <Card
                icon={<IconHandFinger size={16} />}
                title={t("Gesture map")}
                description={t("Static gesture map with a try-it pad")}
              >
                <Tps43GestureMap values={values} />
              </Card>
            </div>

            <div className="space-y-4">
              <Card
                icon={<IconHandClick size={16} />}
                title={t("Gestures")}
                description={t("Tap, hold, scroll and palm rejection")}
              >
                <ToggleRow
                  label={t("Tap to click")}
                  description={t("Left click")}
                  checked={bool("oneFingerTap")}
                  onChange={setBool("oneFingerTap")}
                />
                <ToggleRow
                  label={t("Two-finger tap")}
                  description={t("Right click")}
                  checked={bool("twoFingerTap")}
                  onChange={setBool("twoFingerTap")}
                />
                <ToggleRow
                  label={t("Press and hold")}
                  checked={bool("pressAndHold")}
                  onChange={setBool("pressAndHold")}
                />
                <div>
                  <ChoiceRow
                    label={t("Hold duration")}
                    value={num("pressAndHoldTime")}
                    options={HOLD_DURATION_OPTIONS}
                    onChange={setNum("pressAndHoldTime")}
                  />
                  {!HOLD_DURATION_OPTIONS.some(
                    (option) => option.value === num("pressAndHoldTime"),
                  ) && (
                    <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                      {t("Custom ({{ms}} ms)", {
                        ms: num("pressAndHoldTime"),
                      })}
                    </p>
                  )}
                </div>
                <ToggleRow
                  label={t("Two-finger scroll")}
                  checked={bool("scroll")}
                  onChange={setBool("scroll")}
                />
                {supportsPalmReject && (
                  <ToggleRow
                    label={t("Palm rejection")}
                    description={t("Ignore large or resting contacts")}
                    checked={bool("palmReject")}
                    onChange={setBool("palmReject")}
                  />
                )}
              </Card>

              <Card
                icon={<IconArrowsMove size={16} />}
                title={t("Axes")}
                description={t("Trackpad axes and pointer rotation")}
              >
                <ToggleRow
                  label={t("Switch X/Y")}
                  checked={bool("switchXy")}
                  onChange={setBool("switchXy")}
                />
                <ToggleRow
                  label={t("Flip X")}
                  checked={bool("flipX")}
                  onChange={setBool("flipX")}
                />
                <ToggleRow
                  label={t("Flip Y")}
                  checked={bool("flipY")}
                  onChange={setBool("flipY")}
                />
                {hasSpeedCard && (
                  <SliderRow
                    label={t("Rotation (degrees)")}
                    value={processor.rotationDegrees}
                    min={-180}
                    max={180}
                    step={1}
                    unit="°"
                    onChange={(v) =>
                      void inputProcessor.setRotation(processor.id, v)
                    }
                  />
                )}
              </Card>

              {(supportsBatterySaver || supportsSensitivity) && (
                <Card
                  icon={<IconBolt size={16} />}
                  title={t("Comfort")}
                  description={t("Battery use and pointer sensitivity")}
                >
                  {supportsBatterySaver && (
                    <div>
                      <ChoiceRow
                        label={t("Battery saver")}
                        value={num("batterySaver")}
                        options={BATTERY_SAVER_OPTIONS}
                        onChange={setNum("batterySaver")}
                      />
                      {!BATTERY_SAVER_OPTIONS.some(
                        (option) => option.value === num("batterySaver"),
                      ) && (
                        <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                          {t("Custom ({{value}})", {
                            value: num("batterySaver"),
                          })}
                        </p>
                      )}
                    </div>
                  )}
                  {supportsSensitivity && (
                    <div>
                      <ChoiceRow
                        label={t("Sensitivity")}
                        value={num("sensitivity")}
                        options={SENSITIVITY_OPTIONS}
                        onChange={setNum("sensitivity")}
                      />
                      {!SENSITIVITY_OPTIONS.some(
                        (option) => option.value === num("sensitivity"),
                      ) && (
                        <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                          {t("Custom ({{value}})", {
                            value: num("sensitivity"),
                          })}
                        </p>
                      )}
                    </div>
                  )}
                </Card>
              )}

              <Card
                icon={<IconMouse size={16} />}
                title={t("Pointing")}
                description={t("Natural scrolling")}
              >
                <ToggleRow
                  label={t("Natural scrolling")}
                  description={t("Content moves with your fingers")}
                  checked={bool("naturalScrollX") && bool("naturalScrollY")}
                  onChange={(v) =>
                    update({ naturalScrollX: v, naturalScrollY: v })
                  }
                />
              </Card>

              {hasSpeedCard && (
                <Card
                  icon={<IconBolt size={16} />}
                  title={t("Speed")}
                  description={t("Runtime pointer and scroll speed")}
                >
                  {pointerProcessors.length > 1 && (
                    <label className="flex items-center justify-between gap-4">
                      <span className="text-sm text-[var(--color-text-secondary)]">
                        {t("Pointer processor")}
                      </span>
                      <select
                        aria-label={t("Pointer processor")}
                        value={processor?.id ?? ""}
                        onChange={(event) =>
                          setProcessorId(Number(event.target.value))
                        }
                        className="px-2 py-1 rounded-lg text-sm bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)]"
                      >
                        {pointerProcessors.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  {processor && (
                    <SliderRow
                      label={t("Pointer speed")}
                      value={speedPercent}
                      min={10}
                      max={300}
                      step={5}
                      unit="%"
                      onChange={(v) =>
                        void inputProcessor.setScaling(processor.id, v, 100)
                      }
                    />
                  )}
                  {scrollProcessor && (
                    <SliderRow
                      label={t("Scroll speed")}
                      value={scrollSpeedPercent}
                      min={10}
                      max={300}
                      step={5}
                      unit="%"
                      onChange={(v) =>
                        void inputProcessor.setScaling(
                          scrollProcessor.id,
                          v,
                          100,
                        )
                      }
                    />
                  )}
                </Card>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function TrackpadPage() {
  const cirque = useCirque();
  const tps43 = useTps43();

  // A keyboard advertises at most one of these trackpad subsystems. Prefer the
  // TPS43 (Azoteq IQS5xx); fall back to Cirque, whose panel also renders the
  // "not available" notice when neither subsystem is present.
  if (tps43.isAvailable) {
    return <Tps43Panel {...tps43} />;
  }
  return <CirquePanel {...cirque} />;
}
