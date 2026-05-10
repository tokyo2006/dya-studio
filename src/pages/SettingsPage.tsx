import { useTranslation } from "react-i18next";
import { useState, useMemo, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  IconSettings,
  IconChevronDown,
  IconAlertTriangleFilled,
  IconWorld,
} from "@tabler/icons-react";
import { useSettings } from "../hooks/useSettings";

function msToMinutes(ms: number): number {
  return ms / 60000;
}

function minutesToMs(minutes: number): number {
  return minutes * 60000;
}

const IDLE_PRESETS = [
  { value: 0, label: "never" },
  { value: 0.5, label: "seconds30" },
  { value: 1, label: "minute1" },
  { value: 5, label: "minutes5" },
  { value: 10, label: "minutes10" },
  { value: 30, label: "minutes30" },
];

const SLEEP_PRESETS = [
  { value: 0, label: "never" },
  { value: 5, label: "minutes5" },
  { value: 10, label: "minutes10" },
  { value: 15, label: "minutes15" },
  { value: 30, label: "minutes30" },
  { value: 60, label: "hour1" },
  { value: 120, label: "hours2" },
  { value: 240, label: "hours4" },
];

interface TimeDropdownProps {
  value: number;
  onChange: (ms: number) => void;
  presets: { value: number; label: string }[];
}

