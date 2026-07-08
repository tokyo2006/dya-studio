import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  ZMKAppContext,
  useCustomSubsystem,
} from "@cormoran/zmk-studio-react-hook";
import {
  Notification,
  Request,
  Response,
  SettingNotificationKind,
  SettingWriteMode,
  type Setting,
  type SettingScope,
  type SettingValue,
} from "../proto/cormoran/zmk/custom_settings/custom_settings";
import { useLanguage } from "./useLanguage";

export const CUSTOM_SETTINGS_IDENTIFIER = "cormoran_custom_settings";

const CODEC = {
  encode: (request: Request) => Request.encode(request).finish(),
  decode: (payload: Uint8Array) => Response.decode(payload),
};
export const CUSTOM_SETTINGS_SOURCE_ALL = 0xffffffff;

const LIST_NOTIFICATION_TIMEOUT_MS = 750;
const LIST_REQUEST_TIMEOUT_MS = 5000;

export interface CustomSettingsSection {
  customSubsystemIndex: number;
  identifier: string;
  settings: Setting[];
}

export interface UseCustomSettingsReturn {
  isAvailable: boolean;
  sections: CustomSettingsSection[];
  isLoading: boolean;
  error: string | null;
  loadSettings: () => Promise<void>;
  writeSettingToMemory: (
    setting: Setting,
    value: SettingValue,
  ) => Promise<void>;
  saveSection: (customSubsystemIndex: number) => Promise<void>;
  discardSection: (customSubsystemIndex: number) => Promise<void>;
  resetSection: (customSubsystemIndex: number) => Promise<void>;
  discardSetting: (setting: Setting) => Promise<void>;
  resetSetting: (setting: Setting) => Promise<void>;
  clearError: () => void;
}

function settingIdentity(setting: Setting): string {
  return [
    setting.customSubsystemIndex,
    setting.key,
    setting.source,
    setting.value?.arrayValue?.index ?? "scalar",
  ].join(":");
}

function scopeForSection(customSubsystemIndex: number): SettingScope {
  return {
    customSubsystemIndex,
    source: CUSTOM_SETTINGS_SOURCE_ALL,
  };
}

function scopeForSetting(setting: Setting): SettingScope {
  return {
    customSubsystemIndex: setting.customSubsystemIndex,
    key: setting.key,
    source: setting.source,
  };
}

