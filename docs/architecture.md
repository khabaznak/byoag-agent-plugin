# BYOAg architecture

Status: working draft 0.1.0
Reference platform: BYOAg Arena

BYOAg lets a person bring an existing AI agent into an external platform, use capabilities and information that platform deliberately provides, and leave without changing the agent's global configuration. The platform remains authoritative for accounts, roles, permissions, policy, regulation, pricing, and enforcement.

This document defines the target architecture. It does not claim that the protocol or implementation is production-ready.

## Architectural commitments

1. A universal bootstrap plugin can connect one agent to many BYOAg-enabled platforms.
2. Platforms are discovered from their own HTTPS domain at `/.well-known/byoag.json`.
3. The human links an agent to an existing platform account with a short-lived, single-use passcode.
4. Agent identities are pairwise by default so platforms cannot correlate the same agent without explicit user consent.
5. A persistent registration may contain multiple simultaneous, isolated engagements.
6. The platform assigns the role and maximum permissions; the user can narrow the delegation in platform-owned controls.
7. MCP exposes authenticated, role-appropriate tools. Signed declarative skill bundles teach the agent how to use them.
8. Remotely supplied BYOAg skills contain no executable scripts or binaries.
9. BYOAg is additive and engagement-scoped. It must not alter or disable the agent's existing configuration.
10. Full-conformance clients isolate credentials and pairing codes from model context.

## Two delivery layers

### Layer 1: backward-compatible bootstrap

The portable [Agent Plugin](https://agent-plugins.org/) contains:

- A static BYOAg bootstrap skill.
- A local MCP connector once the implementation phase begins.
- A standard root `plugin.json` and `mcp.json`.
- No platform-specific credentials, roles, tools, or executable remote skills.

Existing Agent Plugin clients can load this layer. Until the local connector exists, the package is a design scaffold and must not claim to establish live connections.

### Layer 2: native BYOAg extension

A BYOAg-aware client recognizes the reverse-domain extension namespace `ai.byoag`. Native support adds:

- Protected pairing-code entry outside model context.
- Secure key and credential storage.
- First-class connection and engagement management.
- Signed dynamic skill activation.
- Capability resolution and permission presentation.
- Data-label propagation and cross-tool policy enforcement.
- Clean teardown of engagement-scoped tools, skills, context, and credentials.

Legacy clients ignore the extension and continue loading the portable core.

## Components

### Human

Authenticates to the platform, starts agent pairing, reviews platform-owned delegation controls, supplies the one-time code, and may revoke or narrow access at any time.

### Agent client or harness

Hosts the user's model, existing tools, existing skills, and local policies. A full-conformance client provides a protected secret-entry surface and secure credential vault. Its safety policy may be stricter than the platform grant but cannot expand it.

### Universal BYOAg plugin

Provides the bootstrap skill and connector contract. It discovers platforms, validates descriptors and signatures, manages pairwise identities, negotiates registrations and engagements, and exposes only the active engagement's authorized capabilities.

### BYOAg connector

A trusted local component that mediates network calls without revealing credentials to the model. It owns platform-specific key material, registration credentials, engagement leases, skill verification, and tool routing.

### Platform connection bay

The platform-controlled BYOAg boundary. For BYOAg Arena this service publishes discovery metadata, redeems pairing codes, binds agents to player accounts, creates engagements, evaluates delegation policy, issues short-lived grants, and records auditable actions.

### Platform MCP service

Exposes tools dynamically according to the authenticated engagement. Authorization is enforced on every call. Tool availability is not evidence of approval; each invocation is re-evaluated against the current server-side policy.

### Skill and capability registry

The platform publishes signed, content-addressed skill bundles and mappings from concrete MCP tools to versioned BYOAg capabilities. Community domain profiles may be reused; platform-only capabilities remain namespaced.

## Identity and relationship model

BYOAg distinguishes four concepts:

- **Human account:** the person's account in a platform.
- **Local agent:** the user's durable concept of an agent, such as Alphonse.
- **Agent installation:** a device or harness instance that holds a key.
- **Platform registration:** a platform-local binding among the human, pairwise agent identity, installation, and registration policy.

A platform sees only its pairwise agent identifier unless the user deliberately discloses a shared identity. A computer change may generate a new installation key. The platform decides whether that is a replacement, key rotation, or new registration. Agentic conversations and memories are not required to migrate with identity.

## Engagement model

A registration can own many engagements. Each engagement has its own:

- Identifier and platform context.
- Platform-assigned role.
- Delegation grant and expiration.
- Capability set and MCP tool mappings.
- Signed skill bundle versions.
- Data-handling labels.
- Audit stream and revocation state.

Every invocation names exactly one engagement. Tools, credentials, context, or data from one engagement must never be silently reused in another.

## Authority calculation

Effective authority is the intersection of:

```text
platform maximum permissions
∩ user delegation configured on the platform
∩ agent-client safety policy
= effective capabilities
```

The platform performs the final enforcement. A client may refuse an action or request additional confirmation, but it cannot make an action permissible when the platform denies it.

## Capability model

BYOAg uses a hybrid compatibility model:

- Core operations and risk semantics use a reviewed universal vocabulary.
- Domain profiles define reusable capability contracts such as `game.match.join` or `commerce.order.create`.
- Common profiles may standardize canonical input and output schemas.
- Platforms annotate concrete MCP tools with implemented capability IDs and versions.
- Platform-specific behavior uses a controlled namespace such as `arena.byoag.tournament.enter`.
- Skills declare required and optional capability version ranges rather than hard-coding vendor tool names.

All protocol, profile, capability, and skill-bundle versions follow Semantic Versioning independently.

## Non-interference boundary

Starting an engagement creates a temporary overlay. It does not uninstall, disable, rewrite, or reorder existing skills, MCP servers, memories, hooks, or agent instructions. Platform policy applies only to the engagement and data derived from it.

Local computation remains available when requested by the user and allowed by the data-handling policy. BYOAg skills cannot cause downloaded code to execute. Consequential operations are performed through authorized MCP tools.

## Architectural diagrams

- [System and trust boundaries](diagrams/byoag-architecture.html)
- [Discovery, pairing, and engagement sequence](diagrams/byoag-pairing-sequence.html)

## Sources

- [BYOAg](https://byoag.ai/)
- [BYOAg website repository](https://github.com/khabaznak/byoag)
- [Agent Plugins](https://agent-plugins.org/)
- [Model Context Protocol](https://modelcontextprotocol.io/)
