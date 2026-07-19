# Release & Release Notes Guide

DYA Studio ships from `main` via a manually triggered release, and every release
is recorded in the in-app **Release Notes** page
(`https://studio.dya.cormoran.works/release-notes`).

## Versioning

Versions are date based: `YYYY.MM.DD.N`, where `N` starts at `0` and increments
for each additional release on the same day (e.g. `2026.04.01.0`,
`2026.04.01.1`). The version is decided by the release CI at dispatch time — you
never set it by hand.

## How a release happens

The **Release DYA Studio** workflow (`.github/workflows/release.yml`) is run
manually (`workflow_dispatch`). It:

1. Runs `node scripts/release.ts`, which resolves the next `YYYY.MM.DD.N` from
   today's date and existing git tags, then rewrites
   `src/i18n/releaseNotes.json`: the `upcoming` section becomes that version
   (dated today) and a fresh empty `upcoming` is prepended.
2. Commits that change to `main`, tags it `vYYYY.MM.DD.N`, and pushes.
3. Builds and deploys to Cloudflare Pages.
4. Creates a GitHub Release whose body links to the matching section of the
   release notes page (`/release-notes#YYYY.MM.DD.N`).

The version-resolution and JSON-rewrite logic lives in
`src/lib/releaseVersioning.ts` and is unit-tested
(`src/lib/__tests__/releaseVersioning.test.ts`).

## Editing release notes in a PR

**When your PR adds or changes something a user would notice, add an entry to
the `upcoming` section of `src/i18n/releaseNotes.json`.**

- The `upcoming` section is the first entry in `releases`, with
  `"version": "upcoming"`. **If it is missing, create it** at the top of
  `releases`:

  ```json
  {
    "version": "upcoming",
    "date": null,
    "changes": { "major": [], "minor": [], "patch": [] }
  }
  ```

- Add each change as an object under the right category with **both English and
  Japanese** text:

  ```json
  { "en": "Short user-facing description.", "ja": "利用者向けの短い説明。" }
  ```

- Optionally reference the pull request(s) with a `pr` field — a single number
  or an array. It renders as a `#123` link to GitHub on the release notes page:

  ```json
  { "en": "Added X.", "ja": "X を追加しました。", "pr": 153 }
  { "en": "Reworked Y.", "ja": "Y を刷新しました。", "pr": [150, 128] }
  ```

- Write from the user's perspective (what changed for them), not the
  implementation. Keep each entry to one sentence.

Purely internal changes (refactors, test-only changes, CI tweaks, dependency
bumps with no user-visible effect) do **not** need an entry.

## Classifying a change: major / minor / patch

Put each entry under the category that matches its user impact:

- **major** — new capability or a significant, visible change to how the app
  works: a new tab/page, a new editor, a redesign, a new integration, or
  anything that changes existing behavior in a way users must notice.
- **minor** — a new but self-contained enhancement to existing functionality:
  an added option, a new control, a quality-of-life improvement, a performance
  win users can feel.
- **patch** — bug fixes, small polish, copy/wording updates, and other
  corrections that don't add functionality.

When in doubt, pick the lower category (a fix is a `patch`, not a `minor`).
