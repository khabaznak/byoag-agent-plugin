# BYOAg 0.1 cryptographic profile

Status: implemented experimental profile

Profile identifier: `byoag-dpop+jws-0.1`

This profile selects established cryptographic formats for BYOAg 0.1. It remains experimental and may change incompatibly before the protocol is stabilized.

## Trust anchor

The user's exact platform domain and its authenticated HTTPS connection are the initial trust anchor. The connector retrieves the discovery document only from `/.well-known/byoag.json` at that origin. Redirects, user information in URLs, fragments, and cross-origin protocol endpoints are rejected by the bootstrap profile.

Plain HTTP is permitted only for explicit loopback development on `localhost`, `127.0.0.1`, or `[::1]`. It is never a production transport.

## Algorithms and encodings

BYOAg 0.1 uses:

- Ed25519 keys and the JOSE `EdDSA` algorithm.
- Public keys encoded as JWK objects.
- JWK SHA-256 thumbprints as defined by [RFC 7638](https://www.rfc-editor.org/rfc/rfc7638.html).
- JSON canonicalization as defined by [RFC 8785](https://www.rfc-editor.org/rfc/rfc8785.html).
- Detached compact JWS signatures as defined by [RFC 7515](https://www.rfc-editor.org/rfc/rfc7515.html).
- DPoP proofs as defined by [RFC 9449](https://www.rfc-editor.org/rfc/rfc9449.html).

Algorithm agility will be introduced through a future profile identifier rather than accepting arbitrary algorithms inside this profile.

## Platform-signed documents

The discovery document, delegation grants, engagement descriptors, and future skill-bundle manifests carry a `signature` object:

```json
{
  "alg": "EdDSA",
  "kid": "platform-key-2026-01",
  "value": "<protected-header>..<signature>"
}
```

To sign a document:

1. Remove the top-level `signature` member.
2. Canonicalize the remaining JSON using RFC 8785.
3. Base64url-encode those canonical bytes as the detached JWS payload.
4. Sign using Ed25519.
5. Use the required type-specific `typ` value in the protected header.

The defined types are:

- `byoag-discovery+jws`
- `byoag-delegation+jws`
- `byoag-engagement+jws`
- `byoag-skill-bundle+jws`

The protected header must contain exactly the security-relevant `alg`, `kid`, and `typ` values understood by this profile. The envelope `alg` and `kid` must match the protected header.

## Signing-key publication and rotation

The platform publishes verification keys at the same-origin `jwksUri` declared by discovery. Each usable key has:

- `kty: "OKP"`
- `crv: "Ed25519"`
- `use: "sig"`
- `alg: "EdDSA"`
- A platform-unique `kid`

During rotation, a platform should publish old and new public keys for at least the maximum lifetime of every artifact signed by the old key. New artifacts use the new key immediately. A client must fail closed when a key is unknown or a signature is invalid. Revoked keys must be removed and their outstanding artifacts treated according to platform revocation policy.

The current connector retrieves the JWKS during discovery and engagement validation. Cache-control, refresh-on-unknown-key, and offline verification rules remain future work.

## Installation proof of possession

Each platform registration receives a newly generated installation key. The key is distinct from both the user-named agent's pairwise key and installation keys used with other platforms.

The connector attaches a unique DPoP proof to pairing completion and confirmation-status requests. The platform verifies that the proof key matches the installation public key in the pairing request.

Registration credentials use `scheme: "dpop"` and include the RFC 7638 thumbprint to which the credential is bound. The connector rejects a credential bound to any other key.

Authenticated requests use:

```text
Authorization: DPoP <access-token>
DPoP: <proof-jwt>
```

Every proof contains:

- `typ: "dpop+jwt"`, `alg: "EdDSA"`, and the public `jwk` in its header.
- A unique `jti`.
- Uppercase HTTP method in `htm`.
- Target URI without query or fragment in `htu`.
- Current issued-at time in `iat`.
- SHA-256 access-token hash in `ath` when a credential is present.

Platforms must verify the signature, method, URI, timestamp window, access-token hash, credential key binding, and replay status before authorization. A valid proof is not authorization by itself.

## Replay and nonce policy

The reference host accepts proofs within a five-minute time window and retains their `jti` values for replay detection. Production hosts should bound and expire replay-cache entries.

Server-provided DPoP nonces are not implemented in this revision. They are recommended for higher-risk or hostile-client environments and will require an explicit connector retry policy to avoid silently repeating non-idempotent operations.

## Credential storage

The connector's file vault is compatibility-grade. It separates secrets from model-visible state and applies owner-only filesystem permissions, but it does not provide hardware binding or OS-backed encryption. Full-conformance clients must substitute protected secret input and platform credential storage.

## Known limitations

- DPoP does not provide HTTP body integrity; TLS remains mandatory outside loopback testing.
- The connector's DNS preflight and the runtime HTTP lookup are not yet cryptographically pinned against DNS rebinding.
- JWKS caching and rotation overlap are specified but not yet exercised by the reference host.
- DPoP nonces and refresh credentials are not implemented.
- Independent security review is still required before any production-readiness claim.
