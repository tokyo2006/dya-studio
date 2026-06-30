import { getKeycodeByName, searchKeycodes } from "../keycodes";

describe("keycodes", () => {
  describe("Japanese language key aliases", () => {
    it("maps kana aliases to Lang1 and eisu aliases to Lang2", () => {
      expect(getKeycodeByName("KANA")?.code).toBe(0x90);
      expect(getKeycodeByName("JA")?.code).toBe(0x90);
      expect(getKeycodeByName("EISU")?.code).toBe(0x91);
      expect(getKeycodeByName("EN")?.code).toBe(0x91);
    });

    it("searches Japanese language keys by their aliases", () => {
      expect(
        searchKeycodes("kana").some((keycode) => keycode.code === 0x90),
      ).toBe(true);
      expect(searchKeycodes("eisu")).toEqual([
        expect.objectContaining({ code: 0x91 }),
      ]);
    });
  });
});
