import {
  assertOfficialKeymapRpcAllowed,
  isFastKeymapGuardActive,
  OfficialKeymapRpcForbiddenError,
  setFastKeymapAvailable,
} from "../officialKeymapRpcGuard";

afterEach(() => {
  setFastKeymapAvailable(false);
});

describe("officialKeymapRpcGuard", () => {
  it("is inactive by default and allows every request", () => {
    expect(isFastKeymapGuardActive()).toBe(false);
    expect(() =>
      assertOfficialKeymapRpcAllowed({ keymap: { getKeymap: true } }),
    ).not.toThrow();
    expect(() =>
      assertOfficialKeymapRpcAllowed({ behaviors: { listAllBehaviors: true } }),
    ).not.toThrow();
  });

  describe("when fast-keymap is available", () => {
    beforeEach(() => setFastKeymapAvailable(true));

    it("reports active", () => {
      expect(isFastKeymapGuardActive()).toBe(true);
    });

    it.each([
      ["keymap.getKeymap", { keymap: { getKeymap: true } }],
      ["keymap.getPhysicalLayouts", { keymap: { getPhysicalLayouts: true } }],
      ["behaviors.listAllBehaviors", { behaviors: { listAllBehaviors: true } }],
      [
        "behaviors.getBehaviorDetails",
        { behaviors: { getBehaviorDetails: { behaviorId: 1 } } },
      ],
    ])("forbids the official read %s", (_name, request) => {
      expect(() => assertOfficialKeymapRpcAllowed(request as never)).toThrow(
        OfficialKeymapRpcForbiddenError,
      );
    });

    it.each([
      [
        "setLayerBinding",
        {
          keymap: {
            setLayerBinding: {
              layerId: 0,
              keyPosition: 0,
              binding: { behaviorId: 1, param1: 0, param2: 0 },
            },
          },
        },
      ],
      ["saveChanges", { keymap: { saveChanges: true } }],
      ["checkUnsavedChanges", { keymap: { checkUnsavedChanges: true } }],
      ["addLayer", { keymap: { addLayer: {} } }],
    ])("allows the edit / unsaved-check RPC %s", (_name, request) => {
      expect(() =>
        assertOfficialKeymapRpcAllowed(request as never),
      ).not.toThrow();
    });
  });
});
