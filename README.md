# BYOAg Agent Plugin

An experimental universal bootstrap plugin for making personal AI agents BYOAg-ready.

[BYOAg](https://byoag.ai/)—Bring Your Own Agent—is an open architectural pattern in development. It lets a person bring an existing agent into an external application's controlled environment, use the tools and information that application deliberately provides, and leave without replacing or disrupting the agent's existing configuration.

BYOAg Arena is the first reference platform for the protocol and implementation.

## Current status

This repository contains an experimental generic connector and an in-memory reference host at `0.1.0`. It implements signed domain-bound discovery, DPoP-protected pairing, local pairwise identities, registration listing, signed engagement retrieval, revocation, and disconnect. It remains a development implementation: the protocol is not finalized, the compatibility vault is not an OS-backed secure store, and the reference host is not production infrastructure.

## Build and test

The connector requires Node.js 20 or newer. From a source checkout:

```bash
npm install
npm test
npm run build
```

Run only the black-box protocol suite with `npm run conformance`. Run the loopback reference host manually with `npm run reference-host`.

`mcp.json` launches `node ${PLUGIN_ROOT}/dist/src/index.js` and stores connector state beneath `${PLUGIN_DATA}/byoag`. A source checkout must therefore be built before it is loaded as an Agent Plugin. Packaged distribution automation is not yet included.

The MCP server exposes:

- `byoag_discover`
- `byoag_begin_pairing`
- `byoag_complete_pairing`
- `byoag_list_registrations`
- `byoag_list_engagements`
- `byoag_disconnect`

Compatibility mode can receive a one-time pairing code through the model-visible tool argument. For terminal-based protected entry, build the project and run:

```bash
BYOAG_DATA_DIR=/the/same/plugin/data/directory node dist/src/secret-cli.js
```

The command reads without echo and returns an opaque, single-use reference for `byoag_complete_pairing`. Full-conformance clients should provide their own protected input and secure-vault adapter.

## Design

- [Architecture](docs/architecture.md)
- [Protocol flows](docs/protocol-flows.md)
- [Connector HTTP binding](docs/connector-http-binding.md)
- [BYOAg 0.1 cryptographic profile](docs/security-profile.md)
- [Reference host](docs/reference-host.md)
- [Conformance suite](docs/conformance.md)
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
mcp.json                            Local stdio connector configuration
byoag.json                          Native ai.byoag bootstrap extension manifest
package.json                        Connector dependencies and build commands
src/                                Generic connector and stdio MCP implementation
tests/                              Protocol, storage, and MCP integration tests
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
