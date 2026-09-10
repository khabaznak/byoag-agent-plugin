# Conformance fixtures

Cryptographic conformance fixtures are generated during each test run by the loopback reference host. This prevents reusable platform private keys, access credentials, or pairing codes from being committed to the repository.

The generated cases include valid signed discovery, delegations and engagements, post-signature tampering, distinct platform identities, expired and replayed codes, revoked credentials, and replayed DPoP proofs. See [`../conformance.test.ts`](../conformance.test.ts) for the observable assertions.
