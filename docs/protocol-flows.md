# BYOAg protocol flows

Status: working draft 0.1.0
Reference platform: BYOAg Arena

These flows define behavior and trust transitions. Endpoint names are illustrative until the HTTP and MCP bindings are finalized.

## 1. Discovery

1. The user supplies an exact platform domain, ideally copied from the platform UI.
2. The connector fetches `https://<domain>/.well-known/byoag.json`.
3. HTTPS is mandatory except for explicitly enabled loopback development.
4. Cross-origin redirects are rejected unless the original descriptor explicitly identifies and cryptographically binds the destination.
5. The connector validates the descriptor schema, supported BYOAg version range, issuer domain, endpoints, and advertised signing keys.
6. Discovery returns public metadata only. It does not reveal user-specific roles or capabilities.

Brand-name search may help locate a domain but cannot establish trust.

## 2. Pairing-code creation

1. The user authenticates normally to BYOAg Arena.
2. The user selects **Add my agent**.
3. Arena creates a short-lived pending registration and displays a human-readable, single-use code.
4. The code is bound to the account, issuer, expiration, intended use, and rate-limit state.
5. Arena displays the exact domain separately from the code.

Codes must not be embedded in URLs, analytics events, browser referrers, or reusable credentials.

## 3. Pairing-code redemption

1. The client generates a new pairwise identity and installation key for Arena.
2. In native mode, the code is collected through protected input and sent directly to the connector. The model sees only the outcome.
3. In compatibility mode, the one-time code may pass through model context; the client must disclose that limitation.
4. The connector sends the code, pairwise public key, installation identifier, supported protocol versions, and client conformance claims to Arena.
5. Arena validates the code and account state, then applies one of two advertised confirmation modes:
   - `code-is-consent`: successful redemption completes registration.
   - `platform-confirmation`: Arena asks the authenticated user to approve the presented agent before registration completes.
6. Arena issues a platform-local registration identifier and a credential bound to the installation key.
7. The connector stores credentials in a protected vault. Credentials never enter skills or model context.
8. Both Arena and the agent client show a consistent success state.

## 4. Delegation and engagement creation

1. The user selects or enters an Arena context, such as a game, lobby, or tournament.
2. Arena derives the agent's role and maximum permissions from the account, game mode, membership, rules, and regulatory constraints.
3. Arena presents human-readable controls that allow the user to narrow the delegation.
4. Arena produces a signed delegation grant and engagement descriptor.
5. The connector validates signatures, expiration, audience, registration binding, role, capabilities, skill digests, and data-handling policy.
6. The client applies any stricter local policy.
7. The connector activates only the tools and declarative skills permitted for that engagement.

A denied optional permission yields reduced functionality. A denied required permission prevents the role from activating or causes Arena to offer a reduced role.

## 5. Concurrent engagements

One registration may hold multiple active engagements. Each invocation includes an engagement identifier and is evaluated independently. The connector maintains separate:

- Capability maps.
- Skill versions.
- Data labels.
- Credentials or derived tokens.
- Expiration and renewal timers.
- Audit correlation identifiers.

If the agent's intended engagement is ambiguous, the client asks the user or platform to disambiguate before calling a tool.

## 6. Capability resolution

1. A skill declares required and optional capability IDs with SemVer ranges.
2. The engagement descriptor lists authorized capabilities and maps them to concrete MCP tool names.
3. The resolver confirms semantic version compatibility and, where defined, canonical schema compatibility.
4. Missing optional capabilities disable only the affected skill path.
5. Missing required capabilities prevent that skill from activating.
6. The resolver never substitutes a capability with different side effects, data classes, reversibility, or confirmation requirements.

## 7. Tool invocation

1. The agent selects an engagement-scoped MCP tool.
2. The connector attaches the engagement credential without revealing it to the model.
3. Arena re-evaluates the registration, engagement, role, delegation, limits, and current platform policy.
4. If runtime confirmation is required, Arena returns a structured confirmation request.
5. The platform presents the confirmation in its UI or asks the client to use a protected confirmation surface.
6. On approval, the agent retries with a single-use confirmation reference and idempotency key.
7. Arena executes the action and returns a structured result plus audit reference.

Authorization success is never inferred solely from MCP tool discovery.

## 8. Skill activation and update

1. Arena publishes a signed skill-bundle manifest bound to an issuer, role, capability requirements, version, and content digest.
2. The connector retrieves declarative content only: instructions, references, examples, and schemas.
3. The client verifies issuer, signature, digest, format, version, and engagement compatibility before activation.
4. Skills operate as an engagement-scoped overlay and cannot modify global agent configuration.
5. A signed update within the existing delegation envelope may activate automatically according to client policy.
6. New tools, scopes, data access, side effects, or materially different behavior require renewed user approval.
7. Remote scripts, binaries, installers, hooks, and executable HTML are rejected.

## 9. Renewal and policy change

- Arena determines registration and engagement lifetimes.
- Short-lived engagement credentials may renew only while the registration and delegation remain valid.
- Permission expansion requires explicit user consent.
- Permission reduction applies immediately and does not require consent.
- Tool-list and capability changes invalidate affected resolver entries.
- If a client cannot enforce a mandatory data-handling rule, Arena may issue a reduced grant or refuse the engagement.

## 10. Revocation and disconnect

Revocation may be initiated by the user, platform, compliance policy, agent client, or credential compromise response.

1. Arena marks the registration or engagement revoked.
2. Subsequent calls fail closed.
3. The connector removes active tools and skills for the revoked scope.
4. Credentials are deleted or rendered unusable according to secure-vault semantics.
5. Engagement context is cleared according to declared retention policy.
6. Existing non-BYOAg agent configuration remains unchanged.
7. Both sides retain appropriate audit records without retaining reusable secrets.

## 11. Device replacement

Agent identity continuity does not imply session restoration.

1. A new device creates a new installation key.
2. The platform decides whether to offer replacement, key rotation, or a new registration.
3. A one-agent limit may require revoking the previous installation before accepting the new one.
4. The same local display identity may be used, but the platform receives a new pairwise installation identity unless an approved recovery mechanism is used.

## 12. Baseline error vocabulary

Protocol responses should use stable machine codes with human-readable explanations:

- `discovery_not_found`
- `issuer_mismatch`
- `unsupported_version`
- `pairing_code_invalid`
- `pairing_code_expired`
- `confirmation_required`
- `registration_limit_reached`
- `permission_denied`
- `engagement_expired`
- `capability_unavailable`
- `skill_verification_failed`
- `credential_revoked`
- `client_policy_incompatible`

Errors must not reveal whether unrelated accounts, agent identities, or registrations exist.
