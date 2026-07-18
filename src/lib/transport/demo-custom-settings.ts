import {
  Notification,
  Request,
  Response,
  SettingNotificationKind,
  SettingWriteMode,
  type Setting,
  type SettingScope,
  type SettingValue,
} from "../../proto/cormoran/zmk/custom_settings/custom_settings";

export const CUSTOM_SETTINGS_IDENTIFIER = "cormoran_custom_settings";

const SOURCE_ALL = 0xffffffff;

// A simple RPC-creatable keyspace: any key starting with this prefix can be
// created/deleted via CreateSetting/DeleteSetting. This backs the demo
// runtime-macro handler's "macro/<name>" entries (see
// demo-runtime-macro.ts), mirroring firmware's
// ZMK_CUSTOM_SETTING_KEYSPACE_DEFINE.
export const MACRO_KEYSPACE_PREFIX = "macro/";

interface PendingChunkedWrite {
  totalSize: number;
  received: number;
  chunks: Uint8Array[];
  mode: SettingWriteMode;
}

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
    {
      customSubsystemIndex,
      key: "tap_behavior_binding",
      source: 0,
      hasUnsavedValue: false,
      meta: {
        confidentiality: 2,
        readPermission: 0,
        writePermission: 0,
        constraints: [],
      },
      value: { behaviorValue: { behaviorId: 10, param1: 0, param2: 0 } },
    },
  ];
}

// A couple of demo settings start persisted at a value that differs from their
// compile-time default (createMockSettings), so the blue "changed from default"
// dot is visible on load without the user editing anything. Keyed by setting
// key. Reset restores these to their default and the blue dot disappears.
const DEMO_MODIFIED_FROM_DEFAULT: Record<string, SettingValue> = {
  default_layer: { int32Value: 1 },
  feature_enabled: { boolValue: false },
};

