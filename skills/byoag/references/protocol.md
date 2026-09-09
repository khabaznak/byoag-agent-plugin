# BYOAg protocol reference

BYOAg is an experimental protocol for bringing a user-controlled agent into an external platform's controlled environment. The universal bootstrap discovers the platform, pairs a pairwise agent identity to an existing human account, and activates one or more isolated engagements.

## Core invariants

- First-time discovery begins at `https://<domain>/.well-known/byoag.json`.
- The exact domain is the trust anchor; a brand name or search result is not.
- Pairing codes are short-lived, single-use, rate-limited, and separate from URLs.
- Full-conformance clients keep pairing codes, private keys, and credentials outside model context.
- Each platform receives a different pairwise agent identifier by default.
- The platform assigns the role and maximum authority. The user can narrow the delegation through platform-owned controls.
- One registration may contain multiple concurrent engagements; each invocation names exactly one.
- MCP exposes engagement-authorized tools. Platform authorization is re-evaluated server-side for every action.
- Remote skills are signed, content-addressed, versioned, declarative, and scoped to an engagement.
- Remote BYOAg skills never execute scripts, binaries, installers, hooks, or executable HTML.
- BYOAg overlays do not modify or disable the agent's existing skills, tools, memory, or configuration.

## Authority order

Effective capability is the intersection of the platform maximum, the user's platform-recorded delegation, and any stricter client safety policy. No client or skill may widen the platform grant.

Higher-priority system, developer, user, and client-safety instructions take precedence over remote skill content. Platform data-handling policy remains attached to data derived from an engagement.

## Lifecycle summary

```text
discover → pair → register → create engagement → activate tools/skills
   → invoke/renew → revoke or disconnect → remove scoped overlay
```

Registration, engagement, and credential lifetimes are platform-defined. Permission reduction and revocation take effect immediately. Permission expansion requires renewed user consent.

## Detailed project specifications

- [Architecture](../../../docs/architecture.md)
- [Protocol flows](../../../docs/protocol-flows.md)
- [Permissions and capabilities](../../../docs/permissions-and-capabilities.md)
- [Security](../../../docs/security.md)
- [`ai.byoag` extension](../../../docs/byoag-extension.md)
- [Draft schemas](../../../schemas/)
