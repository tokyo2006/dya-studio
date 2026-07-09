import {
  DEMO_SUBSYSTEMS,
  FAST_KEYMAP_IDENTIFIER,
  isDemoSubsystemEnabled,
  setDemoSubsystemEnabled,
} from "../demo-subsystems";

beforeEach(() => {
  localStorage.clear();
});

describe("demo-subsystems", () => {
  it("defaults every subsystem on except fast-keymap", () => {
    for (const s of DEMO_SUBSYSTEMS) {
      const expected = s.identifier !== FAST_KEYMAP_IDENTIFIER;
      expect(isDemoSubsystemEnabled(s.identifier)).toBe(expected);
    }
  });

  it("persists and honors an enable override for fast-keymap", () => {
    expect(isDemoSubsystemEnabled(FAST_KEYMAP_IDENTIFIER)).toBe(false);
    setDemoSubsystemEnabled(FAST_KEYMAP_IDENTIFIER, true);
    expect(isDemoSubsystemEnabled(FAST_KEYMAP_IDENTIFIER)).toBe(true);
  });

  it("persists a disable override for a default-on subsystem", () => {
    const zmkSettings = DEMO_SUBSYSTEMS.find(
      (s) => s.label === "Settings",
    )!.identifier;
    expect(isDemoSubsystemEnabled(zmkSettings)).toBe(true);
    setDemoSubsystemEnabled(zmkSettings, false);
    expect(isDemoSubsystemEnabled(zmkSettings)).toBe(false);
  });

  it("has unique, contiguous indices matching the demo transport", () => {
    const indices = DEMO_SUBSYSTEMS.map((s) => s.index);
    expect(indices).toEqual(indices.map((_, i) => i));
    expect(new Set(DEMO_SUBSYSTEMS.map((s) => s.identifier)).size).toBe(
      DEMO_SUBSYSTEMS.length,
    );
  });
});
