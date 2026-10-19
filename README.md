# Harness Registry

Versioned catalog of official **StrukLabs-maintained** Skills, JavaScript Tools, and MCP configurations for [Harness Studio](https://github.com/struklabs/harness-studio). Maintainers add content through pull requests. No community submissions, package signing, moderation, or admin panel. For third-party MCP services, StrukLabs maintains the configuration, not the upstream server.

## Structure and metadata

```text
index.schema.json           Index envelope schema (schema_version: 1)
index.json                  Generated and committed; entries sorted by id
schemas/entry.schema.json   Shared entry metadata and permissions
schemas/skill.schema.json   Skill entry schema
schemas/mcp.schema.json     MCP entry schema
schemas/tool.schema.json    Tool entry schema
schemas/tool-package.schema.json  Harness runtime manifest subset
schemas/mcp-config.schema.json    Harness credential-free MCP subset
skills/<name>/catalog.json + SKILL.md
tools/<name>/catalog.json + manifest.json + index.js + optional test.js
mcp/<name>/catalog.json + config.json
scripts/                    Dependency-free Node.js build, validation, tests
```

Each `catalog.json` has a stable `struklabs.<type>.<directory>` id, type, publisher, display name, English/Turkish descriptions (`description.en` / `.tr`), SemVer version, license, HTTPS homepage/source, platforms (`windows`, `macos`, `linux`), permissions, tags, minimum Harness version, and an `artifact` path. Tool artifacts name a package directory; skill/MCP artifacts name a file. Resolve paths against the same checkout or Git revision as the index. The index embeds complete metadata without timestamps or absolute paths. Entry versions describe our artifacts, not upstream hosted deployments. Breaking format changes require a new `schema_version` and schema update.

## Included entries and compatibility

- **JSON Formatter**: import `tools/json_format` as a Harness JS tool package. Pretty-print, compact, or recursively sort JSON without file/network access. Numbers use JavaScript precision and numeric-looking keys follow JavaScript enumeration order; this is not cryptographic canonicalization.
- **Release Notes**: `skills/release-notes/SKILL.md` drafts user-facing notes from supplied evidence, following the [Agent Skills specification](https://agentskills.io/specification). The inspected Harness 0.1.0 source has no native Skills loader: use its instructions in an agent/system prompt today, or load the directory in an Agent Skills client. `min_harness_version` is a content compatibility floor, not a claim of native Skills discovery or registry installation.
- **Microsoft Learn**: merge `mcp/microsoft-learn/config.json`'s server into Harness's `mcpServers` configuration, or add its URL with HTTP transport in MCP settings. [Microsoft documents the official Streamable HTTP endpoint](https://learn.microsoft.com/en-us/training/support/mcp) and its lack of authentication requirements. The MIT license covers our configuration; Microsoft's service has its own linked terms.

Formats checked against Harness Studio revision `c9894a69acca2d18f2a6cfe0bfed22b6e4f4971e`: `crates/harness-core/src/tools/package.rs`, `js_engine.rs`, `tools/builtin/http.rs`, and `mcp.rs`. This repository publishes metadata/content; it does not add an installer to Harness.

## Permissions

The catalog uses Harness's JS package fields verbatim:

```json
{
  "network": ["example.com", "*.example.org"],
  "fs": { "read": ["."], "write": ["out"] },
  "shell": false
}
```

Empty lists grant nothing. Network scopes are lowercase hostnames, never URLs, ports, or paths. Exact hosts match only themselves; `*.example.org` matches subdomains, excluding the apex. Harness checks redirects and rejects private/link-local destinations even for listed hosts. File scopes name folders relative to the chat workspace; `.` means the whole workspace. Absolute paths, parent traversal, drive prefixes, and backslashes are rejected. JS packages cannot request shell access. Catalog permissions must match the runtime manifest exactly. Harness classifies writes as dangerous, network/reads as restricted, and no capabilities as safe.

Instruction-only skills have empty capability lists. For MCP entries these fields describe expected endpoints, **not a sandbox applied to the MCP server**. MCP uses Harness's independent approval flow. Never embed credentials; configure secrets locally in Harness.

## Add or update an entry (maintainers)

1. Create a directory under `skills/`, `tools/`, or `mcp/`. Copy a matching `catalog.json` and follow its type-specific schema. Every directory in those roots must contain a complete entry; ids must be unique.
2. Add working content. Tools need Harness's strict `manifest.json` and `function run(args)` entry point. No Node APIs, imports, or ambient `fetch` exist in QuickJS. Optional `test.js` uses Harness's `const cases = [...]` format. Skills need a matching directory/frontmatter name and useful instructions. To avoid a YAML dependency, catalog frontmatter allows flat `name`, `description`, `license`, and optional `compatibility` fields with JSON-quoted YAML string values; description/license must match catalog metadata. MCP configs contain exactly one credential-free server: HTTP uses `url` plus Harness's `transport` (`http`, `sse`, `auto`); stdio uses `command` and `args`. Pin stdio package versions and document prerequisites.
3. Verify behavior in Harness. Set platforms and minimum version honestly. Bump the entry version when shipped content changes; tool package/catalog versions must agree. Include upstream documentation and licensing details for services.
4. With Node.js 22 or newer, run:

   ```sh
   node scripts/build-index.mjs
   node scripts/validate.mjs
   node --test scripts/test.mjs
   ```

5. Open a maintainer PR containing the artifact, metadata, and regenerated index. CI runs only `validate.mjs` for catalog changes on PRs and pushes to main. It validates all entries and artifacts, rejects symlinks/unsafe paths, checks runtime metadata/permissions, and fails if the committed index differs byte-for-byte from a deterministic build. Validation does not rewrite files, execute tools, or contact upstream services. No npm install is required; scripts work independently of cwd.

The small JSON Schema evaluator implements only the keywords used here and rejects unknown keywords during evaluation. Extend it and tests together when adding schema features. Catalog validation intentionally accepts a stricter subset than Harness (explicit permissions, SemVer, credential-free configs). Harness remains responsible for runtime policy and approvals. Node VM tests exercise tool logic but do not replace a Harness QuickJS integration test.
