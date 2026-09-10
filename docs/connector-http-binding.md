# Generic connector HTTP binding

Status: implemented experimental binding 0.1.0

This document defines the platform-neutral HTTP exchange implemented by the generic connector. It is an experimental interoperability target for BYOAg Arena and other reference hosts, not a finalized standard.

## Discovery

The connector retrieves exactly:

```text
GET https://<user-supplied-domain>/.well-known/byoag.json
Accept: application/json
```

The document must validate against [`discovery.schema.json`](../schemas/discovery.schema.json), advertise protocol `0.1.0`, and use the requested origin for its issuer, endpoints, and JWKS URI. The connector retrieves the same-origin JWKS and verifies the document's detached EdDSA JWS signature before pairing. Redirects are rejected. Public-network HTTPS is required by default; loopback HTTP is available only through an explicit development setting.

## Pairing endpoint

All pairing messages use `POST` with `Content-Type: application/json` to the discovered `endpoints.pairing` URL. The message shapes are defined by [`pairing.schema.json`](../schemas/pairing.schema.json).

### Begin

The connector sends `action: "begin"`, the protocol version, the user's display name for the agent, and compatibility claims. The platform returns `status: "pairing-ready"` and a platform-local `connectionId`.

The connector returns a different local UUID to the agent. Platform-local identifiers are never treated as globally unique.

### Complete

The connector generates separate Ed25519 pairwise-agent and installation key pairs. It sends:

- The platform connection identifier.
- The short-lived pairing code.
- The user-named agent display name.
- A new platform-pairwise identifier and public key.
- A new installation identifier and public key.
- Client version and conformance claims.
- A DPoP proof signed by the installation key and bound to the pairing endpoint.

The platform returns either:

- `confirmation-required`, optionally with a first-party verification URI; or
- `registered`, with a platform registration identifier and DPoP-bound credential.

The credential is consumed by the connector, stored in its vault, and omitted from every MCP result.

### Confirmation status

After first-party platform confirmation, the connector sends `action: "status"` with the platform connection identifier and a fresh installation-key DPoP proof. The successful response is the same `registered` response used by immediate completion. Status polling does not resend the pairing code.

## Registrations

Local registration references are connector-generated UUIDs. The connector keeps the platform registration identifier private to the protocol implementation.

Disconnect uses:

```text
DELETE <endpoints.registrations>/<encoded-platform-registration-id>
Authorization: DPoP <connector-attached-credential>
DPoP: <request-bound-proof-jwt>
```

Only after the platform accepts revocation does the connector remove the associated local credential and registration state.

## Engagements

The connector retrieves engagements using:

```text
GET <endpoints.engagements>?registrationId=<encoded-platform-registration-id>
Authorization: DPoP <connector-attached-credential>
DPoP: <request-bound-proof-jwt>
```

The response is an object containing an `engagements` array. Every entry must validate against [`engagement.schema.json`](../schemas/engagement.schema.json) and must name the expected platform registration identifier.

## Compatibility security profile

The current runtime provides a replaceable `CredentialVault` interface and an owner-only file implementation. The file vault:

- Separates public connector state from credentials and private keys.
- Writes directories with mode `0700` and files with mode `0600` where supported.
- Never places credentials or private keys in MCP results.
- Supports single-use, expiring protected-code references.

It does not provide OS-backed encryption at rest and therefore does not claim full BYOAg conformance. Native clients should replace it with an operating-system credential vault and protected input surface.

The connector implements the [`byoag-dpop+jws-0.1` cryptographic profile](security-profile.md). Pairing completion and confirmation polling prove possession of the installation key. Authenticated engagement and revocation requests additionally bind the DPoP proof to the issued access credential.
