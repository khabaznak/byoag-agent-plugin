export const PROTOCOL_VERSION = "0.1.0";
export const CONNECTOR_VERSION = "0.1.0";

export interface DiscoveryDocument {
  protocolVersions: string[];
  issuer: string;
  displayName: string;
  endpoints: {
    pairing: string;
    registrations: string;
    engagements: string;
    mcp: string;
  };
  jwksUri: string;
  confirmationModes: Array<"code-is-consent" | "platform-confirmation">;
  termsUri?: string;
  privacyUri?: string;
  documentationUri?: string;
  extensions?: Record<string, object>;
}

export interface PairingConnection {
  connectionId: string;
  remoteConnectionId: string;
  domain: string;
  issuer: string;
  platformDisplayName: string;
  agentDisplayName: string;
  discovery: DiscoveryDocument;
  status: "pairing-ready" | "confirmation-required";
  createdAt: string;
  expiresAt?: string;
  verificationUri?: string;
  pairwiseId?: string;
  installationId?: string;
}

export interface Registration {
  registrationId: string;
  remoteRegistrationId: string;
  domain: string;
  issuer: string;
  platformDisplayName: string;
  agentDisplayName: string;
  pairwiseId: string;
  installationId: string;
  discovery: DiscoveryDocument;
  createdAt: string;
  credentialExpiresAt?: string;
}

export interface ConnectorState {
  connections: Record<string, PairingConnection>;
  registrations: Record<string, Registration>;
}

export interface KeyMaterial {
  publicKey: JsonWebKey;
  privateKey: JsonWebKey;
}

export interface RegistrationSecrets {
  credential: {
    scheme: "bearer";
    value: string;
    expiresAt?: string;
  };
  pairwiseKey: KeyMaterial;
  installationKey: KeyMaterial;
}

export interface PendingIdentity {
  pairwiseId: string;
  installationId: string;
  pairwiseKey: KeyMaterial;
  installationKey: KeyMaterial;
}

export interface PairingResponse {
  status: "pairing-ready" | "confirmation-required" | "registered" | "denied";
  connectionId: string;
  expiresAt?: string;
  registrationId?: string;
  verificationUri?: string;
  message?: string;
  credential?: {
    scheme: "bearer";
    value: string;
    expiresAt?: string;
  };
}

export interface HttpRequest {
  method?: "GET" | "POST" | "DELETE";
  body?: unknown;
  bearerToken?: string;
}

export interface HttpTransport {
  requestJson(url: URL, request?: HttpRequest): Promise<unknown>;
}
