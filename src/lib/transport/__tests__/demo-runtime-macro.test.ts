import { RuntimeMacroHandler } from "../demo-runtime-macro";
import { Request } from "../../../proto/cormoran/runtime_macro/runtime_macro";

describe("RuntimeMacroHandler", () => {
  let handler: RuntimeMacroHandler;

  beforeEach(() => {
    handler = new RuntimeMacroHandler();
  });

  it("lists macro slots and global limits", () => {
    const response = handler.process(Request.create({ listMacros: {} }));

    expect(response.listMacros?.macros.length).toBeGreaterThan(0);
    expect(response.listMacros?.maxMacroBytes).toBe(64);
    expect(response.listMacros?.maxNameLength).toBe(64);
  });

  it("gets an existing macro slot", () => {
    const response = handler.process(
      Request.create({ getMacro: { index: 0 } }),
    );

    expect(response.getMacro?.macro?.index).toBe(0);
    expect(response.getMacro?.macro?.name).toBe("Hello");
    expect(response.getMacro?.macro?.steps.length).toBeGreaterThan(0);
  });

  it("updates macro name and steps in memory", () => {
    const nameResponse = handler.process(
      Request.create({
        setMacroName: {
          index: 2,
          name: "Layer macro",
          persist: false,
        },
      }),
    );
    const countResponse = handler.process(
      Request.create({
        setMacroStepCount: {
          index: 2,
          stepCount: 1,
          persist: false,
        },
      }),
    );
    const stepResponse = handler.process(
      Request.create({
        setMacroStep: {
          index: 2,
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
      Request.create({ getMacro: { index: 2 } }),
    );

    expect(nameResponse.status?.affectedCount).toBe(1);
    expect(countResponse.status?.affectedCount).toBe(1);
    expect(stepResponse.status?.affectedCount).toBe(1);
    expect(getResponse.getMacro?.macro?.name).toBe("Layer macro");
    expect(getResponse.getMacro?.macro?.steps[0].tap?.param1).toBe(0x29);
  });

  it("discards memory-only changes", () => {
    handler.process(
      Request.create({
        setMacroName: {
          index: 0,
          name: "Unsaved",
          persist: false,
        },
      }),
    );

    const discardResponse = handler.process(
      Request.create({ discardMacros: {} }),
    );
    const getResponse = handler.process(
      Request.create({ getMacro: { index: 0 } }),
    );

    expect(discardResponse.status?.affectedCount).toBe(1);
    expect(getResponse.getMacro?.macro?.name).toBe("Hello");
  });

  it("persists saved changes", () => {
    handler.process(
      Request.create({
        setMacroName: {
          index: 0,
          name: "Saved",
          persist: false,
        },
      }),
    );

    const saveResponse = handler.process(Request.create({ saveMacros: {} }));
    handler.process(Request.create({ discardMacros: {} }));
    const getResponse = handler.process(
      Request.create({ getMacro: { index: 0 } }),
    );

    expect(saveResponse.status?.affectedCount).toBe(1);
    expect(getResponse.getMacro?.macro?.name).toBe("Saved");
  });
});
