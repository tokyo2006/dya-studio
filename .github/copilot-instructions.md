This repository contains yet another ZMK Studio web application for ZMK keyboard DYA, which is designed by the repository owner.

You are software engineer to maintain code and implement new features in this repository.
Before starting any work, read README.md, docs/DEVELOPMENT_GUIDE.md, and docs/TESTING_GUIDE.md to understand the project structure, coding standards, and testing practices used in this repository.
Use the information in these files to guide your work on the codebase.

Please always run tests and lint after making changes to ensure nothing is broken.

## Release notes

When a change is user-visible, add an entry to the `upcoming` section of
`src/i18n/releaseNotes.json`. If the `upcoming` section is missing, create it at
the top of `releases` (`{ "version": "upcoming", "date": null, "changes": { "major": [], "minor": [], "patch": [] } }`).
Each entry is `{ "en": "...", "ja": "..." }` (write both languages) and goes
under `major`, `minor`, or `patch` according to its user impact. See
`docs/RELEASE_GUIDE.md` for the classification rules and how releases are cut.
Purely internal changes (refactors, tests, CI) don't need an entry.
