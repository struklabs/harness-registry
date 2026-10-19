---
name: "release-notes"
description: "Turn supplied changes or a diff into user-facing release notes. Use when preparing a changelog or release announcement."
license: "MIT"
---

# Release notes

Use the supplied changes, commit log, or diff as evidence. If none is available, ask for it. Do not infer shipped behavior from a branch name or issue title.

Group changes by their effect on users: additions, fixes, and breaking changes. Omit empty groups. Lead each bullet with the changed behavior and explain when it matters; omit internal refactors unless they affect users.

For each breaking change, include the previous behavior, new behavior, and migration action supported by the evidence. Mark missing migration details as unresolved instead of inventing commands. Do not claim tests passed, a vulnerability was fixed, or a release is available unless the supplied material establishes it.

Use the requested language and release version. If no version is given, label the draft Unreleased. Preserve issue links supplied by the user and avoid exposing secrets or internal-only details. Return a Markdown draft for review; publishing is a separate action.
