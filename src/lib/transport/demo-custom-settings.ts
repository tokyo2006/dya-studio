import {
  Notification,
  Request,
  Response,
  SettingNotificationKind,
  type Setting,
  type SettingScope,
  type SettingValue,
} from "../../proto/cormoran/zmk/custom_settings/custom_settings";

export const CUSTOM_SETTINGS_IDENTIFIER = "cormoran_custom_settings";

const SOURCE_ALL = 0xffffffff;

function createMockSettings(customSubsystemIndex: number): Setting[] {
  return [
    {
      customSubsystemIndex,
      key: "default_layer",
      source: 0,
      hasUnsavedValue: false,
      meta: {
        confidentiality: 2,
        readPermission: 0,
        writePermission: 0,
        constraints: [{ layerId: {} }],
      },
      value: { int32Value: 0 },
    },
    {
      customSubsystemIndex,
      key: "tap_behavior",
      source: 0,
      hasUnsavedValue: false,
      meta: {
        confidentiality: 2,
        readPermission: 0,
        writePermission: 0,
        constraints: [{ behaviorId: {} }],
      },
      value: { int32Value: 10 },
    },
    {
      customSubsystemIndex,
      key: "feature_enabled",
      source: 0,
      hasUnsavedValue: false,
      meta: {
        confidentiality: 2,
        readPermission: 0,
        writePermission: 0,
        constraints: [],
      },
      value: { boolValue: true },
    },
    {
      customSubsystemIndex,
      key: "profile_name",
      source: 0,
      hasUnsavedValue: false,
      meta: {
        confidentiality: 2,
        readPermission: 0,
        writePermission: 0,
        constraints: [
          {
            options: {
              values: [
                { stringValue: "normal" },
                { stringValue: "gaming" },
                { stringValue: "travel" },
              ],
              labels: ["Normal", "Gaming", "Travel"],
            },
          },
        ],
      },
      value: { stringValue: "normal" },
    },
    {
      customSubsystemIndex,
      key: "macro_bytes",
      source: 0,
      hasUnsavedValue: false,
      meta: {
        confidentiality: 2,
        readPermission: 0,
        writePermission: 0,
        constraints: [],
      },
      value: { bytesValue: Uint8Array.from([0x01, 0x02, 0x0a, 0xff]) },
    },
  ];
}

function cloneValue(value: SettingValue | undefined): SettingValue | undefined {
  if (!value) {
    return undefined;
  }

  if (value.bytesValue !== undefined) {
    return { bytesValue: new Uint8Array(value.bytesValue) };
  }
  if (value.int32Value !== undefined) {
    return { int32Value: value.int32Value };
  }
  if (value.boolValue !== undefined) {
    return { boolValue: value.boolValue };
  }
  if (value.stringValue !== undefined) {
    return { stringValue: value.stringValue };
  }
  if (value.arrayValue !== undefined) {
    return {
      arrayValue: {
        index: value.arrayValue.index,
        size: value.arrayValue.size,
        value: cloneValue(value.arrayValue.value),
      },
    };
  }
  return {};
}

function cloneSetting(setting: Setting): Setting {
  return {
    ...setting,
    meta: setting.meta
      ? {
          ...setting.meta,
          constraints: setting.meta.constraints.map((constraint) => ({
            ...constraint,
            options: constraint.options
              ? {
                  values: constraint.options.values.map((value) => ({
                    ...value,
                    bytesValue: value.bytesValue
                      ? new Uint8Array(value.bytesValue)
                      : undefined,
                  })),
                  labels: [...constraint.options.labels],
                }
              : undefined,
          })),
        }
      : undefined,
    value: cloneValue(setting.value),
  };
}

function sameSetting(a: Setting, b: Setting): boolean {
  return (
    a.customSubsystemIndex === b.customSubsystemIndex &&
    a.key === b.key &&
    a.source === b.source &&
    (a.value?.arrayValue?.index ?? undefined) ===
      (b.value?.arrayValue?.index ?? undefined)
  );
}

function matchesScope(setting: Setting, scope: SettingScope | undefined) {
  if (!scope) {
    return true;
  }
  if (
    scope.customSubsystemIndex !== undefined &&
    setting.customSubsystemIndex !== scope.customSubsystemIndex
  ) {
    return false;
  }
  if (scope.key !== undefined && setting.key !== scope.key) {
    return false;
  }
  if (
    scope.keyPrefix !== undefined &&
    !setting.key.startsWith(scope.keyPrefix)
  ) {
    return false;
  }
  if (
    scope.source !== undefined &&
    scope.source !== SOURCE_ALL &&
    setting.source !== scope.source
  ) {
    return false;
  }
  return true;
}

