import {
  CustomSettingsHandler,
  MACRO_KEYSPACE_PREFIX,
} from "../demo-custom-settings";
import {
  Request,
  SettingWriteMode,
} from "../../../proto/cormoran/zmk/custom_settings/custom_settings";

describe("demo-custom-settings CustomSettingsHandler", () => {
  it("creates a new entry in the macro/ keyspace", () => {
    const handler = new CustomSettingsHandler(3);
    const response = handler.process(
      Request.create({
        createSetting: {
          setting: { key: `${MACRO_KEYSPACE_PREFIX}foo` },
          value: { bytesValue: Uint8Array.from([1]) },
          mode: SettingWriteMode.SETTING_WRITE_MODE_MEMORY,
        },
      }),
    );

    expect(response.error).toBeUndefined();
    expect(response.status?.affectedCount).toBe(1);

    const entries = handler.keyspaceEntries(MACRO_KEYSPACE_PREFIX);
    expect(entries).toHaveLength(1);
    expect(entries[0].key).toBe(`${MACRO_KEYSPACE_PREFIX}foo`);
    expect(entries[0].value.bytesValue).toEqual(Uint8Array.from([1]));
  });

  it("rejects creating a setting outside a registered keyspace", () => {
    const handler = new CustomSettingsHandler(3);
    const response = handler.process(
      Request.create({
        createSetting: {
          setting: { key: "not_a_keyspace/foo" },
          value: { bytesValue: Uint8Array.from([1]) },
          mode: SettingWriteMode.SETTING_WRITE_MODE_MEMORY,
        },
      }),
    );

    expect(response.error).toBeDefined();
  });

  it("rejects creating a duplicate key", () => {
    const handler = new CustomSettingsHandler(3);
    const create = () =>
      handler.process(
        Request.create({
          createSetting: {
            setting: { key: `${MACRO_KEYSPACE_PREFIX}dup` },
            value: { bytesValue: Uint8Array.from([1]) },
            mode: SettingWriteMode.SETTING_WRITE_MODE_MEMORY,
          },
        }),
      );

    expect(create().error).toBeUndefined();
    expect(create().error).toBeDefined();
  });

  it("deletes a previously created entry", () => {
    const handler = new CustomSettingsHandler(3);
    handler.process(
      Request.create({
        createSetting: {
          setting: { key: `${MACRO_KEYSPACE_PREFIX}gone` },
          value: { bytesValue: Uint8Array.from([1]) },
          mode: SettingWriteMode.SETTING_WRITE_MODE_MEMORY,
        },
      }),
    );

    const response = handler.process(
      Request.create({
        deleteSetting: {
          setting: { key: `${MACRO_KEYSPACE_PREFIX}gone` },
        },
      }),
    );

    expect(response.error).toBeUndefined();
    expect(handler.keyspaceEntries(MACRO_KEYSPACE_PREFIX)).toHaveLength(0);
  });

  it("fails to delete a key with no live entry", () => {
    const handler = new CustomSettingsHandler(3);
    const response = handler.process(
      Request.create({
        deleteSetting: {
          setting: { key: `${MACRO_KEYSPACE_PREFIX}missing` },
        },
      }),
    );

    expect(response.error).toBeDefined();
  });

  it("notifies keyspace change listeners on create/delete", () => {
    const handler = new CustomSettingsHandler(3);
    const onChange = jest.fn();
    handler.onKeyspaceChange(onChange);

    handler.process(
      Request.create({
        createSetting: {
          setting: { key: `${MACRO_KEYSPACE_PREFIX}notify` },
          value: { bytesValue: Uint8Array.from([1]) },
          mode: SettingWriteMode.SETTING_WRITE_MODE_MEMORY,
        },
      }),
    );
    expect(onChange).toHaveBeenCalledTimes(1);

    handler.process(
      Request.create({
        deleteSetting: {
          setting: { key: `${MACRO_KEYSPACE_PREFIX}notify` },
        },
      }),
    );
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("assembles a value written over multiple WriteValueChunk RPCs", () => {
    const handler = new CustomSettingsHandler(3);
    handler.process(
      Request.create({
        createSetting: {
          setting: { key: `${MACRO_KEYSPACE_PREFIX}chunked` },
          value: { bytesValue: Uint8Array.from([]) },
          mode: SettingWriteMode.SETTING_WRITE_MODE_MEMORY,
        },
      }),
    );

    const first = Uint8Array.from({ length: 128 }, (_, i) => i % 256);
    const second = Uint8Array.from([9, 9, 9]);
    const total = first.length + second.length;

    const chunk1 = handler.process(
      Request.create({
        writeValueChunk: {
          setting: { key: `${MACRO_KEYSPACE_PREFIX}chunked` },
          totalSize: total,
          offset: 0,
          data: first,
          commit: false,
          mode: SettingWriteMode.SETTING_WRITE_MODE_MEMORY,
        },
      }),
    );
    expect(chunk1.error).toBeUndefined();

    const chunk2 = handler.process(
      Request.create({
        writeValueChunk: {
          setting: { key: `${MACRO_KEYSPACE_PREFIX}chunked` },
          totalSize: total,
          offset: first.length,
          data: second,
          commit: true,
          mode: SettingWriteMode.SETTING_WRITE_MODE_MEMORY,
        },
      }),
    );
    expect(chunk2.error).toBeUndefined();
    expect(chunk2.status?.affectedCount).toBe(1);

    const entries = handler.keyspaceEntries(MACRO_KEYSPACE_PREFIX);
    expect(entries).toHaveLength(1);
    expect(entries[0].value.bytesValue).toEqual(
      Uint8Array.from([...first, ...second]),
    );
  });

  it("rejects an out-of-order chunk", () => {
    const handler = new CustomSettingsHandler(3);
    handler.process(
      Request.create({
        createSetting: {
          setting: { key: `${MACRO_KEYSPACE_PREFIX}bad` },
          value: { bytesValue: Uint8Array.from([]) },
          mode: SettingWriteMode.SETTING_WRITE_MODE_MEMORY,
        },
      }),
    );

    const response = handler.process(
      Request.create({
        writeValueChunk: {
          setting: { key: `${MACRO_KEYSPACE_PREFIX}bad` },
          totalSize: 10,
          offset: 5,
          data: Uint8Array.from([1, 2, 3]),
          commit: true,
          mode: SettingWriteMode.SETTING_WRITE_MODE_MEMORY,
        },
      }),
    );

    expect(response.error).toBeDefined();
  });

  it("lists the built-in mock settings including the behavior-typed value", (done) => {
    const handler = new CustomSettingsHandler(3);
    const notifications: Uint8Array[] = [];
    handler.notify((payload) => notifications.push(payload));

    const response = handler.process(
      Request.create({ listSettings: { scope: { source: 0xffffffff } } }),
    );
    expect(response.status?.affectedCount).toBeGreaterThan(0);

    setTimeout(() => {
      expect(notifications.length).toBe(response.status?.affectedCount);
      done();
    }, 250);
  });
});
