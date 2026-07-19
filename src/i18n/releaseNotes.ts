/**
 * Release notes data + helpers.
 *
 * The source of truth is {@link ./releaseNotes.json}. It is edited by hand in
 * PRs (add entries to the `upcoming` release) and by the release CI, which
 * rewrites the `upcoming` entry's version/date and prepends a fresh empty
 * `upcoming` on every release. See docs/RELEASE_GUIDE.md.
 *
 * The app derives the current shipped version from this data — there is no
 * separate version file — so a build always shows whatever the newest released
 * entry says.
 */
import data from "./releaseNotes.json";
import type { Language } from "./translations";
import { UPCOMING } from "../lib/releaseVersioning";

export { UPCOMING };

/** Change severity, ordered most- to least-significant for display. */
export type ChangeCategory = "major" | "minor" | "patch";

export const CHANGE_CATEGORIES: ChangeCategory[] = ["major", "minor", "patch"];

/** A single change entry, authored in both supported languages. */
export interface LocalizedChange {
  en: string;
  ja: string;
}

export interface Release {
  /** Semantic-ish version `YYYY.MM.DD.N`, or {@link UPCOMING}. */
  version: string;
  /** Release date `YYYY-MM-DD`, or `null` for the upcoming section. */
  date: string | null;
  changes: Record<ChangeCategory, LocalizedChange[]>;
}

export interface ReleaseNotesData {
  releases: Release[];
}

const releaseNotes = data as ReleaseNotesData;

/** All releases, newest first, exactly as stored (upcoming may be first). */
export function getReleases(): Release[] {
  return releaseNotes.releases;
}

/** True when a release is the in-progress `upcoming` section. */
export function isUpcoming(release: Release): boolean {
  return release.version === UPCOMING;
}

/** True when a release has no change entries in any category. */
export function isEmptyRelease(release: Release): boolean {
  return CHANGE_CATEGORIES.every(
    (c) => (release.changes[c]?.length ?? 0) === 0,
  );
}

/**
 * The newest actually-released version, or `null` if nothing has shipped yet
 * (only an `upcoming` section exists). Drives the version shown on the splash
 * screen link.
 */
export function getCurrentVersion(): string | null {
  const released = releaseNotes.releases.find((r) => !isUpcoming(r));
  return released ? released.version : null;
}

/** Pick the text for a change in the active language. */
export function localizeChange(
  change: LocalizedChange,
  language: Language,
): string {
  return change[language] || change.en;
}
