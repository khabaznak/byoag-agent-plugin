# BYOAG Agent Plugin

This repository creates a portable Agent Plugin that makes AI agents BYOAg-ready: able to enter an external, environment-controlled experience and use the tools and data it makes available on a person's behalf. The model is analogous to a person visiting a gym, hospital, or school: they use that environment's facilities for a purpose and then leave.

The repository owner is the creator and steward of the BYOAg pattern, website, and technology. Treat their direction as authoritative for product intent, terminology, and protocol evolution; surface decisions that would materially redefine the pattern rather than making them unilaterally.

## Project references and intent

- [BYOAg](https://byoag.ai/) and its [source repository](https://github.com/khabaznak/byoag) define the project's conceptual direction. BYOAg (Bring Your Own Agent) is an experimental open architectural pattern, not a finalized standard, vendor-owned product, or production guarantee. Preserve that framing in documentation and user-facing copy.
- [Agent Plugins](https://agent-plugins.org/) defines the package format this project uses. Build against its 1.0.0 portable core: a root `plugin.json`, optional root `mcp.json`, and Agent Skills in immediate child directories of `skills/`. Keep distribution, installation, permissions, authentication, and client-specific UX outside the portable contract unless a client extension explicitly requires them.

## Design principles

- Treat the external application as the owner of its environment, tools, data, and access policies; the user brings and controls their agent.
- Design for clear trust boundaries, least privilege, explicit user intent, and a clean exit from the host environment.
- Keep the portable core vendor-neutral. Put client-specific behavior only under a reverse-domain extension namespace in `plugin.json`.
- Do not embed credentials or authentication material in the plugin. Agent Plugins leaves authentication client-managed; remote MCP headers must be literal package data and must not contain secrets.

## Repository layout

- `plugin.json` contains the plugin metadata and declares bundled capabilities.
- `mcp.json` defines any MCP server configuration exposed by the plugin.
- `byoag.json` declares the draft `ai.byoag` bootstrap extension.
- `src/` contains the generic connector and MCP runtime.
- `tests/` contains protocol, storage, and MCP integration coverage.
- `src/reference-host/` is the in-memory, loopback-only protocol test host; it is not a production application template.
- `skills/byoag/SKILL.md` is the entry point for the BYOAG skill.
- `skills/byoag/references/` contains focused reference material used by the skill.
- `docs/` contains the protocol architecture, threat model, extension proposal, implementation plan, and diagrams.
- `schemas/` contains independently versioned draft BYOAg JSON Schemas.
- `.diagram-design` selects the BYOAg visual profile for project diagrams.
- `README.md` explains installation, configuration, and use.

## Editing guidance

- Keep `SKILL.md` concise and procedural. Move background, schemas, examples, and long specifications into `references/`.
- Use relative links from `SKILL.md` to files in `references/`.
- Treat `plugin.json` and `mcp.json` as machine-readable JSON: use two-space indentation and valid JSON only—no comments or trailing commas.
- Use the Agent Plugins 1.0.0 schema URLs in the root JSON files. The manifest must declare its `$schema` and a valid lowercase name; `mcp.json`, when present, may contain only `$schema` and `mcpServers` at its top level.
- Add new skill-specific material under `skills/byoag/`; do not place it at the repository root.
- Keep `skills/byoag/SKILL.md` directly under the skill directory. Clients discover only immediate children of `skills/`, not nested skills.
- Keep protocol-level design in `docs/` and machine contracts in `schemas/`; reflect runtime-critical invariants concisely in the skill reference.
- Treat every protocol, profile, capability, and remote skill bundle as independently SemVer-versioned.
- Update `README.md` whenever installation, configuration, or behavior changes.
- Do not commit credentials, access tokens, generated artifacts, or local environment files.

## Validation

Before finishing a change:

1. Confirm JSON files parse and conform to the Agent Plugins 1.0.0 schemas.
2. Check every Markdown link and referenced file path, including the two project references above.
3. Confirm the plugin does not claim BYOAg is finalized or imply that it owns a host application's data, tools, or authorization decisions.
4. Review `git diff --check` for whitespace errors.
5. Keep the working tree limited to files relevant to the change.
