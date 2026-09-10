import { randomUUID } from "node:crypto";

import { createDpopProof, jwkThumbprint, verifyDocumentSignature, type SignedDocument } from "./crypto.js";
import { ByoagError } from "./errors.js";
import { DomainPolicy } from "./domain.js";
import { generatePendingIdentity } from "./identity.js";
import { SchemaValidator } from "./schema-validator.js";
import type { CredentialVault, StateRepository } from "./store.js";
import {
  CONNECTOR_VERSION,
  PROTOCOL_VERSION,
  type DiscoveryDocument,
  type HttpTransport,
  type PairingConnection,
  type PairingResponse,
  type Registration,
} from "./types.js";

export interface CompletePairingInput {
  connectionId: string;
  protectedCodeReference?: string | undefined;
  pairingCode?: string | undefined;
}

export class ByoagConnector {
  constructor(
    private readonly state: StateRepository,
    private readonly vault: CredentialVault,
    private readonly http: HttpTransport,
    private readonly schemas: SchemaValidator,
    private readonly domains: DomainPolicy,
  ) {}

  async discover(domainInput: string): Promise<DiscoveryDocument> {
    const domain = this.domains.normalizeDomain(domainInput);
    const discoveryUrl = this.domains.discoveryUrl(domain);
    const value = await this.http.requestJson(discoveryUrl);
    this.schemas.assertValid("discovery.schema.json", value, "discovery_invalid");
    const discovery = value as DiscoveryDocument;

    if (!discovery.protocolVersions.includes(PROTOCOL_VERSION)) {
      throw new ByoagError("unsupported_version", `The platform does not support BYOAg ${PROTOCOL_VERSION}.`);
    }

    const expectedOrigin = discoveryUrl.origin;
    const issuerUrl = safeUrl(discovery.issuer, "issuer");
    if (!this.domains.allowsProtocol(issuerUrl) || issuerUrl.username || issuerUrl.password || issuerUrl.hash) {
      throw new ByoagError("discovery_invalid", "The BYOAg issuer must be a credential-free secure URL without a fragment.");
    }
    if (issuerUrl.origin !== expectedOrigin) {
      throw new ByoagError("issuer_mismatch", "The discovery issuer does not match the requested platform domain.");
    }
    for (const endpoint of [...Object.values(discovery.endpoints), discovery.jwksUri]) {
      const endpointUrl = safeUrl(endpoint, "endpoint");
      if (!this.domains.allowsProtocol(endpointUrl) || endpointUrl.username || endpointUrl.password || endpointUrl.hash) {
        throw new ByoagError("discovery_invalid", "BYOAg endpoints must be credential-free HTTPS URLs without fragments.");
      }
      if (endpointUrl.origin !== expectedOrigin) {
        throw new ByoagError("issuer_mismatch", "Cross-origin BYOAg endpoints are not supported by this bootstrap profile.");
      }
    }
    const jwks = await this.http.requestJson(new URL(discovery.jwksUri));
    this.schemas.assertValid("jwks.schema.json", jwks, "discovery_invalid");
    verifyDocumentSignature(discovery as unknown as SignedDocument, (jwks as { keys: JsonWebKey[] }).keys, "byoag-discovery+jws");
    return discovery;
  }

  async beginPairing(domainInput: string, agentDisplayName: string): Promise<object> {
    const displayName = agentDisplayName.trim();
    if (!displayName || displayName.length > 120) throw new ByoagError("platform_error", "The agent display name must contain 1 to 120 characters.");
    const domain = this.domains.normalizeDomain(domainInput);
    const discovery = await this.discover(domain);
    const responseValue = await this.http.requestJson(new URL(discovery.endpoints.pairing), {
      method: "POST",
      body: {
        action: "begin",
        protocolVersion: PROTOCOL_VERSION,
        agent: { displayName },
        client: clientDescriptor(),
      },
    });
    this.schemas.assertValid("pairing.schema.json", responseValue, "platform_error");
    const response = responseValue as PairingResponse;
    if (response.status !== "pairing-ready") throw new ByoagError("platform_error", "The platform did not begin a pairing session.");

    const connectionId = randomUUID();
    const connection: PairingConnection = {
      connectionId,
      remoteConnectionId: response.connectionId,
      domain,
      issuer: discovery.issuer,
      platformDisplayName: discovery.displayName,
      agentDisplayName: displayName,
      discovery,
      status: "pairing-ready",
      createdAt: new Date().toISOString(),
      ...(response.expiresAt ? { expiresAt: response.expiresAt } : {}),
    };
    await this.state.update((state) => { state.connections[connectionId] = connection; });

    return {
      connectionId,
      platform: { domain, issuer: discovery.issuer, displayName: discovery.displayName },
      status: connection.status,
      confirmationModes: discovery.confirmationModes,
      ...(connection.expiresAt ? { expiresAt: connection.expiresAt } : {}),
      next: "Enter the platform's one-time code using protected input when available, then complete pairing.",
    };
  }

