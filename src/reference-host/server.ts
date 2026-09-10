import { generateKeyPairSync, randomBytes, randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";

import { jwkThumbprint, signDocument, verifyDpopProof } from "../crypto.js";
import { PROTOCOL_VERSION } from "../types.js";

export type ConfirmationMode = "code-is-consent" | "platform-confirmation";

export interface ReferenceHostOptions {
  displayName?: string;
  confirmationMode?: ConfirmationMode;
  pairingCodeTtlMs?: number;
  maximumCodeFailures?: number;
}

interface PairingCodeRecord {
  expiresAt: number;
  failures: number;
  used: boolean;
}

interface ConnectionRecord {
  id: string;
  status: "pairing-ready" | "confirmation-required" | "approved" | "registered" | "denied";
  displayName: string;
  failures: number;
  pairwiseId?: string;
  installationId?: string;
  installationJwk?: JsonWebKey;
  keyThumbprint?: string;
  registrationId?: string;
}

interface RegistrationRecord {
  id: string;
  pairwiseId: string;
  installationId: string;
  keyThumbprint: string;
  token: string;
  expiresAt: number;
  revoked: boolean;
}

export class ReferenceHost {
  private readonly displayName: string;
  private readonly confirmationMode: ConfirmationMode;
  private readonly pairingCodeTtlMs: number;
  private readonly maximumCodeFailures: number;
  private readonly codes = new Map<string, PairingCodeRecord>();
  private readonly connections = new Map<string, ConnectionRecord>();
  private readonly registrations = new Map<string, RegistrationRecord>();
  private readonly replayCache = new Set<string>();
  private readonly signingPrivateJwk: JsonWebKey;
  private readonly signingPublicJwk: JsonWebKey & { kid: string; use: "sig"; alg: "EdDSA" };
  private server: Server | undefined;
  private origin: string | undefined;
  private alterDiscoveryAfterSigning = false;

  constructor(options: ReferenceHostOptions = {}) {
    this.displayName = options.displayName ?? "BYOAg Reference Host";
    this.confirmationMode = options.confirmationMode ?? "code-is-consent";
    this.pairingCodeTtlMs = options.pairingCodeTtlMs ?? 120_000;
    this.maximumCodeFailures = options.maximumCodeFailures ?? 3;
    const { publicKey, privateKey } = generateKeyPairSync("ed25519");
    const kid = `ref-${randomUUID()}`;
    this.signingPrivateJwk = privateKey.export({ format: "jwk" });
    this.signingPublicJwk = {
      ...publicKey.export({ format: "jwk" }),
      kid,
      use: "sig",
      alg: "EdDSA",
    };
  }

  async start(): Promise<{ origin: string; domain: string }> {
    if (this.server || this.origin) throw new Error("Reference host is already running.");
    this.server = createServer((request, response) => {
      void this.route(request, response).catch(() => sendJson(response, 500, { error: "server_error" }));
    });
    await new Promise<void>((resolve, reject) => {
      this.server!.once("error", reject);
      this.server!.listen(0, "127.0.0.1", () => resolve());
    });
    const address = this.server.address();
    if (!address || typeof address === "string") throw new Error("Reference host failed to bind.");
    this.origin = `http://127.0.0.1:${address.port}`;
    return { origin: this.origin, domain: `127.0.0.1:${address.port}` };
  }

  async stop(): Promise<void> {
    if (!this.server) return;
    await new Promise<void>((resolve, reject) => this.server!.close((error) => error ? reject(error) : resolve()));
    this.server = undefined;
    this.origin = undefined;
  }

  issuePairingCode(options: { expiresInMs?: number } = {}): string {
    const code = randomBytes(4).toString("hex").slice(0, 6).toUpperCase();
    this.codes.set(code, {
      expiresAt: Date.now() + (options.expiresInMs ?? this.pairingCodeTtlMs),
      failures: 0,
      used: false,
    });
    return code;
  }

  approve(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection || connection.status !== "confirmation-required") throw new Error("Connection is not awaiting confirmation.");
    connection.status = "approved";
  }

  approvePending(): string {
    const connection = [...this.connections.values()].find((candidate) => candidate.status === "confirmation-required");
    if (!connection) throw new Error("No connection is awaiting confirmation.");
    this.approve(connection.id);
    return connection.id;
  }

  tamperWithDiscoverySignature(): void {
    this.alterDiscoveryAfterSigning = true;
  }

  revokeAllRegistrations(): void {
    for (const registration of this.registrations.values()) registration.revoked = true;
  }

  registrationForPairwiseId(pairwiseId: string): RegistrationRecord | undefined {
    return [...this.registrations.values()].find((registration) => registration.pairwiseId === pairwiseId);
  }

  private async route(request: IncomingMessage, response: ServerResponse): Promise<void> {
    if (!this.origin || !request.url || !request.method) return sendJson(response, 503, { error: "not_ready" });
    const url = new URL(request.url, this.origin);
    if (request.method === "GET" && url.pathname === "/.well-known/byoag.json") {
      return sendJson(response, 200, this.discovery());
    }
    if (request.method === "GET" && url.pathname === "/.well-known/jwks.json") {
      return sendJson(response, 200, { keys: [this.signingPublicJwk] });
    }
    if (request.method === "POST" && url.pathname === "/byoag/pairing") {
      return this.pair(request, response, url, await readJson(request));
    }
    if (request.method === "GET" && url.pathname === "/byoag/engagements") {
      const registration = this.authorize(request, url);
      if (!registration || registration.id !== url.searchParams.get("registrationId")) return sendJson(response, 401, { error: "credential_revoked" });
      return sendJson(response, 200, { engagements: [this.engagement(registration, "match-1"), this.engagement(registration, "match-2")] });
    }
    if (request.method === "DELETE" && url.pathname.startsWith("/byoag/registrations/")) {
      const registration = this.authorize(request, url);
      const id = decodeURIComponent(url.pathname.slice("/byoag/registrations/".length));
      if (!registration || registration.id !== id) return sendJson(response, 401, { error: "credential_revoked" });
      registration.revoked = true;
      response.writeHead(204).end();
      return;
    }
    sendJson(response, 404, { error: "not_found" });
  }

  private discovery() {
    const origin = this.requireOrigin();
    const unsigned = {
      protocolVersions: [PROTOCOL_VERSION],
      issuer: origin,
      displayName: this.displayName,
      endpoints: {
        pairing: `${origin}/byoag/pairing`,
        registrations: `${origin}/byoag/registrations`,
        engagements: `${origin}/byoag/engagements`,
        mcp: `${origin}/byoag/mcp`,
      },
      jwksUri: `${origin}/.well-known/jwks.json`,
      confirmationModes: [this.confirmationMode],
      security: {
        profile: "byoag-dpop+jws-0.1",
        signingAlgorithms: ["EdDSA"],
        proofOfPossession: "DPoP",
      },
    };
    const signed = signDocument(unsigned, this.signingPrivateJwk, this.signingPublicJwk.kid, "byoag-discovery+jws");
    return this.alterDiscoveryAfterSigning ? { ...signed, displayName: `${this.displayName} altered` } : signed;
  }

  private pair(request: IncomingMessage, response: ServerResponse, url: URL, body: unknown): void {
    if (!isRecord(body) || typeof body.action !== "string" || body.protocolVersion !== PROTOCOL_VERSION) {
      return sendJson(response, 400, { error: "invalid_request" });
    }
    if (body.action === "begin") {
      const displayName = isRecord(body.agent) && typeof body.agent.displayName === "string" ? body.agent.displayName : undefined;
      if (!displayName) return sendJson(response, 400, { error: "invalid_request" });
      const id = randomUUID();
      this.connections.set(id, { id, status: "pairing-ready", displayName, failures: 0 });
      return sendJson(response, 200, { status: "pairing-ready", connectionId: id });
    }
    const connectionId = typeof body.connectionId === "string" ? body.connectionId : "";
    const connection = this.connections.get(connectionId);
    if (!connection) return sendJson(response, 404, { error: "connection_not_found" });

    if (body.action === "complete") {
      if (connection.status === "denied") return sendJson(response, 429, { error: "pairing_rate_limited" });
      if (!isRecord(body.installation) || !isRecord(body.agent) || typeof body.pairingCode !== "string") {
        return sendJson(response, 400, { error: "invalid_request" });
      }
      const installationJwk = body.installation.publicKey as JsonWebKey;
      let proof;
      try {
        proof = verifyDpopProof(singleHeader(request, "dpop"), "POST", url, { replayCache: this.replayCache });
        if (proof.thumbprint !== jwkThumbprint(installationJwk)) throw new Error("Installation key mismatch.");
      } catch {
        return sendJson(response, 401, { error: "proof_of_possession_failed" });
      }
      const code = this.codes.get(body.pairingCode);
      const codeError = !code ? "pairing_code_invalid"
        : code.used ? "pairing_code_replayed"
          : code.expiresAt <= Date.now() ? "pairing_code_expired"
            : undefined;
      if (codeError) {
        connection.failures += 1;
        if (connection.failures >= this.maximumCodeFailures) connection.status = "denied";
        return sendJson(response, connection.status === "denied" ? 429 : 400, {
          error: connection.status === "denied" ? "pairing_rate_limited" : codeError,
        });
      }
      if (!code) throw new Error("Pairing code validation invariant failed.");
      if (connection.status !== "pairing-ready") return sendJson(response, 409, { error: "pairing_code_replayed" });
      code.used = true;
      const pairwiseId = typeof body.agent.pairwiseId === "string" ? body.agent.pairwiseId : "";
      const installationId = typeof body.installation.id === "string" ? body.installation.id : "";
      if (!pairwiseId || !installationId) return sendJson(response, 400, { error: "invalid_request" });
      connection.pairwiseId = pairwiseId;
      connection.installationId = installationId;
      connection.installationJwk = installationJwk;
      connection.keyThumbprint = proof.thumbprint;
      if (this.confirmationMode === "platform-confirmation") {
        connection.status = "confirmation-required";
        return sendJson(response, 200, {
          status: "confirmation-required",
          connectionId,
          verificationUri: `${this.requireOrigin()}/confirm/${connectionId}`,
        });
      }
      return sendJson(response, 200, this.register(connection));
    }

    if (body.action === "status") {
      if (!connection.installationJwk || !connection.keyThumbprint) return sendJson(response, 409, { error: "invalid_state" });
      try {
        verifyDpopProof(singleHeader(request, "dpop"), "POST", url, {
          expectedThumbprint: connection.keyThumbprint,
          replayCache: this.replayCache,
        });
      } catch {
        return sendJson(response, 401, { error: "proof_of_possession_failed" });
      }
      if (connection.status === "approved") return sendJson(response, 200, this.register(connection));
      if (connection.status === "registered" && connection.registrationId) {
        const registration = this.registrations.get(connection.registrationId);
        if (registration) return sendJson(response, 200, this.registrationResponse(connection, registration));
      }
      return sendJson(response, 200, {
        status: "confirmation-required",
        connectionId,
        verificationUri: `${this.requireOrigin()}/confirm/${connectionId}`,
      });
    }

    sendJson(response, 400, { error: "invalid_request" });
  }

  private register(connection: ConnectionRecord) {
    if (!connection.pairwiseId || !connection.installationId || !connection.keyThumbprint) throw new Error("Incomplete connection.");
    const registration: RegistrationRecord = {
      id: randomUUID(),
      pairwiseId: connection.pairwiseId,
      installationId: connection.installationId,
      keyThumbprint: connection.keyThumbprint,
      token: randomBytes(32).toString("base64url"),
      expiresAt: Date.now() + 3_600_000,
      revoked: false,
    };
    this.registrations.set(registration.id, registration);
    connection.registrationId = registration.id;
    connection.status = "registered";
    return this.registrationResponse(connection, registration);
  }

  private registrationResponse(connection: ConnectionRecord, registration: RegistrationRecord) {
    return {
      status: "registered",
      connectionId: connection.id,
      registrationId: registration.id,
      credential: {
        scheme: "dpop",
        value: registration.token,
        keyThumbprint: registration.keyThumbprint,
        expiresAt: new Date(registration.expiresAt).toISOString(),
      },
    };
  }

  private authorize(request: IncomingMessage, url: URL): RegistrationRecord | undefined {
    const authorization = singleHeader(request, "authorization");
    const match = /^DPoP (.+)$/u.exec(authorization);
    if (!match) return undefined;
    const token = match[1]!;
    const registration = [...this.registrations.values()].find((candidate) =>
      candidate.token === token && !candidate.revoked && candidate.expiresAt > Date.now());
    if (!registration) return undefined;
    try {
      verifyDpopProof(singleHeader(request, "dpop"), request.method!, url, {
        accessToken: token,
        expectedThumbprint: registration.keyThumbprint,
        replayCache: this.replayCache,
      });
      return registration;
    } catch {
      return undefined;
    }
  }

  private engagement(registration: RegistrationRecord, contextId: string) {
    const issuedAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 300_000).toISOString();
    const role = { id: "player", displayName: "Player" };
    const engagementId = randomUUID();
    const delegation = signDocument({
      grantId: randomUUID(),
      issuer: this.requireOrigin(),
      registrationId: registration.id,
      engagementId,
      role,
      issuedAt,
      expiresAt,
      permissions: [],
    }, this.signingPrivateJwk, this.signingPublicJwk.kid, "byoag-delegation+jws");
    return signDocument({
      engagementId,
      issuer: this.requireOrigin(),
      registrationId: registration.id,
      context: { id: contextId, type: "game.match", displayName: contextId === "match-1" ? "Match 1" : "Match 2" },
      role,
      delegation,
      capabilities: [],
      skills: [],
      issuedAt,
      expiresAt,
    }, this.signingPrivateJwk, this.signingPublicJwk.kid, "byoag-engagement+jws");
  }

  private requireOrigin(): string {
    if (!this.origin) throw new Error("Reference host is not running.");
    return this.origin;
  }
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 1_048_576) throw new Error("Request too large.");
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
}

function singleHeader(request: IncomingMessage, name: string): string {
  const value = request.headers[name];
  return typeof value === "string" ? value : "";
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  const encoded = JSON.stringify(body);
  response.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(encoded),
    "Cache-Control": "no-store",
  });
  response.end(encoded);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
