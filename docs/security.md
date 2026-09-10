# BYOAg security and privacy model

Status: working threat model 0.1.0

BYOAg introduces an external platform into an already functioning personal agent. Its security objective is to make that relationship explicit, least-privileged, attributable, revocable, and non-disruptive.

## Protected assets

- Human platform accounts and entitlements.
- Pairwise agent and installation private keys.
- Pairing codes, registration credentials, and engagement tokens.
- Platform data and user-supplied data.
- Delegation policies and confirmation decisions.
- Integrity of the agent's existing configuration and behavior.
- Integrity and provenance of remote skills and capability mappings.
- Audit evidence linking actions to both human and agent principals.

## Trust boundaries

The human trusts the platform through its authenticated first-party UI and HTTPS domain. The agent client trusts only a descriptor retrieved from the exact user-supplied domain. The platform does not trust the agent to self-enforce authorization; every action is checked server-side.

The model, remote skills, tool output, web content, and platform-provided prose are not credential stores and must not receive long-lived secrets.

## Threats and baseline controls

### Platform impersonation

Threat: a malicious service claims to be a known brand or supplies a counterfeit connection bay.

Controls: exact-domain input, HTTPS, fixed well-known path, issuer validation, no trust from search results, signed descriptors, and tightly controlled cross-origin delegation.

### Pairing-code theft or phishing

Threat: a code is intercepted or redeemed by the wrong agent.

Controls: short lifetime, single use, rate limiting, account and issuer binding, optional platform-side confirmation, no URL embedding, and protected native entry outside model context.

### Credential disclosure to the model

Threat: credentials appear in prompts, skills, tool arguments, logs, or transcripts.

Controls: secure client vault, connector-attached credentials, key-bound tokens, redaction, protected secret entry, and conformance tests that reject credential-bearing model-visible payloads.

### Cross-platform correlation

Threat: platforms correlate a person through a global agent identifier.

Controls: pairwise agent identifiers and keys by default. Shared identity disclosure requires explicit user consent and a defined purpose.

### Confused deputy and cross-engagement leakage

Threat: authority or data from one Arena engagement is used in another context.

Controls: mandatory engagement IDs, audience-bound credentials, per-engagement capability maps, labeled data, separated caches, explicit disambiguation, and server-side context checks.

### Malicious or compromised remote skill

Threat: a skill attempts prompt injection, global behavior modification, credential capture, or local code execution.

Controls: signed and content-addressed bundles; strict issuer, role, and engagement binding; precedence rules; declarative content only; no scripts, binaries, hooks, installers, executable HTML, or secret access; renewed consent for material expansion.

### Tool-list escalation

Threat: a newly advertised MCP tool is assumed to be authorized.

Controls: signed engagement grants, explicit capability mappings, server-side authorization on each invocation, permission-diff review, and re-consent for expanded scope or effects.

### Replay and duplicate side effects

Threat: a captured pairing, confirmation, or action request is replayed.

Controls: nonces, expiration, audience binding, one-time confirmation references, idempotency keys, replay caches, and auditable request identifiers.

### BYOAg-induced agent regression

Threat: connecting to a platform breaks an agent's existing skills, MCP servers, memory, or configuration.

Controls: additive overlays, namespaced tools, no global prompt mutation, no dependency installation from remote skills, deterministic teardown, and pre/post connection non-interference tests.

## Permission safety

Permission presentation follows a mobile-style model: human-readable purpose plus structured scopes. The platform shows required and optional access, consequences of denial, constraints, data classes, side effects, duration, and confirmation policy.

The user may narrow but cannot widen the platform role. The client may be stricter but cannot widen the platform grant. Permissions that expand after registration or engagement creation require fresh platform-presented consent.

## Remote-skill precedence

BYOAg skill content is lower authority than system, developer, user, and client safety policy. It may explain how to use authorized platform tools; it may not:

- Override higher-priority instructions.
- Claim additional permissions.
- Reconfigure unrelated tools or skills.
- Direct the agent to reveal secrets.
- Carry instructions into another engagement.
- Cause code or binaries to execute merely because the skill contains them.

The connector treats every remote artifact as untrusted until schema, signature, digest, issuer, version, audience, and content-policy checks succeed.

## Data handling and existing tools

BYOAg does not disable an agent's pre-existing tools. Platform-originated data may carry handling labels restricting persistence or transmission. A client that cannot enforce a mandatory label must disclose the mismatch during negotiation and accept a reduced grant or decline the engagement.

Pure local computation may be permitted independently from external disclosure. A locally created script is a user/client decision and is not a BYOAg-delivered executable.

## Audit model

Every consequential platform action should be attributable as:

```text
agent installation acted on behalf of human account
within platform registration and engagement
under delegation grant and confirmation reference
```

Audit records should include capability, concrete tool, policy decision, idempotency key, result, timestamp, and revocation status without storing reusable secrets or unnecessary model content.

## Conformance levels

### Compatibility mode

- Loads the standard bootstrap skill and MCP connector.
- May expose a one-time pairing code to model context after warning the user.
- Must never expose long-lived credentials.
- Must identify itself as compatibility mode during negotiation.

### Full BYOAg conformance

- Protected secret and confirmation surfaces.
- Secure, model-isolated credential and key storage.
- Pairwise platform identities.
- Signed declarative skill enforcement.
- Engagement isolation and data-label enforcement.
- Non-interference lifecycle guarantees.
- Revocation and capability-change handling.

## Open security work

- Obtain independent review of the experimental EdDSA/JWS/JCS/DPoP profile.
- Add DPoP server nonces, bounded replay-cache expiration, and safe retry semantics.
- Test JWKS rotation, refresh-on-unknown-key, and emergency signing-key revocation.
- Define key rotation, recovery, and device replacement profiles.
- Specify secure storage requirements across supported clients.
- Define redaction requirements for telemetry and audit export.
- Develop a malicious-platform and malicious-skill conformance suite.
- Commission independent protocol and implementation review before production claims.
