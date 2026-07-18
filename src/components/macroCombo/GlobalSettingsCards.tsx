/**
 * Right-column cards of the Macro&Combo page showing the macro / combo global
 * settings (opened from the gear button on the corresponding list card).
 * Fields with pending (unsaved-to-flash) changes carry a green StatusDot.
 */
import { IconSettings } from "@tabler/icons-react";
import * as Switch from "@radix-ui/react-switch";
import { StatusDot } from "../EditStatusIndicator";
import { useLanguage } from "../../hooks/useLanguage";
import { RetainedInput } from "./RetainedInput";
import type { UseRuntimeMacroReturn } from "../../hooks/useRuntimeMacro";
import type { UseRuntimeComboReturn } from "../../hooks/useRuntimeCombo";
import { DEFAULT_TIMEOUT_MS } from "./comboUtils";
import type { MacroEditorController } from "./useMacroEditor";
import type { ComboEditorController } from "./useComboEditor";

interface MacroGlobalSettingsCardProps {
  macro: MacroEditorController;
  runtimeMacro: UseRuntimeMacroReturn;
}

export function MacroGlobalSettingsCard({
  macro,
  runtimeMacro,
}: MacroGlobalSettingsCardProps) {
  const { t } = useLanguage();

  return (
    <section className="glass-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <IconSettings
          size={16}
          className="text-[var(--color-electric)] flex-shrink-0"
        />
        <h2 className="text-sm font-medium text-[var(--color-text)]">
          {t("Macro Global Settings")}
        </h2>
      </div>
      <div className="space-y-3">
        <p className="text-xs text-[var(--color-text-muted)]">
          {t(
            "Changes are written to keyboard memory after a short delay. Save a section to persist them.",
          )}
        </p>
        <label className="block">
          <span className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
            {t("Tap ms")}
            {macro.globalModifiedFields.has("tapMs") && (
              <StatusDot status="unsaved" />
            )}
          </span>
          <input
            type="number"
            min={0}
            max={10000}
            className="mt-1 w-full px-3 py-2 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text)] focus:outline-none focus:border-[var(--color-electric)]/50"
            value={macro.tapMsDraft}
            onChange={(event) =>
              macro.handleTapMsChange(Number(event.target.value))
            }
            onBlur={() => void macro.tapMsDebounce.flush()}
          />
        </label>
        {runtimeMacro.globalSettings &&
          runtimeMacro.globalSettings.poolBytesTotal > 0 && (
            <p
              className={`text-xs ${
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
    </section>
  );
}

interface ComboGlobalSettingsCardProps {
  combo: ComboEditorController;
  runtimeCombo: UseRuntimeComboReturn;
}

export function ComboGlobalSettingsCard({
  combo,
  runtimeCombo,
}: ComboGlobalSettingsCardProps) {
  const { t } = useLanguage();

  const displayTimeoutMs =
    runtimeCombo.globalSettings?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const displaySlowRelease = runtimeCombo.globalSettings?.slowRelease ?? false;
  const displayRequirePriorIdleMs =
    runtimeCombo.globalSettings?.requirePriorIdleMs ?? 0;

  return (
    <section className="glass-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <IconSettings
          size={16}
          className="text-[var(--color-electric)] flex-shrink-0"
        />
        <h2 className="text-sm font-medium text-[var(--color-text)]">
          {t("Combo Global Settings")}
        </h2>
      </div>
      <div className="space-y-3">
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
            value={combo.maxCombo ?? ""}
            readOnly
          />
        </label>
        <label className="block">
          <span className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
            {t("Timeout ms")}
            {combo.globalModifiedFields.has("timeoutMs") && (
              <StatusDot status="unsaved" />
            )}
          </span>
          <RetainedInput
            type="number"
            min={1}
            max={65535}
            className="mt-1 w-full px-3 py-2 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text)]"
            value={String(displayTimeoutMs)}
            onChange={combo.handleTimeoutMsChange}
          />
        </label>
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 text-sm text-[var(--color-text)]">
            {t("Slow release")}
            {combo.globalModifiedFields.has("slowRelease") && (
              <StatusDot status="unsaved" />
            )}
          </span>
          <Switch.Root
            checked={displaySlowRelease}
            onCheckedChange={combo.handleSlowReleaseChange}
            className="w-10 h-5 rounded-full relative data-[state=checked]:bg-[var(--color-electric)] bg-[var(--color-border)] border border-[var(--color-border)] transition-colors"
          >
            <Switch.Thumb className="block w-4 h-4 rounded-full transition-transform data-[state=checked]:translate-x-5 translate-x-0.5 will-change-transform bg-white border border-[var(--color-border)]" />
          </Switch.Root>
        </div>
        <label className="block">
          <span className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
            {t("Require prior idle ms (0 disables)")}
            {combo.globalModifiedFields.has("requirePriorIdleMs") && (
              <StatusDot status="unsaved" />
            )}
          </span>
          <RetainedInput
            type="number"
            min={0}
            max={65535}
            className="mt-1 w-full px-3 py-2 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text)]"
            value={String(displayRequirePriorIdleMs)}
            onChange={combo.handleRequirePriorIdleMsChange}
          />
        </label>
      </div>
    </section>
  );
}