function TimeDropdown({ value, onChange, presets }: TimeDropdownProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [customInput, setCustomInput] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const valueInMinutes = msToMinutes(value);
  const matchingPreset = presets.find((p) => p.value === valueInMinutes);
  const displayText = matchingPreset ? t(`settings.${matchingPreset.label}`) : `${valueInMinutes} ${t("settings.min")}`;

  // Update dropdown position when opened
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      // Align dropdown to the right edge of the button
      // Dropdown width is 192px (w-48)
      setDropdownPosition({
        top: rect.bottom + 4,
        left: rect.right - 192, // 192px = w-48
      });
    }
  }, [isOpen]);

  // Handle clicks outside dropdown
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      // Check if click is outside both button and dropdown
      if (
        buttonRef.current &&
        !buttonRef.current.contains(target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
      ) {
        if (showCustomInput) {
          setShowCustomInput(false);
          setCustomInput("");
        } else {
          setIsOpen(false);
        }
      }
    };

    // Use capture phase to ensure we catch the event before other handlers
    document.addEventListener("mousedown", handleClickOutside, true);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside, true);
    };
  }, [isOpen, showCustomInput]);

  const handlePresetSelect = (minutes: number) => {
    onChange(minutesToMs(minutes));
    setIsOpen(false);
    setShowCustomInput(false);
  };

  const handleCustomSubmit = () => {
    const minutes = parseFloat(customInput);
    if (!isNaN(minutes) && minutes >= 0) {
      onChange(minutesToMs(minutes));
      setShowCustomInput(false);
      setIsOpen(false);
      setCustomInput("");
    }
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        className="input-field w-40 text-sm flex items-center justify-between"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>{displayText}</span>
        <IconChevronDown size={16} className="text-[var(--color-text-muted)]" />
      </button>

      {isOpen &&
        createPortal(
          <div
            ref={dropdownRef}
            className="fixed w-48 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-lg z-[9999] py-1"
            style={{
              top: `${dropdownPosition.top}px`,
              left: `${dropdownPosition.left}px`,
            }}
          >
            {presets.map((preset) => (
              <button
                key={preset.value}
                type="button"
                className={`w-full px-4 py-2 text-left text-sm hover:bg-[var(--color-border)] transition-colors ${
                  preset.value === valueInMinutes
                    ? "text-[var(--color-electric)]"
                    : "text-[var(--color-text-secondary)]"
                }`}
                onClick={() => handlePresetSelect(preset.value)}
              >
                {preset.label}
              </button>
            ))}
            <div className="border-t border-[var(--color-border)] mt-1 pt-1">
              {!showCustomInput ? (
                <button
                  type="button"
                  className="w-full px-4 py-2 text-left text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-border)] transition-colors"
                  onClick={() => setShowCustomInput(true)}
                >
                  {t("settings.customValue")}
                </button>
              ) : (
                <div className="px-4 py-2 space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      className="input-field w-20 text-sm text-center"
                      placeholder="0"
                      value={customInput}
                      onChange={(e) => setCustomInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleCustomSubmit();
                        }
                      }}
                      autoFocus
                    />
                    <span className="text-xs text-[var(--color-text-muted)]">
                      min
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="flex-1 px-2 py-1 text-xs rounded bg-[var(--color-electric)] text-[var(--color-bg)] hover:bg-[var(--color-electric)]/80"
                      onClick={handleCustomSubmit}
                    >
                      Set
                    </button>
                    <button
                      type="button"
                      className="flex-1 px-2 py-1 text-xs rounded border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]"
                      onClick={() => {
                        setShowCustomInput(false);
                        setCustomInput("");
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

export function SettingsPage() {
  const { t, i18n } = useTranslation();
  const { isAvailable, devices, isLoading, error, setActivitySettings } =
    useSettings();
  // Track if user has edited the form
  const [hasEdits, setHasEdits] = useState(false);
  const [editedIdleTimeout, setEditedIdleTimeout] = useState<number>(0);
  const [editedSleepTimeout, setEditedSleepTimeout] = useState<number>(0);

  // Get central device settings (source 0)
  const centralSettings = useMemo(
    () => devices.find((d) => d.sourceId === 0),
    [devices],
  );

  // Display values: use edited values if user has made changes, otherwise use central settings
  const idleTimeout = hasEdits
    ? editedIdleTimeout
    : (centralSettings?.idleMs ?? 0);
  const sleepTimeout = hasEdits
    ? editedSleepTimeout
    : (centralSettings?.sleepMs ?? 0);

  const handleIdleChange = (ms: number) => {
    setHasEdits(true);
    setEditedIdleTimeout(ms);
    setEditedSleepTimeout(sleepTimeout); // Keep sleep timeout unchanged
  };

  const handleSleepChange = (ms: number) => {
    setHasEdits(true);
    setEditedSleepTimeout(ms);
    setEditedIdleTimeout(idleTimeout); // Keep idle timeout unchanged
  };

  const handleSaveSettings = async () => {
    await setActivitySettings(idleTimeout, sleepTimeout);
    setHasEdits(false);
  };

  return (
    <div className="p-6 h-full overflow-auto">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2 rounded-lg bg-[var(--color-electric)]/10 border border-[var(--color-electric)]/20">
            <IconSettings size={24} className="text-[var(--color-electric)]" />
          </div>
          <div>
            <h1 className="text-xl font-medium text-[var(--color-text)]">
              {t("settings.title")}
            </h1>
            <p className="text-sm text-[var(--color-text-muted)]">
              {t("settings.description")}
            </p>
          </div>
        </div>

        <div className="mb-6 flex items-center justify-end">
          <div className="flex items-center gap-2">
            <IconWorld size={18} className="text-[var(--color-text-muted)]" />
            <select
              className="input-field text-sm py-1.5 pr-8"
              value={i18n.language}
              onChange={(e) => i18n.changeLanguage(e.target.value)}
            >
              <option value="zh">中文</option>
              <option value="en">English</option>
            </select>
          </div>
        </div>

        {!isAvailable && !isLoading && !error && (
          <div className="mb-6 p-4 rounded-lg bg-[var(--color-border)] border border-[var(--color-border-hover)] flex items-start gap-3">
            <div className="p-2">
              <IconAlertTriangleFilled size={24} className="text-red-500" />
            </div>
            <p className="text-sm text-[var(--color-text-muted)]">
              {t("settings.settingsNotAvailable")}
              <br />
              {t("settings.makeSureFirmwareHas")}{" "}
              <a
                href="https://github.com/cormoran/zmk-module-settings-rpc"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--color-electric)] underline mx-1"
              >
                cormoran/zmk-module-settings-rpc
              </a>
              {t("battery.enabled")}
            </p>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/30">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Loading State */}
        {isLoading && !centralSettings && (
          <div className="glass-card p-6">
            <p className="text-sm text-[var(--color-text-muted)]">
              {t("settings.loadingSettings")}
            </p>
          </div>
        )}

        {/* Settings Groups */}
        {centralSettings ? (
          <div className="space-y-6">
            {/* Power Management */}
            <div className="glass-card p-6">
              <h3 className="text-sm font-medium text-[var(--color-text)] mb-4">
                {t("settings.powerManagement")}
              </h3>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      {t("settings.idleTimeout")}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      {t("settings.idleTimeoutDescription")}
                    </p>
                  </div>
                  <TimeDropdown
                    value={idleTimeout}
                    onChange={handleIdleChange}
                    presets={IDLE_PRESETS}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      {t("settings.sleepTimeout")}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      {t("settings.sleepTimeoutDescription")}
                    </p>
                  </div>
                  <TimeDropdown
                    value={sleepTimeout}
                    onChange={handleSleepChange}
                    presets={SLEEP_PRESETS}
                  />
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    className="btn-electric text-sm"
                    onClick={handleSaveSettings}
                    disabled={isLoading}
                  >
                    {isLoading ? t("settings.saving") : t("settings.applyToAllDevices")}
                  </button>
                </div>
              </div>

              {/* Show all devices status - moved after inputs */}
              {devices.length > 0 && (
                <div className="mt-6 p-4 rounded-lg bg-[var(--color-border)]">
                  <p className="text-xs font-medium text-[var(--color-text-muted)] mb-2">
                    {t("settings.currentSettingsByDevice")}
                  </p>
                  <div className="space-y-1">
                    {devices.map((device) => (
                      <div
                        key={device.sourceId}
                        className="text-xs text-[var(--color-text-secondary)]"
                      >
                        <span className="font-mono">{device.deviceName}:</span>{" "}
                        Idle: {device.idleMs === 0 ? t("settings.never") : `${msToMinutes(device.idleMs)} ${t("settings.min")}`}, Sleep:{" "}
                        {device.sleepMs === 0 ? t("settings.never") : `${msToMinutes(device.sleepMs)} ${t("settings.min")}`}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Danger Zone
            <div className="glass-card p-6 border-red-500/20">
              <h3 className="text-sm font-medium text-red-400 mb-4">
                Danger Zone
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      Reset to Defaults
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      Restore power settings to factory defaults (Idle: 30s,
                      Sleep: 15m)
                    </p>
                  </div>
                  {!showResetConfirm ? (
                    <button
                      className="px-4 py-2 rounded-lg text-sm font-medium text-red-400 border border-red-500/30 hover:bg-red-500/10 transition-colors"
                      onClick={() => setShowResetConfirm(true)}
                      disabled={isLoading}
                    >
                      Reset
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:bg-[var(--color-border)] transition-colors"
                        onClick={() => setShowResetConfirm(false)}
                      >
                        Cancel
                      </button>
                      <button
                        className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-500 hover:bg-red-600 transition-colors flex items-center gap-2"
                        onClick={handleResetToDefaults}
                        disabled={isLoading}
                      >
                        <IconAlertTriangle size={16} />
                        {isLoading ? "Resetting..." : "Confirm Reset"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div> */}
          </div>
        ) : (
          !isLoading && (
            <div className="glass-card p-6">
              <p className="text-sm text-[var(--color-text-muted)]">
                Waiting for device connection...
              </p>
            </div>
          )
        )}
      </div>
    </div>
  );
}
