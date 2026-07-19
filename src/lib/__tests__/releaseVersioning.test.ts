import {
  applyRelease,
  emptyUpcoming,
  isReleaseEmpty,
  isUpcomingVersion,
  nextReleaseVersion,
  UPCOMING,
} from "../releaseVersioning";
import type { ReleaseNotesData } from "../../i18n/releaseNotes";

describe("nextReleaseVersion", () => {
  it("starts at .0 when no version exists for the date", () => {
    expect(nextReleaseVersion("2026.04.01", [])).toBe("2026.04.01.0");
    expect(nextReleaseVersion("2026.04.01", ["2026.03.31.0"])).toBe(
      "2026.04.01.0",
    );
  });

  it("increments past the highest N for the same date", () => {
    expect(
      nextReleaseVersion("2026.04.01", [
        "2026.04.01.0",
        "2026.04.01.1",
        "2026.03.31.9",
      ]),
    ).toBe("2026.04.01.2");
  });

  it("ignores non-numeric or mismatched suffixes", () => {
    expect(
      nextReleaseVersion("2026.04.01", [
        "2026.04.01.x",
        "2026.04.010",
        "upcoming",
      ]),
    ).toBe("2026.04.01.0");
  });
});

describe("applyRelease", () => {
  function seed(): ReleaseNotesData {
    return {
      releases: [
        {
          version: UPCOMING,
          date: null,
          changes: {
            major: [{ en: "Big thing", ja: "大きな変更" }],
            minor: [],
            patch: [{ en: "Small fix", ja: "小さな修正" }],
          },
        },
        {
          version: "2026.03.31.0",
          date: "2026-03-31",
          changes: { major: [], minor: [], patch: [] },
        },
      ],
    };
  }

  it("promotes upcoming to a dated release and prepends a fresh upcoming", () => {
    const out = applyRelease(seed(), "2026.04.01.0", "2026-04-01");
    expect(out.releases).toHaveLength(3);

    const [fresh, released, previous] = out.releases;
    expect(fresh.version).toBe(UPCOMING);
    expect(isReleaseEmpty(fresh)).toBe(true);

    expect(released.version).toBe("2026.04.01.0");
    expect(released.date).toBe("2026-04-01");
    expect(released.changes.major).toEqual([
      { en: "Big thing", ja: "大きな変更" },
    ]);
    expect(released.changes.patch).toHaveLength(1);

    expect(previous.version).toBe("2026.03.31.0");
  });

  it("does not mutate the input data", () => {
    const input = seed();
    applyRelease(input, "2026.04.01.0", "2026-04-01");
    expect(input.releases[0].version).toBe(UPCOMING);
    expect(input.releases).toHaveLength(2);
  });

  it("carries the upcoming summary into the release and clears it on the fresh upcoming", () => {
    const data: ReleaseNotesData = {
      releases: [
        {
          version: UPCOMING,
          date: null,
          summary: {
            lead: { en: "Big update.", ja: "大型アップデート。" },
            highlights: [{ en: "Added X.", ja: "X を追加。" }],
          },
          changes: { major: [], minor: [], patch: [] },
        },
      ],
    };
    const out = applyRelease(data, "2026.04.01.0", "2026-04-01");
    expect(out.releases[0].summary).toBeUndefined();
    expect(out.releases[1].summary?.lead?.en).toBe("Big update.");
    expect(out.releases[1].summary?.highlights).toHaveLength(1);
  });

  it("throws when there is no upcoming section", () => {
    const data: ReleaseNotesData = {
      releases: [
        {
          version: "2026.03.31.0",
          date: "2026-03-31",
          changes: { major: [], minor: [], patch: [] },
        },
      ],
    };
    expect(() => applyRelease(data, "2026.04.01.0", "2026-04-01")).toThrow();
  });
});

describe("helpers", () => {
  it("isUpcomingVersion recognizes the marker", () => {
    expect(isUpcomingVersion(UPCOMING)).toBe(true);
    expect(isUpcomingVersion("2026.04.01.0")).toBe(false);
  });

  it("emptyUpcoming produces an empty upcoming section", () => {
    const u = emptyUpcoming();
    expect(u.version).toBe(UPCOMING);
    expect(u.date).toBeNull();
    expect(isReleaseEmpty(u)).toBe(true);
  });
});
