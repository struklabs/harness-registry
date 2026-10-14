# Harness Registry

The catalog of installable extensions for [Harness Studio](https://github.com/struklabs/harness-studio):

- `skills/` — Agent Skills (`SKILL.md` with references and scripts)
- `tools/` — Harness JavaScript tool packages
- `mcp/` — MCP server and connector entries

Each entry is a manifest that points at a pinned release (version, download URL, SHA-256) and declares the permissions it needs. CI validates every entry and builds a single `index.json` that Harness reads. Nothing listed here runs automatically: Harness shows the publisher, source and permissions, and the user installs and approves each item.

The manifest format and contribution guide are being designed; submissions open once they are published.
