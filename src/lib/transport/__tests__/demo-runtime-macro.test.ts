import { RuntimeMacroHandler } from "../demo-runtime-macro";
import {
  CustomSettingsHandler,
  MACRO_KEYSPACE_PREFIX,
} from "../demo-custom-settings";
import { Request } from "../../../proto/cormoran/runtime_macro/runtime_macro";
import {
  Request as CustomSettingsRequest,
  SettingWriteMode,
} from "../../../proto/cormoran/zmk/custom_settings/custom_settings";

describe("RuntimeMacroHandler", () => {
  let customSettings: CustomSettingsHandler;
  let handler: RuntimeMacroHandler;

  beforeEach(() => {
    customSettings = new CustomSettingsHandler(9);
    handler = new RuntimeMacroHandler(customSettings);
  });

  it("lists macros and global limits", () => {
    const response = handler.process(Request.create({ listMacros: {} }));

    expect(response.listMacros?.macros.length).toBeGreaterThan(0);
    expect(response.listMacros?.maxMacroBytes).toBe(64);
    expect(response.listMacros?.maxNameLength).toBe(64);
  });

  it("gets an existing macro by slot", () => {
    const response = handler.process(Request.create({ getMacro: { slot: 0 } }));

    expect(response.getMacro?.macro?.slot).toBe(0);
    expect(response.getMacro?.macro?.name).toBe("Hello");
    expect(response.getMacro?.macro?.steps.length).toBeGreaterThan(0);
  });

  it("reports pool usage in global settings", () => {
    const response = handler.process(
      Request.create({ getMacroGlobalSettings: {} }),
    );

    expect(response.getMacroGlobalSettings?.settings?.poolBytesTotal).toBe(
      1024,
    );
    expect(
      response.getMacroGlobalSettings?.settings?.poolBytesUsed,
    ).toBeGreaterThan(0);
    expect(response.getMacroGlobalSettings?.settings?.maxEntries).toBe(8);
  });

  it("updates macro steps in memory", () => {
    const countResponse = handler.process(
      Request.create({
        setMacroStepCount: {
          slot: 0,
          stepCount: 1,
          persist: false,
        },
      }),
    );
    const stepResponse = handler.process(
      Request.create({
        setMacroStep: {
          slot: 0,
          stepIndex: 0,
          persist: false,
          step: {
            tap: {
              behaviorId: 10,
              param1: 0x29,
              param2: 0,
            },
          },
        },
      }),
    );
    const getResponse = handler.process(
      Request.create({ getMacro: { slot: 0 } }),
    );

    expect(countResponse.status?.affectedCount).toBe(1);
    expect(stepResponse.status?.affectedCount).toBe(1);
    expect(getResponse.getMacro?.macro?.steps[0].tap?.param1).toBe(0x29);
  });

  it("discards memory-only changes", () => {
    handler.process(
      Request.create({
        setMacroStepCount: { slot: 0, stepCount: 0, persist: false },
      }),
    );

    const discardResponse = handler.process(
      Request.create({ discardMacros: {} }),
    );
    const getResponse = handler.process(
      Request.create({ getMacro: { slot: 0 } }),
    );

    expect(discardResponse.status?.affectedCount).toBe(1);
    expect(getResponse.getMacro?.macro?.steps.length).toBeGreaterThan(0);
  });

  it("persists saved changes", () => {
    handler.process(
      Request.create({
        setMacroStepCount: { slot: 0, stepCount: 0, persist: false },
      }),
    );

    const saveResponse = handler.process(Request.create({ saveMacros: {} }));
    handler.process(Request.create({ discardMacros: {} }));
    const getResponse = handler.process(
      Request.create({ getMacro: { slot: 0 } }),
    );

    expect(saveResponse.status?.affectedCount).toBe(1);
    expect(getResponse.getMacro?.macro?.steps.length).toBe(0);
  });

  it("appends a step without rewriting existing steps", () => {
    const before = handler.process(Request.create({ getMacro: { slot: 0 } }));
    const initialCount = before.getMacro?.macro?.steps.length ?? 0;

    const appendResponse = handler.process(
      Request.create({
        appendMacroStep: {
          slot: 0,
          step: { delay: { delayMs: 50 } },
          persist: false,
        },
      }),
    );
    expect(appendResponse.status?.affectedCount).toBe(1);

    const after = handler.process(Request.create({ getMacro: { slot: 0 } }));
    expect(after.getMacro?.macro?.steps.length).toBe(initialCount + 1);
    expect(after.getMacro?.macro?.steps[initialCount].delay?.delayMs).toBe(50);
  });

  it("creates a new macro when the custom-settings keyspace gains a matching entry", () => {
    const createResponse = customSettings.process(
      CustomSettingsRequest.create({
        createSetting: {
          setting: { key: `${MACRO_KEYSPACE_PREFIX}new-macro` },
          value: { bytesValue: Uint8Array.from([1]) },
          mode: SettingWriteMode.SETTING_WRITE_MODE_MEMORY,
        },
      }),
    );
    expect(createResponse.error).toBeUndefined();

    const listResponse = handler.process(Request.create({ listMacros: {} }));
    const created = listResponse.listMacros?.macros.find(
      (macro) => macro.name === "new-macro",
    );
    expect(created).toBeDefined();
    expect(created?.encodedSize).toBe(0);
  });

  it("removes a macro when its custom-settings keyspace entry is deleted", () => {
    const before = handler.process(Request.create({ listMacros: {} }));
    expect(
      before.listMacros?.macros.some((macro) => macro.name === "Hello"),
    ).toBe(true);

    const deleteResponse = customSettings.process(
      CustomSettingsRequest.create({
        deleteSetting: {
          setting: { key: `${MACRO_KEYSPACE_PREFIX}Hello` },
        },
      }),
    );
    expect(deleteResponse.error).toBeUndefined();

    const after = handler.process(Request.create({ listMacros: {} }));
    expect(
      after.listMacros?.macros.some((macro) => macro.name === "Hello"),
    ).toBe(false);
  });
});