  async completePairing(input: CompletePairingInput): Promise<object> {
    const state = await this.state.read();
    const connection = state.connections[input.connectionId];
    if (!connection) throw new ByoagError("connection_not_found", "The pairing connection does not exist.");
    if (connection.expiresAt && Date.parse(connection.expiresAt) <= Date.now()) {
      throw new ByoagError("connection_not_found", "The pairing connection has expired.");
    }

    let identity = await this.vault.getPendingIdentity(connection.connectionId);
    if (!identity) {
      identity = generatePendingIdentity();
      await this.vault.putPendingIdentity(connection.connectionId, identity);
    }

    let responseValue: unknown;
    if (connection.status === "confirmation-required" && !input.pairingCode && !input.protectedCodeReference) {
      const pairingUrl = new URL(connection.discovery.endpoints.pairing);
      responseValue = await this.http.requestJson(pairingUrl, {
        method: "POST",
        dpopProof: createDpopProof("POST", pairingUrl, identity.installationKey.privateKey),
        body: {
          action: "status",
          protocolVersion: PROTOCOL_VERSION,
          connectionId: connection.remoteConnectionId,
          client: clientDescriptor(),
        },
      });
    } else {
      if (Boolean(input.pairingCode) === Boolean(input.protectedCodeReference)) {
        throw new ByoagError("pairing_code_required", "Provide exactly one pairing code or protected code reference.");
      }
      const pairingCode = input.protectedCodeReference
        ? await this.vault.consumeOneTimeSecret(input.protectedCodeReference)
        : input.pairingCode!;
      const pairingUrl = new URL(connection.discovery.endpoints.pairing);
      responseValue = await this.http.requestJson(pairingUrl, {
        method: "POST",
        dpopProof: createDpopProof("POST", pairingUrl, identity.installationKey.privateKey),
        body: {
          action: "complete",
          protocolVersion: PROTOCOL_VERSION,
          connectionId: connection.remoteConnectionId,
          pairingCode,
          agent: {
            displayName: connection.agentDisplayName,
            pairwiseId: identity.pairwiseId,
            publicKey: identity.pairwiseKey.publicKey,
          },
          installation: { id: identity.installationId, publicKey: identity.installationKey.publicKey },
          client: clientDescriptor(),
        },
      });
    }

    this.schemas.assertValid("pairing.schema.json", responseValue, "platform_error");
    const response = responseValue as PairingResponse;
    if (response.connectionId !== connection.remoteConnectionId) {
      throw new ByoagError("platform_error", "The platform returned a mismatched pairing connection.");
    }
    if (response.status === "confirmation-required") {
      await this.state.update((next) => {
        const current = next.connections[connection.connectionId];
        if (current) {
          current.status = "confirmation-required";
          if (response.verificationUri) current.verificationUri = response.verificationUri;
        }
      });
      return {
        connectionId: connection.connectionId,
        status: "confirmation-required",
        ...(response.verificationUri ? { verificationUri: response.verificationUri } : {}),
        next: "Approve the agent in the platform UI, then call complete pairing again without a code.",
      };
    }
    if (response.status === "denied") throw new ByoagError("pairing_code_invalid", "The platform denied the pairing request.");
    if (response.status !== "registered" || !response.registrationId || !response.credential) {
      throw new ByoagError("platform_error", "The platform returned an incomplete registration.");
    }
    if (response.credential.keyThumbprint !== jwkThumbprint(identity.installationKey.publicKey)) {
      throw new ByoagError("proof_of_possession_failed", "The registration credential is bound to a different installation key.");
    }

    const registrationId = randomUUID();
    const registration: Registration = {
      registrationId,
      remoteRegistrationId: response.registrationId,
      domain: connection.domain,
      issuer: connection.issuer,
      platformDisplayName: connection.platformDisplayName,
      agentDisplayName: connection.agentDisplayName,
      pairwiseId: identity.pairwiseId,
      installationId: identity.installationId,
      discovery: connection.discovery,
      createdAt: new Date().toISOString(),
      ...(response.credential.expiresAt ? { credentialExpiresAt: response.credential.expiresAt } : {}),
    };
    await this.vault.putRegistration(registrationId, {
      credential: response.credential,
      pairwiseKey: identity.pairwiseKey,
      installationKey: identity.installationKey,
    });
    await this.vault.deletePendingIdentity(connection.connectionId);
    await this.state.update((next) => {
      delete next.connections[connection.connectionId];
      next.registrations[registrationId] = registration;
    });

    return publicRegistration(registration);
  }