function valueWithArrayShape(
  setting: Setting,
  value: SettingValue,
): SettingValue {
  const arrayValue = setting.value?.arrayValue;
  if (!arrayValue) {
    return value;
  }

  const scalarValue = value.arrayValue?.value ?? value;
  return {
    arrayValue: {
      index: arrayValue.index,
      size: arrayValue.size,
      value: scalarValue,
    },
  };
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string,
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

export function useCustomSettings(): UseCustomSettingsReturn {
  const { t } = useLanguage();
  const zmkApp = useContext(ZMKAppContext);
  const { subsystem, ready, call } = useCustomSubsystem(
    CUSTOM_SETTINGS_IDENTIFIER,
    CODEC,
  );
  const [settings, setSettings] = useState<Setting[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subsystemIndex = subsystem?.index;

  const subsystemIdentifierForIndex = useCallback(
    (index: number) =>
      zmkApp?.state.customSubsystems?.subsystems[index]?.identifier ??
      t("Subsystem {{index}}", { index }),
    [t, zmkApp?.state.customSubsystems?.subsystems],
  );

  const callCustomRequest = useCallback(
    async (request: Request): Promise<Response> => {
      if (!ready) {
        throw new Error(t("Custom settings subsystem is not available"));
      }

      const response = await call(request);
      if (!response) {
        throw new Error(t("Empty custom settings response"));
      }

      if (response.error) {
        throw new Error(response.error.message || t("Custom settings failed"));
      }
      return response;
    },
    [t, ready, call],
  );

  const collectListSettings = useCallback(async (): Promise<Setting[]> => {
    if (!ready || !zmkApp || subsystemIndex === undefined) {
      return [];
    }

    const collected: Setting[] = [];
    let expectedCount: number | undefined;
    let quietTimeout: ReturnType<typeof setTimeout> | undefined;
    let resolveList: () => void = () => {};
    let isComplete = false;

    const listComplete = new Promise<void>((resolve) => {
      resolveList = resolve;
    });

    const completeList = () => {
      if (isComplete) {
        return;
      }
      isComplete = true;
      if (quietTimeout) {
        clearTimeout(quietTimeout);
      }
      resolveList();
    };

    const scheduleQuietResolve = () => {
      if (quietTimeout) {
        clearTimeout(quietTimeout);
      }
      quietTimeout = setTimeout(completeList, LIST_NOTIFICATION_TIMEOUT_MS);
    };

    const unsubscribe = zmkApp.onNotification({
      type: "custom",
      subsystemIndex,
      callback: (customNotification) => {
        try {
          const notification = Notification.decode(customNotification.payload);
          if (
            notification.setting?.kind ===
              SettingNotificationKind.SETTING_NOTIFICATION_KIND_LIST_ITEM &&
            notification.setting.setting
          ) {
            collected.push(notification.setting.setting);
            scheduleQuietResolve();
          }
        } catch (err) {
          console.error("Failed to decode custom setting notification:", err);
        }
      },
    });

    try {
      const response = await withTimeout(
        callCustomRequest(
          Request.create({
            listSettings: {
              scope: { source: CUSTOM_SETTINGS_SOURCE_ALL },
              requireMeta: true,
            },
          }),
        ),
        LIST_REQUEST_TIMEOUT_MS,
        t("Custom settings list timed out"),
      );
      expectedCount = response.status?.affectedCount;
      if (expectedCount === 0) {
        completeList();
      } else {
        scheduleQuietResolve();
      }
      await listComplete;
      return collected;
    } finally {
      unsubscribe();
      if (quietTimeout) {
        clearTimeout(quietTimeout);
      }
    }
  }, [callCustomRequest, ready, subsystemIndex, t, zmkApp]);

  const loadSettings = useCallback(async () => {
    if (!ready) {
      setSettings([]);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const listedSettings = await collectListSettings();
      const uniqueSettings = new Map<string, Setting>();
      for (const setting of listedSettings) {
        uniqueSettings.set(settingIdentity(setting), setting);
      }
      setSettings(
        Array.from(uniqueSettings.values()).sort(
          (a, b) =>
            a.customSubsystemIndex - b.customSubsystemIndex ||
            a.key.localeCompare(b.key) ||
            a.source - b.source ||
            (a.value?.arrayValue?.index ?? -1) -
              (b.value?.arrayValue?.index ?? -1),
        ),
      );
    } catch (err) {
      console.error("Failed to load custom settings:", err);
      setError(
        err instanceof Error
          ? err.message
          : t("Failed to load custom settings"),
      );
    } finally {
      setIsLoading(false);
    }
  }, [collectListSettings, ready, t]);

  const writeSettingToMemory = useCallback(
    async (setting: Setting, value: SettingValue) => {
      const nextValue = valueWithArrayShape(setting, value);

      setSettings((prev) =>
        prev.map((candidate) =>
          settingIdentity(candidate) === settingIdentity(setting)
            ? { ...candidate, value: nextValue, hasUnsavedValue: true }
            : candidate,
        ),
      );

      try {
        await callCustomRequest(
          Request.create({
            writeSetting: {
              setting: {
                customSubsystemIndex: setting.customSubsystemIndex,
                key: setting.key,
                source: setting.source,
                arrayIndex: setting.value?.arrayValue?.index,
              },
              value: nextValue,
              mode: SettingWriteMode.SETTING_WRITE_MODE_MEMORY,
            },
          }),
        );
        setError(null);
      } catch (err) {
        console.error("Failed to write custom setting:", err);
        setError(
          err instanceof Error
            ? err.message
            : t("Failed to write custom setting"),
        );
        await loadSettings();
      }
    },
    [callCustomRequest, loadSettings, t],
  );

  const mutateScope = useCallback(
    async (
      scope: SettingScope,
      type: "saveSettings" | "discardSettings" | "resetSettings",
    ) => {
      setIsLoading(true);
      setError(null);
      try {
        await callCustomRequest(
          Request.create({
            [type]: {
              scope,
            },
          }),
        );
        await loadSettings();
      } catch (err) {
        console.error(`Failed to ${type}:`, err);
        const fallback =
          type === "saveSettings"
            ? t("Failed to save settings")
            : type === "discardSettings"
              ? t("Failed to discard settings")
              : t("Failed to reset settings");
        setError(err instanceof Error ? err.message : fallback);
      } finally {
        setIsLoading(false);
      }
    },
    [callCustomRequest, loadSettings, t],
  );

  const sections = useMemo(() => {
    const grouped = new Map<number, Setting[]>();
    for (const setting of settings) {
      const existing = grouped.get(setting.customSubsystemIndex);
      if (existing) {
        existing.push(setting);
      } else {
        grouped.set(setting.customSubsystemIndex, [setting]);
      }
    }

    return Array.from(grouped.entries()).map(
      ([customSubsystemIndex, sectionSettings]) => ({
        customSubsystemIndex,
        identifier: subsystemIdentifierForIndex(customSubsystemIndex),
        settings: sectionSettings,
      }),
    );
  }, [settings, subsystemIdentifierForIndex]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  return {
    isAvailable: subsystem !== null,
    sections,
    isLoading,
    error,
    loadSettings,
    writeSettingToMemory,
    saveSection: (customSubsystemIndex) =>
      mutateScope(scopeForSection(customSubsystemIndex), "saveSettings"),
    discardSection: (customSubsystemIndex) =>
      mutateScope(scopeForSection(customSubsystemIndex), "discardSettings"),
    resetSection: (customSubsystemIndex) =>
      mutateScope(scopeForSection(customSubsystemIndex), "resetSettings"),
    discardSetting: (setting) =>
      mutateScope(scopeForSetting(setting), "discardSettings"),
    resetSetting: (setting) =>
      mutateScope(scopeForSetting(setting), "resetSettings"),
    clearError: () => setError(null),
  };
}
