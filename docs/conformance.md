# BYOAg connector conformance suite

Status: automated development suite for protocol 0.1.0

Run all checks with:

```bash
npm test
```

The suite exercises observable behavior rather than matching documentation text.

Cryptographic fixtures are generated with fresh keys and credentials for each run. The repository therefore contains fixture definitions, not reusable private-key material.

## Covered invariants

- A real compiled stdio MCP process publishes the six bootstrap tools.
- Discovery is bound to the exact domain and a supported protocol version.
- Discovery, delegation, and engagement signatures validate against same-origin JWKS.
- A discovery document modified after signing is rejected.
- Pairing works in both `code-is-consent` and `platform-confirmation` modes.
- Pairing codes expire, cannot be replayed, and trigger rate limiting after repeated failures.
- Pairwise agent and installation identifiers differ across two independent hosts.
- Registration credentials are bound to installation keys and excluded from tool results.
- DPoP proofs bind method, target URI, access token, time, and a replay-protected identifier.
- Server-side credential revocation fails closed.
- Two simultaneous engagements validate independently.
- Disconnect deletes only the selected BYOAg state and preserves unrelated files.
- Protected pairing-code references expire and can be consumed only once.

## Deliberately outstanding

- JWKS rotation and refresh-on-unknown-key fixtures.
- DPoP nonce challenge and retry behavior.
- DNS rebinding simulation.
- Multiple connector processes sharing one vault.
- Malicious skill-bundle content and signature fixtures.
- Remote MCP capability filtering and invocation.
- OS-backed vault adapters.
- BYOAg Arena integration tests.
