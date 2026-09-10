# BYOAg reference host

The reference host is a deliberately small, in-memory implementation of the BYOAg 0.1 connection pattern. It exists to test interoperability and keep BYOAg Arena from becoming a hidden special case. It is not an application template or production server.

## Implemented surfaces

- Signed `/.well-known/byoag.json` discovery.
- Same-origin JWKS publication.
- Pairing `begin`, `complete`, and confirmation `status` actions.
- `code-is-consent` and `platform-confirmation` modes.
- Short-lived, single-use pairing codes and per-connection rate limiting.
- Pairwise agent and installation registrations.
- DPoP-bound credentials and proof replay detection.
- Two signed, isolated example engagements per registration.
- Immediate server-side revocation.

The advertised remote MCP endpoint is reserved for the engagement-tool phase and is not implemented yet.

## Run locally

```bash
npm run reference-host
```

The process binds only to a random `127.0.0.1` port and prints its discovery domain plus one development pairing code to stderr. The connector must be launched with `BYOAG_ALLOW_LOOPBACK=true` for this development environment.

Choose the alternate confirmation mode with:

```bash
BYOAG_CONFIRMATION_MODE=platform-confirmation npm run reference-host
```

Programmatic tests approve the pending connection directly. A human-facing confirmation page is intentionally deferred to BYOAg Arena.

## State model

All codes, connections, registrations, tokens, replay identifiers, and signing keys live only in process memory. Restarting the host resets it. This makes conformance runs deterministic in scope and prevents the reference host from being mistaken for a deployable account system.
