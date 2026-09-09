# Permissions and capabilities

Status: working draft 0.1.0

BYOAg uses a shared vocabulary so platforms can describe authority consistently and skills can be reused without depending on vendor-specific MCP tool names.

## Permission model

The effective authority for an engagement is the strict intersection of:

1. The platform's maximum role permissions.
2. The user's narrower delegation configured through the platform.
3. The client or agent's local safety policy.

The platform enforces the result on every call. BYOAg communicates authority; it does not replace the platform's authorization system.

## Permission layers

### Connection permissions

Durable permissions needed to maintain the account-agent relationship, such as viewing available Arena contexts. They do not automatically grant permission to act inside every context.

### Engagement permissions

Role- and context-specific permissions, such as joining one match, reading that match's public state, or submitting a move.

### Runtime permissions

Single-action confirmation requirements for sensitive operations. A runtime confirmation is narrow, short-lived, audience-bound, and protected against replay.

## Universal operation vocabulary

The reviewed core registry should begin with a small set of stable operations:

- `read`: observe an existing resource without disclosing it outside the engagement.
- `reveal`: disclose protected information to the agent.
- `create`: create a resource without implying a financial transaction.
- `modify`: change an existing resource.
- `delete`: remove or make a resource unavailable.
- `execute`: initiate a non-financial operation with an external side effect.
- `transact`: create a financial or economically binding commitment.
- `communicate`: send content to another person, group, or public audience.
- `delegate`: grant authority to another principal.
- `administer`: change permissions, policy, membership, or security configuration.

Operations are not permissions by themselves. A permission combines an operation, resource, context, data classes, constraints, and confirmation rule.

## Effects and data classes

Capabilities declare machine-readable effects such as:

- `external_side_effect`
- `financial_commitment`
- `public_disclosure`
- `identity_or_permission_change`
- `irreversible_or_hard_to_reverse`
- `regulated_action`

Initial cross-domain data classes should include:

- `public`
- `account`
- `identity`
- `contact`
- `location`
- `financial`
- `health`
- `education`
- `employment`
- `communications`
- `platform_confidential`

Domain profiles may refine these classes without changing their broader meaning.

## Data-handling policy

Platform data carries engagement-scoped handling labels. A policy may distinguish:

- Model visibility.
- Ephemeral local computation.
- Local persistence.
- Transmission to another tool.
- Transmission to another platform or engagement.
- Human disclosure.
- Retention deadline.

Restrictions apply to the labeled data, not globally to the user's agent. Existing tools remain installed and usable for unrelated work.

## Capability contracts

A capability definition contains:

- Stable capability ID.
- Independent SemVer version.
- Operation and resource semantics.
- Effects, reversibility, and data classes.
- Required permission scopes.
- Optional canonical input and output schemas.
- Confirmation and idempotency requirements.
- Registry and namespace provenance.

Example:

```json
{
  "id": "game.move.submit",
  "version": "1.0.0",
  "operation": "execute",
  "resource": "game.move",
  "effects": ["external_side_effect"],
  "reversible": false,
  "permission": "game.move.execute",
  "canonicalSchemas": {
    "input": "https://byoag.ai/profiles/game/1.0/schemas/move-input.json",
    "output": "https://byoag.ai/profiles/game/1.0/schemas/move-output.json"
  }
}
```

## Concrete MCP tool mappings

Platforms may keep domain-appropriate tool names and schemas. The engagement descriptor maps each authorized tool to a capability contract:

```json
{
  "tool": "arena_submit_move",
  "implements": {
    "capability": "game.move.submit",
    "version": "1.0.0",
    "schemaCompatibility": "canonical"
  }
}
```

`canonical` means the tool accepts and returns the profile's canonical schemas. `adapted` means the connector or skill must use the supplied mapping. `semantic-only` means the behavior shares semantics but no canonical schema is claimed.

## Skill requirements

Skills declare required and optional capability version ranges:

```yaml
requires:
  - capability: game.state.read
    version: ">=1.0.0 <2.0.0"
  - capability: game.move.submit
    version: ">=1.0.0 <2.0.0"
optional:
  - capability: game.chat.communicate
    version: ">=1.0.0 <2.0.0"
```

A resolver activates the skill only when every required capability is authorized and compatible. Optional capability absence removes only the corresponding behavior.

## Namespaces and governance

- `byoag.*` is reserved for protocol-level concepts maintained through the reviewed BYOAg core process.
- Reviewed domain profiles use stable domain namespaces such as `game.*`, `commerce.*`, or `education.*`.
- Community publishers may propose or publish namespaced profiles.
- Platform-specific capabilities use a controlled namespace tied to the platform, such as `arena.byoag.*`.
- A platform-specific capability must not masquerade as a reviewed core capability.

Foundational meanings such as `read`, `delete`, `transact`, and `reveal` change only through a reviewed, versioned governance process. Anyone may innovate in a namespace they control.

## Versioning

The core protocol, domain profiles, individual capability contracts, and skill bundles use independent Semantic Versions. A breaking semantic, required-field, schema, side-effect, or authorization change requires a major version. Resolvers must not silently widen compatible ranges.
