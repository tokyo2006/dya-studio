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
  IconRotate,
  IconSettings,
} from "@tabler/icons-react";
import { useLanguage } from "../hooks/useLanguage";
import { useCirque } from "../hooks/useCirque";
import { LoadingIndicator } from "../components/LoadingIndicator";
import { ResponsiveButton } from "../components/ResponsiveButton";
import type { CirqueState } from "../proto/tokyo2006/cirque/cirque";

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

const MODULE_NAME = "tokyo2006/cirque-input-module";
const MODULE_URL = "https://github.com/tokyo2006/cirque-input-module";
const U16_MAX = 65535;
const U32_MAX = 4294967295;

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
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-[var(--color-text-secondary)]">
          {label}
        </span>
        <span className="text-sm font-mono text-[var(--color-electric)]">
          {value}
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

function ChoiceRow<T extends number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <span className="text-sm text-[var(--color-text-secondary)]">
        {label}
      </span>
      <div
        role="radiogroup"
        aria-label={label}
        className="flex rounded-lg border border-[var(--color-border)] overflow-hidden"
      >
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={value === opt.value}
            onClick={() => onChange(opt.value)}
            className={`px-3 py-1.5 text-sm transition-colors ${
              value === opt.value
                ? "bg-[var(--color-electric)] text-white"
                : "bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
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

export function TrackpadPage() {
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
  } = useCirque();
  const [showResetDialog, setShowResetDialog] = useState(false);

  const num = (key: NumericKey) => values?.[key] ?? 0;
  const bool = (key: BooleanKey) => values?.[key] ?? false;
  const setNum = (key: NumericKey) => (v: number) => update({ [key]: v });
  const setBool = (key: BooleanKey) => (v: boolean) => update({ [key]: v });

  const handleReset = async () => {
    if (await reset()) setShowResetDialog(false);
  };

  return (
    <div className="app-page p-4 sm:p-6 h-full">
      <div className="max-w-4xl mx-auto">
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
          <div className="grid grid-cols-1 desktop:grid-cols-2 gap-4">
            <Card
              icon={<IconSettings size={16} />}
              title={t("Basic")}
              description={t("Data mode and sensor sensitivity")}
            >
              <ChoiceRow
                label={t("Data Mode")}
                value={num("dataMode")}
                options={[
                  { value: 0, label: t("Absolute") },
                  { value: 1, label: t("Relative") },
                ]}
                onChange={setNum("dataMode")}
              />
              <ChoiceRow
                label={t("Sensitivity")}
                value={num("sensitivity")}
                options={[
                  { value: 0, label: "1x" },
                  { value: 1, label: "2x" },
                ]}
                onChange={setNum("sensitivity")}
              />
            </Card>

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
              <SliderRow
                label={t("Scroll Speed")}
                value={num("scrollSpeedPosition")}
                min={0}
                max={100}
                onChange={setNum("scrollSpeedPosition")}
              />
            </Card>

            <Card
              icon={<IconRotate size={16} />}
              title={t("Orientation")}
              description={t("Match the trackpad's mounting direction")}
            >
              <ChoiceRow
                label={t("Rotation")}
                value={num("rotateDegrees")}
                options={[0, 90, 180, 270].map((d) => ({
                  value: d,
                  label: `${d}°`,
                }))}
                onChange={setNum("rotateDegrees")}
              />
              <ToggleRow
                label={t("Invert X")}
                checked={bool("invertX")}
                onChange={setBool("invertX")}
              />
              <ToggleRow
                label={t("Invert Y")}
                checked={bool("invertY")}
                onChange={setBool("invertY")}
              />
              <ToggleRow
                label={t("Swap X/Y")}
                checked={bool("swapXy")}
                onChange={setBool("swapXy")}
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
              <ToggleRow
                label={t("Auxiliary Tap (middle click)")}
                checked={bool("auxTapEnable")}
                onChange={setBool("auxTapEnable")}
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
                label={t("Scroll Zone")}
                value={num("scrollZone")}
                min={0}
                max={500}
                step={10}
                onChange={setNum("scrollZone")}
              />
              <SliderRow
                label={t("Scroll Divisor")}
                value={num("scrollDivisor")}
                min={1}
                max={64}
                onChange={setNum("scrollDivisor")}
              />
              <ToggleRow
                label={t("Invert Scroll")}
                checked={bool("invertScroll")}
                onChange={setBool("invertScroll")}
              />
              <ToggleRow
                label={t("Drag Scroll")}
                description={t("Turn pointer movement into scrolling")}
                checked={bool("dragScrollEnabled")}
                onChange={setBool("dragScrollEnabled")}
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
                <>
                  <SliderRow
                    label={t("Edge Zone")}
                    value={num("edgeMotionZone")}
                    min={0}
                    max={500}
                    step={10}
                    onChange={setNum("edgeMotionZone")}
                  />
                  <SliderRow
                    label={t("Edge Motion Speed")}
                    value={num("edgeMotionSpeed")}
                    min={1}
                    max={50}
                    onChange={setNum("edgeMotionSpeed")}
                  />
                </>
              )}
              <ToggleRow
                label={t("Sleep Mode")}
                description={t("Let the sensor sleep when idle to save power")}
                checked={bool("sleepModeEnable")}
                onChange={setBool("sleepModeEnable")}
              />
            </Card>
          </div>
        )}

        {values && (
          <details className="glass-card mt-4 group">
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
              <NumberRow
                label={t("Secondary Tap Area Width")}
                value={num("secondaryTapAreaWidth")}
                min={0}
                max={U16_MAX}
                onChange={setNum("secondaryTapAreaWidth")}
              />
              <NumberRow
                label={t("Secondary Tap Area Height")}
                value={num("secondaryTapAreaHeight")}
                min={0}
                max={U16_MAX}
                onChange={setNum("secondaryTapAreaHeight")}
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
              <NumberRow
                label={t("Edge Motion Interval (ms)")}
                value={num("edgeMotionIntervalMs")}
                min={0}
                max={U16_MAX}
                onChange={setNum("edgeMotionIntervalMs")}
              />
              <NumberRow
                label={t("Edge Motion Start Delay (ms)")}
                value={num("edgeMotionStartMs")}
                min={0}
                max={U16_MAX}
                onChange={setNum("edgeMotionStartMs")}
              />
              <NumberRow
                label={t("Relative Multiplier")}
                value={num("relativeMultiplier")}
                min={1}
                max={U32_MAX}
                onChange={setNum("relativeMultiplier")}
              />
              <NumberRow
                label={t("Relative Divisor")}
                value={num("relativeDivisor")}
                min={1}
                max={U32_MAX}
                onChange={setNum("relativeDivisor")}
              />
              <NumberRow
                label={t("Absolute Multiplier")}
                value={num("absoluteRelativeMultiplier")}
                min={1}
                max={U16_MAX}
                onChange={setNum("absoluteRelativeMultiplier")}
              />
              <NumberRow
                label={t("Absolute Divisor")}
                value={num("absoluteRelativeDivisor")}
                min={1}
                max={U16_MAX}
                onChange={setNum("absoluteRelativeDivisor")}
              />
            </div>
          </details>
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
