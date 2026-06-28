import { useState, useContext } from "react";
import {
  IconBluetooth,
  IconLink,
  IconLinkOff,
  IconEdit,
  IconCheck,
  IconX,
  IconUsb,
  IconRefresh,
  IconAlertTriangle,
  IconAlertTriangleFilled,
} from "@tabler/icons-react";
import { useBLEProfiles } from "../hooks/useBLEProfiles";
import { ConnectionContext } from "../components/DeviceConnection";
import { OutputPriority } from "../proto/zmk/ble_management/ble_management";
import { useLanguage } from "../hooks/useLanguage";

export function BLEConnectionsPage() {
  const { t } = useLanguage();
  const connection = useContext(ConnectionContext);
  const {
    isAvailable,
    profiles,
    isLoading,
    error,
    outputPriority,
    switchProfile,
    unpairProfile,
    setProfileName,
    loadProfiles,
    getOutputPriority,
    setOutputPriority,
  } = useBLEProfiles();

  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [showOutputPriorityWarning, setShowOutputPriorityWarning] =
    useState(false);
  const [pendingOutputPriority, setPendingOutputPriority] =
    useState<OutputPriority | null>(null);

  const startEditing = (index: number, currentName: string) => {
    setEditingIndex(index);
    setEditName(currentName);
  };

  const cancelEditing = () => {
    setEditingIndex(null);
    setEditName("");
  };

  const saveProfileName = async (index: number) => {
    await setProfileName(index, editName);
    setEditingIndex(null);
    setEditName("");
  };

  const handleUnpair = async (index: number) => {
    if (confirm(t("Are you sure you want to unpair this device?"))) {
      await unpairProfile(index);
    }
  };

  const handleSwitch = async (index: number) => {
    await switchProfile(index);
  };

  const handleOutputPriorityChange = (priority: OutputPriority) => {
    setPendingOutputPriority(priority);
    setShowOutputPriorityWarning(true);
  };

  const confirmOutputPriorityChange = async () => {
    if (pendingOutputPriority !== null) {
      await setOutputPriority(pendingOutputPriority);
      setShowOutputPriorityWarning(false);
      setPendingOutputPriority(null);
    }
  };

  const cancelOutputPriorityChange = () => {
    setShowOutputPriorityWarning(false);
    setPendingOutputPriority(null);
  };

  const reload = () => {
    loadProfiles();
    getOutputPriority();
  };

  return (
    <div className="p-6 h-full overflow-auto">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex flex-col tablet:flex-row tablet:items-center gap-3 mb-8">
          <div className="flex items-center gap-3 flex-1">
            <div className="p-2 rounded-lg bg-[var(--color-cyber)]/10 border border-[var(--color-cyber)]/20">
              <IconBluetooth size={24} className="text-[var(--color-cyber)]" />
            </div>
            <div className="flex-1">
              <h1 className="text-xl font-medium text-[var(--color-text)]">
                {t("BLE Connections")}
              </h1>
              <p className="text-sm text-[var(--color-text-muted)]">
                {t("Manage Bluetooth upstream connections")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            {/* Refresh Button */}
            {profiles.length > 0 && (
              <button
                className="btn-ghost flex items-center gap-2"
                onClick={reload}
                disabled={isLoading}
                aria-label={t("Refresh profiles")}
              >
                <IconRefresh
                  size={16}
                  className={isLoading ? "animate-spin" : ""}
                />
                {t("Refresh")}
              </button>
            )}
          </div>
        </div>

        {!isAvailable && !isLoading && !error && (
          <div className="mb-6 p-4 rounded-lg bg-[var(--color-border)] border border-[var(--color-border-hover)] flex items-start gap-3">
            <div className="p-2">
              <IconAlertTriangleFilled size={24} className="text-red-500" />
            </div>
            <p className="text-sm text-[var(--color-text-muted)]">
              {t(
                "BLE management subsystem is not available for your keyboard.",
              )}
              <br />
              {t("Make sure your firmware has the {{module}} enabled.", {
                module: "cormoran/zmk-module-ble-management",
              })}
              <a
                href="https://github.com/cormoran/zmk-module-ble-management"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--color-electric)] underline mx-1"
              >
                cormoran/zmk-module-ble-management
              </a>
            </p>
          </div>
        )}

        {/* Show error if any */}
        {error && (
          <div className="glass-card p-4 mb-4 border-red-500/20 bg-red-500/10">
            <p className="text-sm text-red-400">⚠️ {error}</p>
          </div>
        )}

        {/* Output Priority Section */}
        {isAvailable && connection.isConnected && (
          <div className="glass-card p-4 mb-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-sm font-medium text-[var(--color-text)]">
                    {t("Output Priority")}
                  </h3>
                </div>
                <p className="text-xs text-[var(--color-text-muted)]">
                  {t("Prioritized connection for keystrokes")}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${
                    outputPriority === OutputPriority.OUTPUT_PRIORITY_USB
                      ? "bg-[var(--color-electric)]/20 border border-[var(--color-electric)]/40"
                      : "bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-border-hover)]"
                  }`}
                  onClick={() =>
                    handleOutputPriorityChange(
                      OutputPriority.OUTPUT_PRIORITY_USB,
                    )
                  }
                  disabled={isLoading}
                >
                  <IconUsb
                    size={16}
                    className={
                      outputPriority === OutputPriority.OUTPUT_PRIORITY_USB
                        ? "text-[var(--color-electric)]"
                        : "text-[var(--color-text-muted)]"
                    }
                  />
                  <span
                    className={`text-sm ${
                      outputPriority === OutputPriority.OUTPUT_PRIORITY_USB
                        ? "text-[var(--color-electric)] font-medium"
                        : "text-[var(--color-text-secondary)]"
                    }`}
                  >
                    USB
                  </span>
                  {outputPriority === OutputPriority.OUTPUT_PRIORITY_USB && (
                    <IconCheck size={14} className="text-[var(--color-neon)]" />
                  )}
                </button>
                <button
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${
                    outputPriority === OutputPriority.OUTPUT_PRIORITY_BLE
                      ? "bg-[var(--color-cyber)]/20 border border-[var(--color-cyber)]/40"
                      : "bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-border-hover)]"
                  }`}
                  onClick={() =>
                    handleOutputPriorityChange(
                      OutputPriority.OUTPUT_PRIORITY_BLE,
                    )
                  }
                  disabled={isLoading}
                >
                  <IconBluetooth
                    size={16}
                    className={
                      outputPriority === OutputPriority.OUTPUT_PRIORITY_BLE
                        ? "text-[var(--color-cyber)]"
                        : "text-[var(--color-text-muted)]"
                    }
                  />
                  <span
                    className={`text-sm ${
                      outputPriority === OutputPriority.OUTPUT_PRIORITY_BLE
                        ? "text-[var(--color-cyber)] font-medium"
                        : "text-[var(--color-text-secondary)]"
                    }`}
                  >
                    BLE
                  </span>
                  {outputPriority === OutputPriority.OUTPUT_PRIORITY_BLE && (
                    <IconCheck size={14} className="text-[var(--color-neon)]" />
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Connection Slots */}
        {isAvailable && connection.isConnected && (
          <>
            {isLoading && profiles.length === 0 && (
              <div className="glass-card p-6 text-center">
                <p className="text-sm text-[var(--color-text-muted)]">
                  ⏳ {t("Loading profiles...")}
                </p>
              </div>
            )}

            <div className="space-y-4">
              {profiles.map((profile) => (
                <div
                  key={profile.index}
                  className={`glass-card p-4 flex items-center justify-between ${
                    profile.isActive
                      ? "border-[var(--color-cyber)]/40 bg-[var(--color-cyber)]/5"
                      : ""
                  }`}
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        profile.isActive
                          ? "bg-[var(--color-cyber)]/20 border border-[var(--color-cyber)]/40"
                          : "bg-[var(--color-border)] border border-[var(--color-border-hover)]"
                      }`}
                    >
                      <span
                        className={`text-sm font-mono ${
                          profile.isActive
                            ? "text-[var(--color-cyber)]"
                            : "text-[var(--color-text-muted)]"
                        }`}
                      >
                        {profile.index}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      {editingIndex === profile.index ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            placeholder={t("Device name")}
                            maxLength={31} // ZMK firmware constraint for BLE name storage
                            className="input-field flex-1 tablet:text-sm text-base"
                            disabled={isLoading}
                          />
                          <button
                            className="btn-ghost p-2"
                            onClick={() => saveProfileName(profile.index)}
                            disabled={isLoading}
                            aria-label={t("Save name")}
                          >
                            <IconCheck size={16} />
                          </button>
                          <button
                            className="btn-ghost p-2"
                            onClick={cancelEditing}
                            disabled={isLoading}
                            aria-label={t("Cancel editing")}
                          >
                            <IconX size={16} />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2">
                            <p
                              className="text-sm font-medium text-[var(--color-text-secondary)] truncate max-w-[12rem]"
                              title={
                                profile.name ||
                                t("Profile {{index}}", {
                                  index: profile.index,
                                })
                              }
                            >
                              {profile.name ||
                                t("Profile {{index}}", {
                                  index: profile.index,
                                })}
                            </p>
                            {!profile.isOpen && (
                              <button
                                className="btn-ghost p-1 opacity-50 hover:opacity-100"
                                onClick={() =>
                                  startEditing(profile.index, profile.name)
                                }
                                disabled={isLoading}
                                aria-label={t("Edit name")}
                              >
                                <IconEdit size={14} />
                              </button>
                            )}
                          </div>
                          <div className="flex flex-wrap">
                            {profile.isOpen ? (
                              <p className="text-xs text-[var(--color-text-muted)] truncate">
                                {t("Not paired")}
                              </p>
                            ) : profile.isConnected ? (
                              <>
                                <span className="text-xs text-[var(--color-text-muted)] pr-1">
                                  {t("Connected")}
                                </span>
                                {profile.address && (
                                  <span className="text-xs text-[var(--color-text-muted)] block tablet:inline truncate">
                                    {profile.address}
                                  </span>
                                )}
                              </>
                            ) : (
                              <p className="text-xs text-[var(--color-text-muted)] truncate">
                                {profile.address || t("No address")}
                              </p>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  {editingIndex != profile.index && (
                    <div className="flex items-center gap-2">
                      {!profile.isOpen && (
                        <button
                          className="btn-ghost text-sm flex items-center gap-1.5 text-red-400 hover:text-red-300"
                          onClick={() => handleUnpair(profile.index)}
                          disabled={isLoading}
                        >
                          <IconLinkOff size={16} />
                          <span className="hidden tablet:inline">
                            {t("Unpair")}
                          </span>
                        </button>
                      )}
                      {!profile.isActive ? (
                        <button
                          className="btn-ghost text-sm flex items-center gap-1.5"
                          onClick={() => handleSwitch(profile.index)}
                          disabled={isLoading}
                        >
                          <IconLink size={16} />
                          <span className="hidden tablet:inline">
                            {t("Switch")}
                          </span>
                        </button>
                      ) : (
                        <button
                          className="btn-ghost text-sm flex items-center gap-1.5"
                          disabled
                          aria-disabled="true"
                          tabIndex={-1}
                        >
                          <IconLink
                            size={16}
                            className="text-[var(--color-cyber)]"
                          />
                          <span className="hidden tablet:inline text-[var(--color-cyber)] font-semibold">
                            {t("Active")}
                          </span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {/* Output Priority Warning Dialog */}
        {showOutputPriorityWarning && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="glass-card p-6 max-w-md mx-4 border-yellow-500/20 bg-[var(--color-surface)]">
              <div className="flex items-start gap-3 mb-4">
                <IconAlertTriangle
                  size={24}
                  className="text-yellow-500 flex-shrink-0 mt-0.5"
                />
                <div>
                  <h3 className="text-lg font-medium text-[var(--color-text)] mb-2">
                    {t("Change Output Priority?")}
                  </h3>
                  <p className="text-sm text-[var(--color-text-secondary)] mb-2">
                    {t(
                      "Changing the output priority may disconnect DYA Studio from your keyboard.",
                    )}
                  </p>
                  <p className="text-sm text-[var(--color-text-muted)]">
                    {t("You will need to reconnect manually after the change.")}
                  </p>
                </div>
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  className="btn-ghost text-sm px-4 py-2"
                  onClick={cancelOutputPriorityChange}
                  disabled={isLoading}
                >
                  {t("Cancel")}
                </button>
                <button
                  className="btn-electric text-sm px-4 py-2"
                  onClick={confirmOutputPriorityChange}
                  disabled={isLoading}
                >
                  {t("Continue")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
