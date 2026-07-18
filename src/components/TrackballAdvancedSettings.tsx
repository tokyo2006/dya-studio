import { useEffect, useMemo, useState } from "react";
import {
  IconChevronDown,
  IconChevronRight,
  IconRefresh,
} from "@tabler/icons-react";
import {
  CustomSettingsSectionCard,
  PMW3610_CUSTOM_SETTINGS_IDENTIFIER,
} from "./AdvancedSettingsSection";
import { LoadingIndicator } from "./LoadingIndicator";
import { useCustomSettings } from "../hooks/useCustomSettings";
import { useKeymap } from "../hooks/useKeymap";
import { useLanguage } from "../hooks/useLanguage";

// Frame capture/streaming lives in a separate, dedicated RPC subsystem and
// is intentionally not surfaced here.

export function TrackballAdvancedSettings() {
  const { t } = useLanguage();
  const [isExpanded, setIsExpanded] = useState(false);
  // Latch true once the section is first opened and stay true (a collapsed
  // reopen shouldn't re-fetch).
  const [hasExpanded, setHasExpanded] = useState(false);
  // Defer loading the PMW3610 settings until the section is first expanded so
  // opening the Trackball tab doesn't trigger the custom-settings RPC. Scope
  // the list to the pmw3610 subsystem so unrelated custom subsystems aren't
  // fetched or listed here.
  const customSettings = useCustomSettings({
    autoLoad: false,
    subsystemIdentifier: PMW3610_CUSTOM_SETTINGS_IDENTIFIER,
  });
  const { keymap, behaviors, isLoading: keymapLoading } = useKeymap();

  const handleToggle = () => {
    setIsExpanded((expanded) => !expanded);
    setHasExpanded(true);
  };

  // Once expanded, load reactively — mirroring the hook's default auto-load —
  // so a not-yet-ready subsystem still loads once it becomes ready.
  const { loadSettings } = customSettings;
  useEffect(() => {
    if (hasExpanded) {
      void loadSettings();
    }
  }, [hasExpanded, loadSettings]);

  const layers = useMemo(
    () =>
      keymap?.layers.map((layer) => ({
        id: layer.id,
        name: layer.name || t("Layer {{id}}", { id: layer.id }),
      })) ?? [],
    [keymap?.layers, t],
  );

  const pmw3610Sections = useMemo(
    () =>
      customSettings.sections.filter(
        (section) => section.identifier === PMW3610_CUSTOM_SETTINGS_IDENTIFIER,
      ),
    [customSettings.sections],
  );

  const isSubsystemAvailable =
    !customSettings.isLoading && pmw3610Sections.length > 0;

  return (
    <div className="glass-card overflow-hidden">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 p-6 text-left"
        onClick={handleToggle}
        aria-expanded={isExpanded}
      >
        <div>
          <h3 className="text-sm font-medium text-[var(--color-text)]">
            {t("Advanced (PMW3610 Sensor Driver)")}
          </h3>
          <p className="text-xs text-[var(--color-text-muted)]">
            {t(
              "Sensor-level tuning exposed by the pmw3610 driver's custom Studio RPC",
            )}
          </p>
        </div>
        {isExpanded ? (
          <IconChevronDown
            size={20}
            className="flex-shrink-0 text-[var(--color-text-muted)]"
          />
        ) : (
          <IconChevronRight
            size={20}
            className="flex-shrink-0 text-[var(--color-text-muted)]"
          />
        )}
      </button>

      {isExpanded && (
        <div className="space-y-4 border-t border-[var(--color-border)] p-6 pt-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-[var(--color-text-muted)]">
              {t(
                "Changes are written to keyboard memory after a short delay. Save a section to persist them.",
              )}
            </p>
            <button
              type="button"
              className="btn-ghost flex flex-shrink-0 items-center gap-2 border border-[var(--color-border)] text-sm"
              onClick={customSettings.loadSettings}
              disabled={customSettings.isLoading}
            >
              <IconRefresh size={16} />
              {t("Reload")}
            </button>
          </div>

          {!customSettings.isAvailable ? (
            <p className="text-sm text-[var(--color-text-muted)]">
              {t(
                "Custom settings subsystem is not available for this keyboard.",
              )}
            </p>
          ) : customSettings.isLoading && pmw3610Sections.length === 0 ? (
            <LoadingIndicator
              variant="inline"
              label={t("Loading advanced settings...")}
            />
          ) : !isSubsystemAvailable ? (
            <p className="text-sm text-[var(--color-text-muted)]">
              {t("No pmw3610 driver settings were reported by the keyboard.")}
              <br />
              {t("Make sure your firmware has the {{module}} enabled.", {
                module: "cormoran/zmk-driver-pmw3610-with-custom-studio-rpc",
              })}
              <a
                href="https://github.com/cormoran/zmk-driver-pmw3610-with-custom-studio-rpc"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--color-electric)] underline mx-1"
              >
                cormoran/zmk-driver-pmw3610-with-custom-studio-rpc
              </a>
            </p>
          ) : (
            <div className="space-y-6">
              {pmw3610Sections.map((section) => (
                <CustomSettingsSectionCard
                  key={section.customSubsystemIndex}
                  section={section}
                  layers={layers}
                  behaviors={behaviors}
                  customSettings={customSettings}
                  keymapLoading={keymapLoading}
                />
              ))}
            </div>
          )}

          {customSettings.error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3">
              <p className="text-sm text-red-400">{t(customSettings.error)}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
