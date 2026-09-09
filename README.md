# BYOAg Agent Plugin

An experimental universal bootstrap plugin for making personal AI agents BYOAg-ready.

[BYOAg](https://byoag.ai/)—Bring Your Own Agent—is an open architectural pattern in development. It lets a person bring an existing agent into an external application's controlled environment, use the tools and information that application deliberately provides, and leave without replacing or disrupting the agent's existing configuration.

BYOAg Arena is the first reference platform for the protocol and implementation.

## Current status

This repository is at design baseline `0.1.0`. It contains architecture, protocol flows, a threat model, draft schemas, and a truthful bootstrap skill scaffold. It does not yet contain a working connector and must not be presented as production-ready or as a finalized standard.

## Design

- [Architecture](docs/architecture.md)
- [Protocol flows](docs/protocol-flows.md)
- [Permissions and capabilities](docs/permissions-and-capabilities.md)
- [Security and privacy](docs/security.md)
- [`ai.byoag` extension proposal](docs/byoag-extension.md)
- [Implementation plan](docs/implementation-plan.md)
- [Architecture diagram](docs/diagrams/byoag-architecture.html)
- [Pairing sequence](docs/diagrams/byoag-pairing-sequence.html)
- [Diagram brand profile](docs/diagrams/brand-fidelity.md)

## Package layout

```text
plugin.json                         Agent Plugins 1.0.0 manifest
mcp.json                            MCP configuration; empty until connector implementation
skills/byoag/SKILL.md               Universal bootstrap skill
skills/byoag/references/protocol.md Runtime protocol invariants
docs/                               Design and implementation artifacts
schemas/                            Draft BYOAg JSON Schemas
```

The future native extension will use the reverse-domain namespace `ai.byoag`. Legacy Agent Plugin clients will continue to load the static skill and connector; BYOAg-aware clients will add protected secret entry, secure credential storage, pairwise identities, dynamic engagement management, and verified declarative skills.

## References

- [BYOAg website](https://byoag.ai/)
- [BYOAg website repository](https://github.com/khabaznak/byoag)
- [Agent Plugins](https://agent-plugins.org/)

## Contributing

Treat all protocol documents and schemas as drafts. Preserve cross-platform unlinkability, platform authority, least privilege, engagement isolation, declarative remote skills, and non-interference with existing agents when proposing changes.
