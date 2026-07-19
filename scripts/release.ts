/**
 * Release CLI, run by `.github/workflows/release.yml` on a manual dispatch.
 *
 * It resolves the next `YYYY.MM.DD.N` version from today's date and the
 * existing git tags, then rewrites `src/i18n/releaseNotes.json`: the
 * `upcoming` section becomes that version (dated today) and a fresh empty
 * `upcoming` is prepended. The workflow commits the result, pushes, builds,
 * deploys, and creates a matching GitHub Release.
 *
 * The version-resolution and JSON-rewrite logic lives in
 * `src/lib/releaseVersioning.ts` so it is unit-tested by Jest; this file only
 * does the filesystem/git plumbing.
 *
 * Run with Node 24's built-in TypeScript support:
 *   node scripts/release.ts
 * Optional env:
 *   RELEASE_DATE=YYYY-MM-DD   override the release date (defaults to UTC today)
 *   GITHUB_OUTPUT=<file>      when set, appends `version=<version>`
 */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  applyRelease,
  nextReleaseVersion,
} from "../src/lib/releaseVersioning.ts";
import type { ReleaseNotesData } from "../src/i18n/releaseNotes.ts";

const RELEASE_NOTES_PATH = fileURLToPath(
  new URL("../src/i18n/releaseNotes.json", import.meta.url),
);

/** UTC `YYYY-MM-DD` for the release date (overridable for reproducibility). */
function releaseDateIso(): string {
  const override = process.env.RELEASE_DATE;
  if (override) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(override)) {
      throw new Error(`Invalid RELEASE_DATE: ${override} (want YYYY-MM-DD)`);
    }
    return override;
  }
  return new Date().toISOString().slice(0, 10);
}

/** Existing released versions, derived from `vX` git tags. */
function existingVersions(): string[] {
  let raw = "";
  try {
    raw = execSync("git tag --list", { encoding: "utf8" });
  } catch {
    return [];
  }
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((tag) => (tag.startsWith("v") ? tag.slice(1) : tag));
}

function main(): void {
  const dateIso = releaseDateIso();
  const dateDots = dateIso.replaceAll("-", ".");
  const version = nextReleaseVersion(dateDots, existingVersions());

  const data = JSON.parse(
    readFileSync(RELEASE_NOTES_PATH, "utf8"),
  ) as ReleaseNotesData;
  const updated = applyRelease(data, version, dateIso);
  writeFileSync(RELEASE_NOTES_PATH, JSON.stringify(updated, null, 2) + "\n");

  // Expose the resolved version to the workflow.
  process.stdout.write(`${version}\n`);
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `version=${version}\n`);
  }
}

main();
