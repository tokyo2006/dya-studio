/**
 * Pure release-versioning logic, shared by the app and the release CI script
 * (`scripts/release.ts`).
 *
 * Kept free of any runtime import of `releaseNotes.json` so the Node CLI can
 * load it via type-stripping without JSON import attributes. Types are pulled
 * in with `import type` (erased at runtime), so there is no runtime cycle with
 * `src/i18n/releaseNotes.ts`.
 */
import type {
  ChangeCategory,
  Release,
  ReleaseNotesData,
} from "../i18n/releaseNotes";

/** Marker version for the not-yet-released, in-progress section. */
export const UPCOMING = "upcoming";

const CATEGORIES: ChangeCategory[] = ["major", "minor", "patch"];

export function isUpcomingVersion(version: string): boolean {
  return version === UPCOMING;
}

/** A fresh, empty `upcoming` section for the top of the release list. */
export function emptyUpcoming(): Release {
  return {
    version: UPCOMING,
    date: null,
    changes: { major: [], minor: [], patch: [] },
  };
}

/**
 * Compute the next release version for a given day.
 *
 * Version format is `YYYY.MM.DD.N` where `N` increments per release on the
 * same date. `dateDots` is the day as `YYYY.MM.DD`; `existingVersions` is the
 * set of versions already released (e.g. from git tags). Returns the smallest
 * unused `N` for that date, starting at 0.
 */
export function nextReleaseVersion(
  dateDots: string,
  existingVersions: string[],
): string {
  const prefix = `${dateDots}.`;
  let maxN = -1;
  for (const version of existingVersions) {
    if (!version.startsWith(prefix)) continue;
    const suffix = version.slice(prefix.length);
    if (!/^\d+$/.test(suffix)) continue;
    maxN = Math.max(maxN, Number(suffix));
  }
  return `${dateDots}.${maxN + 1}`;
}

/**
 * Turn the `upcoming` section into a released version and prepend a fresh
 * empty `upcoming`.
 *
 * @param data          the current release notes data
 * @param version       the resolved version, e.g. `2026.04.01.0`
 * @param dateIso       release date as `YYYY-MM-DD`
 * @throws if there is no `upcoming` section to release
 */
export function applyRelease(
  data: ReleaseNotesData,
  version: string,
  dateIso: string,
): ReleaseNotesData {
  const index = data.releases.findIndex((r) => isUpcomingVersion(r.version));
  if (index < 0) {
    throw new Error(
      "No `upcoming` section found in release notes; nothing to release.",
    );
  }
  const upcoming = data.releases[index];
  const released: Release = {
    version,
    date: dateIso,
    // Carry the upcoming section's summary (if any) into the release.
    ...(upcoming.summary ? { summary: upcoming.summary } : {}),
    changes: {
      major: [...(upcoming.changes.major ?? [])],
      minor: [...(upcoming.changes.minor ?? [])],
      patch: [...(upcoming.changes.patch ?? [])],
    },
  };
  const rest = data.releases.filter((_, i) => i !== index);
  return { releases: [emptyUpcoming(), released, ...rest] };
}

/** True when a release section has no entries in any category. */
export function isReleaseEmpty(release: Release): boolean {
  return CATEGORIES.every((c) => (release.changes[c]?.length ?? 0) === 0);
}