function settingValueForWrite(
  setting: Setting,
  value: SettingValue,
): SettingValue {
  if (!setting.value?.arrayValue) {
    return cloneValue(value) ?? {};
  }

  return {
    arrayValue: {
      index: setting.value.arrayValue.index,
      size: setting.value.arrayValue.size,
      value: cloneValue(value.arrayValue?.value ?? value),
    },
  };
}

export class CustomSettingsHandler {
  private readonly defaults: Setting[];
  private persistent: Setting[];
  private settings: Setting[];
  private callbacks: ((data: Uint8Array) => void)[] = [];

  constructor(customSubsystemIndex: number) {
    this.defaults = createMockSettings(customSubsystemIndex);
    this.persistent = this.defaults.map(cloneSetting);
    this.settings = this.defaults.map(cloneSetting);
  }

  process(request: Request): Response {
    if (request.listSettings) {
      const listedSettings = this.settings.filter((setting) =>
        matchesScope(setting, request.listSettings?.scope),
      );

      setTimeout(() => {
        listedSettings.forEach((setting, index) => {
          setTimeout(() => this.notifySetting(setting), index * 25);
        });
      }, 25);

      return {
        status: {
          affectedCount: listedSettings.length,
          message: "listed",
        },
      };
    }

    if (request.writeSetting?.setting && request.writeSetting.value) {
      const ref = request.writeSetting.setting;
      const setting = this.settings.find(
        (candidate) =>
          candidate.customSubsystemIndex === ref.customSubsystemIndex &&
          candidate.key === ref.key &&
          candidate.source === ref.source &&
          (candidate.value?.arrayValue?.index ?? undefined) === ref.arrayIndex,
      );

      if (!setting) {
        return { error: { message: "Setting not found" } };
      }

      setting.value = settingValueForWrite(setting, request.writeSetting.value);
      setting.hasUnsavedValue = true;
      this.notifySetting(
        setting,
        SettingNotificationKind.SETTING_NOTIFICATION_KIND_VALUE_UPDATED,
      );
      return { status: { affectedCount: 1, message: "written" } };
    }

    if (request.saveSettings) {
      const affected = this.mutateScope(
        request.saveSettings.scope,
        (setting) => {
          const persistent = this.persistent.find((candidate) =>
            sameSetting(candidate, setting),
          );
          if (persistent) {
            persistent.value = cloneValue(setting.value);
          }
          setting.hasUnsavedValue = false;
        },
      );
      return { status: { affectedCount: affected, message: "saved" } };
    }

    if (request.discardSettings) {
      const affected = this.mutateScope(
        request.discardSettings.scope,
        (setting) => {
          const persistent = this.persistent.find((candidate) =>
            sameSetting(candidate, setting),
          );
          if (persistent) {
            setting.value = cloneValue(persistent.value);
            setting.hasUnsavedValue = false;
          }
        },
      );
      return { status: { affectedCount: affected, message: "discarded" } };
    }

    if (request.resetSettings) {
      const affected = this.mutateScope(
        request.resetSettings.scope,
        (setting) => {
          const defaultSetting = this.defaults.find((candidate) =>
            sameSetting(candidate, setting),
          );
          const persistent = this.persistent.find((candidate) =>
            sameSetting(candidate, setting),
          );
          if (defaultSetting) {
            setting.value = cloneValue(defaultSetting.value);
            setting.hasUnsavedValue = false;
            if (persistent) {
              persistent.value = cloneValue(defaultSetting.value);
            }
          }
        },
      );
      return { status: { affectedCount: affected, message: "reset" } };
    }

    return { error: { message: "Not implemented" } };
  }

  notify(callback: (data: Uint8Array) => void) {
    this.callbacks.push(callback);
  }

  private mutateScope(
    scope: SettingScope | undefined,
    mutate: (setting: Setting) => void,
  ): number {
    const matched = this.settings.filter((setting) =>
      matchesScope(setting, scope),
    );
    matched.forEach((setting) => {
      mutate(setting);
      this.notifySetting(setting);
    });
    return matched.length;
  }

  private notifySetting(
    setting: Setting,
    kind: SettingNotificationKind = SettingNotificationKind.SETTING_NOTIFICATION_KIND_LIST_ITEM,
  ) {
    const payload = Notification.encode({
      setting: {
        kind,
        setting: cloneSetting(setting),
      },
    }).finish();
    this.callbacks.forEach((callback) => callback(payload));
  }
}