// The initial persisted/current state: the compile-time defaults with the
// overrides above applied.
function createInitialSettings(customSubsystemIndex: number): Setting[] {
  return createMockSettings(customSubsystemIndex).map((setting) => {
    const override = DEMO_MODIFIED_FROM_DEFAULT[setting.key];
    return override ? { ...setting, value: cloneValue(override) } : setting;
  });
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
  if (value.behaviorValue !== undefined) {
    return { behaviorValue: { ...value.behaviorValue } };
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

function settingValuesEqual(
  a: SettingValue | undefined,
  b: SettingValue | undefined,
): boolean {
  if (a === b) {
    return true;
  }
  if (!a || !b) {
    return false;
  }
  if (a.int32Value !== undefined || b.int32Value !== undefined) {
    return a.int32Value === b.int32Value;
  }
  if (a.boolValue !== undefined || b.boolValue !== undefined) {
    return a.boolValue === b.boolValue;
  }
  if (a.stringValue !== undefined || b.stringValue !== undefined) {
    return a.stringValue === b.stringValue;
  }
  if (a.bytesValue !== undefined || b.bytesValue !== undefined) {
    const ab = a.bytesValue;
    const bb = b.bytesValue;
    if (!ab || !bb || ab.length !== bb.length) {
      return false;
    }
    return ab.every((byte, index) => byte === bb[index]);
  }
  if (a.behaviorValue !== undefined || b.behaviorValue !== undefined) {
    return (
      a.behaviorValue?.behaviorId === b.behaviorValue?.behaviorId &&
      a.behaviorValue?.param1 === b.behaviorValue?.param1 &&
      a.behaviorValue?.param2 === b.behaviorValue?.param2
    );
  }
  return true;
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
  private readonly customSubsystemIndex: number;
  private readonly defaults: Setting[];
  private persistent: Setting[];
  private settings: Setting[];
  private callbacks: ((data: Uint8Array) => void)[] = [];
  private pendingChunks = new Map<string, PendingChunkedWrite>();
  private keyspaceChangeCallbacks: (() => void)[] = [];

  constructor(customSubsystemIndex: number) {
    this.customSubsystemIndex = customSubsystemIndex;
    this.defaults = createMockSettings(customSubsystemIndex);
    const initial = createInitialSettings(customSubsystemIndex);
    this.persistent = initial.map(cloneSetting);
    this.settings = initial.map(cloneSetting);
  }

  // Lets other demo handlers (e.g. demo-runtime-macro.ts) read/react to the
  // "macro/" keyspace entries this handler owns, so create/delete via
  // CreateSetting/DeleteSetting is visible to ListMacros without duplicating
  // storage.
  onKeyspaceChange(callback: () => void) {
    this.keyspaceChangeCallbacks.push(callback);
  }

  keyspaceEntries(prefix: string): { key: string; value: SettingValue }[] {
    return this.settings
      .filter((setting) => setting.key.startsWith(prefix) && setting.value)
      .map((setting) => ({ key: setting.key, value: setting.value! }));
  }

  // Seeds an initial keyspace entry (e.g. for demo mock data) without going
  // through the CreateSetting request/notification path.
  seedKeyspaceEntry(key: string, value: SettingValue) {
    if (this.settings.some((setting) => setting.key === key)) {
      return;
    }
    this.settings.push({
      customSubsystemIndex: this.customSubsystemIndex,
      key,
      source: 0,
      hasUnsavedValue: false,
      value: cloneValue(value) ?? {},
    });
  }

  process(request: Request): Response {
    if (request.listSettings) {
      const listedSettings = this.settings.filter((setting) =>
        matchesScope(setting, request.listSettings?.scope),
      );
      const requireDefault = request.listSettings.requireDefault === true;

      setTimeout(() => {
        listedSettings.forEach((setting, index) => {
          // When the client asks for defaults, attach defaultValue only when
          // the current value differs from the compile-time default (and never
          // for array/keyspace settings) so the UI can show the blue dot.
          const listItem = requireDefault
            ? { ...setting, defaultValue: this.defaultValueFor(setting) }
            : setting;
          setTimeout(() => this.notifySetting(listItem), index * 25);
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

    if (request.createSetting?.setting) {
      return this.handleCreateSetting(request.createSetting);
    }

    if (request.deleteSetting?.setting) {
      return this.handleDeleteSetting(request.deleteSetting);
    }

    if (request.writeValueChunk?.setting) {
      return this.handleWriteValueChunk(request.writeValueChunk);
    }

    return { error: { message: "Not implemented" } };
  }

  private handleCreateSetting(
    createSetting: NonNullable<Request["createSetting"]>,
  ): Response {
    const ref = createSetting.setting!;
    const key = ref.key ?? "";
    if (!key.startsWith(MACRO_KEYSPACE_PREFIX)) {
      return {
        error: { message: `No keyspace registered for key "${key}"` },
      };
    }
    if (this.settings.some((setting) => setting.key === key)) {
      return { error: { message: `Key already in use: ${key}` } };
    }

    const setting: Setting = {
      customSubsystemIndex: this.customSubsystemIndex,
      key,
      source: 0,
      hasUnsavedValue:
        createSetting.mode !== SettingWriteMode.SETTING_WRITE_MODE_PERSIST,
      value: cloneValue(createSetting.value) ?? {},
    };
    this.settings.push(setting);
    if (createSetting.mode === SettingWriteMode.SETTING_WRITE_MODE_PERSIST) {
      this.persistent.push(cloneSetting(setting));
    }
    this.notifySetting(setting);
    this.notifyKeyspaceChange();
    return { status: { affectedCount: 1, message: "created" } };
  }

  private handleDeleteSetting(
    deleteSetting: NonNullable<Request["deleteSetting"]>,
  ): Response {
    const ref = deleteSetting.setting!;
    const key = ref.key ?? "";
    const index = this.settings.findIndex((setting) => setting.key === key);
    if (index < 0) {
      return { error: { message: `No live entry for key: ${key}` } };
    }
    this.settings.splice(index, 1);
    this.persistent = this.persistent.filter((setting) => setting.key !== key);
    this.notifyKeyspaceChange();
    return { status: { affectedCount: 1, message: "deleted" } };
  }

  private handleWriteValueChunk(
    writeValueChunk: NonNullable<Request["writeValueChunk"]>,
  ): Response {
    const ref = writeValueChunk.setting!;
    const key = ref.key ?? "";
    const { totalSize, offset, data, commit, mode } = writeValueChunk;

    if (offset === 0) {
      this.pendingChunks.set(key, {
        totalSize,
        received: 0,
        chunks: [],
        mode,
      });
    }

    const pending = this.pendingChunks.get(key);
    if (!pending || offset !== pending.received) {
      this.pendingChunks.delete(key);
      return { error: { message: "Chunk out of order" } };
    }

    pending.chunks.push(data);
    pending.received += data.length;

    if (!commit) {
      return { status: { affectedCount: 0, message: "chunk received" } };
    }

    this.pendingChunks.delete(key);
    const assembled = new Uint8Array(pending.received);
    let cursor = 0;
    for (const chunk of pending.chunks) {
      assembled.set(chunk, cursor);
      cursor += chunk.length;
    }

    const setting = this.settings.find((candidate) => candidate.key === key);
    if (!setting) {
      return { error: { message: "Setting not found" } };
    }

    setting.value = settingValueForWrite(setting, { bytesValue: assembled });
    setting.hasUnsavedValue =
      mode !== SettingWriteMode.SETTING_WRITE_MODE_PERSIST;
    this.notifySetting(
      setting,
      SettingNotificationKind.SETTING_NOTIFICATION_KIND_VALUE_UPDATED,
    );
    this.notifyKeyspaceChange();
    return { status: { affectedCount: 1, message: "written" } };
  }

  // The compile-time default for a setting, reported alongside a list item when
  // it differs from the current value. Returns undefined for array/keyspace
  // settings and for values that already equal their default.
  private defaultValueFor(setting: Setting): SettingValue | undefined {
    if (setting.value?.arrayValue !== undefined) {
      return undefined;
    }
    const defaultSetting = this.defaults.find((candidate) =>
      sameSetting(candidate, setting),
    );
    if (!defaultSetting) {
      return undefined;
    }
    return settingValuesEqual(setting.value, defaultSetting.value)
      ? undefined
      : cloneValue(defaultSetting.value);
  }

  private notifyKeyspaceChange() {
    this.keyspaceChangeCallbacks.forEach((callback) => callback());
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
