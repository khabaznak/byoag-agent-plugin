# BYOAg implementation plan

Status: planning baseline 0.1.0
Reference integration: BYOAg Arena

The first deliverable is a backward-compatible universal bootstrap plugin plus a clearly separated native `ai.byoag` extension specification. BYOAg Arena serves as the first host implementation and portability reference.

## Phase 0 — design baseline

Deliverables:

- Architecture, protocol-flow, permission/capability, extension, and security documents.
- Branded architecture and pairing diagrams.
- Initial JSON Schemas.
- Valid Agent Plugins manifest, MCP configuration, and bootstrap skill scaffold.
- Recorded open decisions and explicit draft status.

Exit criteria:

- All JSON parses and validates against its declared schema where tooling permits.
- All internal Markdown links resolve.
- The package makes no claim of a working live connector.

## Phase 1 — bootstrap connector skeleton

Build a local stdio MCP connector and reference it from `mcp.json`. TypeScript on a current Node.js LTS release is the tentative implementation choice because it is portable and has mature MCP and JSON Schema tooling; confirm against the existing BYOAg Arena stack before committing.

Initial connector tools:

- `byoag_discover(domain)`
- `byoag_begin_pairing(domain)`
- `byoag_complete_pairing(connection, protected_code_reference)`
- `byoag_list_registrations()`
- `byoag_list_engagements(registration)`
- `byoag_disconnect(registration)`

Compatibility mode may accept a one-time code value only with an explicit warning. Long-lived credentials never appear in tool results.

Exit criteria:

- Discovery is domain-bound and schema-validated.
- Credentials are isolated from model-visible responses.
- Connector shutdown and removal do not change unrelated agent configuration.

## Phase 2 — BYOAg Arena connection bay

Implement in Arena:

- `/.well-known/byoag.json`.
- Authenticated **Add my agent** UI.
- One-time code issuance and redemption.
- Optional post-redemption platform confirmation.
- Pairwise agent and installation registration.
- Registration limits, replacement, revocation, and audit views.

Exit criteria:

- A user pairs a fresh connector installation end to end.
- Invalid, expired, replayed, and rate-limited codes fail safely.
- Arena shows the human and agent the same registration state.

## Phase 3 — engagements, permissions, and MCP tools

Implement platform-assigned roles, user-narrowed delegation, multiple simultaneous engagements, short-lived engagement credentials, and Arena MCP tool filtering.

Start with a small game profile:

- `game.context.read`
- `game.state.read`
- `game.match.join`
- `game.move.submit`
- `game.chat.communicate` as optional

Exit criteria:

- Two simultaneous engagements remain isolated.
- Every invocation is authorized server-side against its engagement.
- Permission denial yields either reduced behavior or a clear blocked-role result.
- Revocation removes access immediately.

## Phase 4 — signed declarative skills

Implement a signed Arena role-skill bundle, content digests, SemVer resolution, capability requirements, caching, update checks, and rejection of executable content.

Exit criteria:

- Modified or unsigned content fails verification.
- Optional capability absence degrades the skill cleanly.
- Material scope expansion requires renewed platform-presented consent.
- Skill activation and teardown leave existing skills unchanged.

## Phase 5 — native `ai.byoag` client extension

Implement native UI and secure services in at least one compatible agent client:

- Protected code and confirmation entry.
- Secure vault and key operations.
- Registration and engagement management UI.
- Permission summaries and diffs.
- Data-label enforcement.
- Native dynamic-skill lifecycle.

Exit criteria:

- Pairing codes and credentials never enter model context.
- Pairwise identities differ across test platforms.
- Client conformance tests verify non-interference and clean teardown.

## Phase 6 — registry and ecosystem

Publish the core vocabulary, initial game domain profile, contribution process, namespace rules, and compatibility test suite. Add a second small reference platform to prove the bootstrap is not Arena-specific.

Exit criteria:

- A reusable skill resolves equivalent capabilities on two independent platforms.
- Breaking and additive version changes behave according to SemVer.
- Community namespaces cannot redefine reviewed core meanings.

## Cross-cutting workstreams

### Protocol and schemas

Stabilize wire objects, error codes, HTTP bindings, MCP metadata, signatures, proof of possession, and revocation semantics.

### Security

Threat-model each phase, test malicious descriptors and skills, verify redaction, and obtain independent review before a production-readiness claim.

### Developer experience

Provide a host SDK, connector SDK, schema validator, local test host, conformance CLI, examples, and migration guidance.

### Observability

Correlate registration, engagement, capability, tool invocation, confirmation, and result without logging reusable secrets or unnecessary user content.

## Immediate backlog

1. Review and accept the Phase 0 terminology and object boundaries.
2. Decide the concrete signature and proof-of-possession profile.
3. Inventory BYOAg Arena's current language, authentication, and deployment stack.
4. Define the first Arena role and its minimum capability set.
5. Turn the initial schemas into protocol conformance fixtures.
6. Scaffold the connector only after its secure-storage interface is agreed.

## Explicitly deferred

- Global agent identity or cross-platform correlation.
- Agent-session and memory migration between computers.
- Executable remote skills, scripts, binaries, hooks, or installers.
- Centralized discovery as a trust root.
- Portable billing semantics.
- Claims of production security or finalized-standard status.