  async listRegistrations(): Promise<object> {
    const registrations = Object.values((await this.state.read()).registrations)
      .map(publicRegistration)
      .sort((a, b) => a.platform.displayName.localeCompare(b.platform.displayName));
    return { registrations };
  }

  async listEngagements(registrationId: string): Promise<object> {
    const registration = (await this.state.read()).registrations[registrationId];
    if (!registration) throw new ByoagError("registration_not_found", "The BYOAg registration does not exist.");
    const secrets = await this.vault.getRegistration(registrationId);
    if (!secrets) throw new ByoagError("credential_unavailable", "The registration credential is unavailable.");
    const url = new URL(registration.discovery.endpoints.engagements);
    url.searchParams.set("registrationId", registration.remoteRegistrationId);
    const proof = createDpopProof("GET", url, secrets.installationKey.privateKey, secrets.credential.value);
    const value = await this.http.requestJson(url, {
      authorization: { scheme: "DPoP", value: secrets.credential.value },
      dpopProof: proof,
    });
    if (!isRecord(value) || !Array.isArray(value.engagements)) {
      throw new ByoagError("engagement_invalid", "The platform returned an invalid engagement list.");
    }
    for (const engagement of value.engagements) {
      this.schemas.assertValid("engagement.schema.json", engagement, "engagement_invalid");
      if ((engagement as { registrationId?: string }).registrationId !== registration.remoteRegistrationId) {
        throw new ByoagError("engagement_invalid", "An engagement is bound to a different registration.");
      }
    }
    const jwks = await this.http.requestJson(new URL(registration.discovery.jwksUri));
    this.schemas.assertValid("jwks.schema.json", jwks, "engagement_invalid");
    for (const engagement of value.engagements) {
      const keys = (jwks as { keys: JsonWebKey[] }).keys;
      verifyDocumentSignature(engagement as SignedDocument, keys, "byoag-engagement+jws");
      verifyDocumentSignature((engagement as { delegation: SignedDocument }).delegation, keys, "byoag-delegation+jws");
    }
    return { registrationId, engagements: value.engagements };
  }

  async disconnect(registrationId: string): Promise<object> {
    const registration = (await this.state.read()).registrations[registrationId];
    if (!registration) throw new ByoagError("registration_not_found", "The BYOAg registration does not exist.");
    const secrets = await this.vault.getRegistration(registrationId);
    if (!secrets) throw new ByoagError("credential_unavailable", "The registration credential is unavailable.");
    const endpoint = appendPath(registration.discovery.endpoints.registrations, registration.remoteRegistrationId);
    const proof = createDpopProof("DELETE", endpoint, secrets.installationKey.privateKey, secrets.credential.value);
    await this.http.requestJson(endpoint, {
      method: "DELETE",
      authorization: { scheme: "DPoP", value: secrets.credential.value },
      dpopProof: proof,
    });
    await this.vault.deleteRegistration(registrationId);
    await this.state.update((state) => { delete state.registrations[registrationId]; });
    return { registrationId, status: "disconnected" };
  }
}

function clientDescriptor(): object {
  return {
    name: "byoag-connector",
    version: CONNECTOR_VERSION,
    conformance: "compatibility",
    supportedProtocolVersions: [PROTOCOL_VERSION],
  };
}

function publicRegistration(registration: Registration) {
  return {
    registrationId: registration.registrationId,
    platform: {
      domain: registration.domain,
      issuer: registration.issuer,
      displayName: registration.platformDisplayName,
    },
    agentDisplayName: registration.agentDisplayName,
    status: "registered" as const,
    createdAt: registration.createdAt,
    ...(registration.credentialExpiresAt ? { credentialExpiresAt: registration.credentialExpiresAt } : {}),
  };
}

function appendPath(base: string, segment: string): URL {
  const url = new URL(base.endsWith("/") ? base : `${base}/`);
  url.pathname += encodeURIComponent(segment);
  return url;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeUrl(value: string, label: string): URL {
  try {
    return new URL(value);
  } catch {
    throw new ByoagError("discovery_invalid", `The discovery ${label} URL is invalid.`);
  }
}
