import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { mkdtemp, readFile, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { ByoagConnector } from "../src/connector.js";
import { jwkThumbprint, signDocument } from "../src/crypto.js";
import { DomainPolicy } from "../src/domain.js";
import { ByoagError } from "../src/errors.js";
import { SchemaValidator } from "../src/schema-validator.js";
import { FileCredentialVault, StateRepository } from "../src/store.js";
import type { HttpRequest, HttpTransport } from "../src/types.js";

const signingPair = generateKeyPairSync("ed25519");
const signingPrivateJwk = signingPair.privateKey.export({ format: "jwk" });
const signingPublicJwk = {
  ...signingPair.publicKey.export({ format: "jwk" }),
  kid: "test-signing-key",
  use: "sig",
  alg: "EdDSA",
};
const discovery = signDocument({
  protocolVersions: ["0.1.0"],
  issuer: "https://platform.example",
  displayName: "Example Platform",
  endpoints: {
    pairing: "https://platform.example/byoag/pairing",
    registrations: "https://platform.example/byoag/registrations",
    engagements: "https://platform.example/byoag/engagements",
    mcp: "https://platform.example/byoag/mcp",
  },
  jwksUri: "https://platform.example/.well-known/jwks.json",
  confirmationModes: ["code-is-consent"],
  security: {
    profile: "byoag-dpop+jws-0.1",
    signingAlgorithms: ["EdDSA"],
    proofOfPossession: "DPoP",
  },
}, signingPrivateJwk, signingPublicJwk.kid, "byoag-discovery+jws");

class MockHttp implements HttpTransport {
  readonly calls: Array<{ url: string; request?: HttpRequest }> = [];

  async requestJson(url: URL, request?: HttpRequest): Promise<unknown> {
    this.calls.push({ url: url.toString(), ...(request ? { request } : {}) });
    if (url.pathname === "/.well-known/byoag.json") return discovery;
    if (url.pathname === "/.well-known/jwks.json") return { keys: [signingPublicJwk] };
    if (url.pathname === "/byoag/engagements") {
      return { engagements: [engagementFixture("remote-registration")] };
    }
    if (request?.method === "DELETE") return {};
    const body = request?.body as { action?: string; connectionId?: string } | undefined;
    if (body?.action === "begin") return { status: "pairing-ready", connectionId: "remote-connection" };
    if (body?.action === "complete") {
      const installation = (request?.body as { installation: { publicKey: JsonWebKey } }).installation;
      return {
        status: "registered",
        connectionId: "remote-connection",
        registrationId: "remote-registration",
        credential: {
          scheme: "dpop",
          value: "top-secret-token",
          keyThumbprint: jwkThumbprint(installation.publicKey),
        },
      };
    }
    throw new Error("Unexpected mock request");
  }
}

async function fixture() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "byoag-test-"));
  const schemas = await SchemaValidator.load(path.resolve("schemas"));
  const domains = new DomainPolicy();
  const http = new MockHttp();
  const state = new StateRepository(directory);
  const vault = new FileCredentialVault(directory);
  return { directory, http, state, vault, connector: new ByoagConnector(state, vault, http, schemas, domains) };
}

test("discovers only a matching issuer and supported protocol", async () => {
  const { connector } = await fixture();
  const result = await connector.discover("platform.example");
  assert.equal(result.displayName, "Example Platform");
  await assert.rejects(() => connector.discover("https://platform.example"), (error: unknown) => {
    assert.equal((error as ByoagError).code, "invalid_domain");
    return true;
  });
});

test("pairs generically without returning credentials and disconnects cleanly", async () => {
  const { connector, http, state } = await fixture();
  const begun = await connector.beginPairing("platform.example", "Alphonse") as { connectionId: string };
  const completed = await connector.completePairing({ connectionId: begun.connectionId, pairingCode: "123ABC" });
  const serialized = JSON.stringify(completed);
  assert.doesNotMatch(serialized, /top-secret-token/u);
  assert.doesNotMatch(serialized, /remote-registration/u);

  const listed = await connector.listRegistrations() as { registrations: Array<{ registrationId: string }> };
  assert.equal(listed.registrations.length, 1);
  const registrationId = listed.registrations[0]!.registrationId;
  assert.doesNotMatch(JSON.stringify(listed), /top-secret-token/u);

  const engagements = await connector.listEngagements(registrationId) as { engagements: Array<{ engagementId: string }> };
  assert.equal(engagements.engagements[0]?.engagementId, "engagement-1");
  assert.equal(http.calls.at(-2)?.request?.authorization?.value, "top-secret-token");

  const completeCall = http.calls.find((call) => (call.request?.body as { action?: string } | undefined)?.action === "complete");
  const sent = completeCall?.request?.body as { agent: { pairwiseId: string; publicKey: object }; installation: { id: string; publicKey: object } };
  assert.ok(sent.agent.pairwiseId);
  assert.ok(sent.agent.publicKey);
  assert.notEqual(sent.agent.pairwiseId, sent.installation.id);

  await connector.disconnect(registrationId);
  assert.deepEqual((await state.read()).registrations, {});
  assert.equal(http.calls.at(-1)?.request?.authorization?.value, "top-secret-token");
});

function engagementFixture(registrationId: string) {
  const issuedAt = "2026-09-09T12:00:00Z";
  const expiresAt = "2026-09-09T13:00:00Z";
  const role = { id: "player", displayName: "Player" };
  const delegation = signDocument({
    grantId: "grant-1",
    issuer: "https://platform.example",
    registrationId,
    engagementId: "engagement-1",
    role,
    issuedAt,
    expiresAt,
    permissions: [],
  }, signingPrivateJwk, signingPublicJwk.kid, "byoag-delegation+jws");
  return signDocument({
    engagementId: "engagement-1",
    issuer: "https://platform.example",
    registrationId,
    context: { id: "match-1", type: "game.match", displayName: "Match 1" },
    role,
    delegation,
    capabilities: [],
    skills: [],
    issuedAt,
    expiresAt,
  }, signingPrivateJwk, signingPublicJwk.kid, "byoag-engagement+jws");
}

test("protected secret references are single-use and files are owner-only", async () => {
  const { directory, vault } = await fixture();
  const reference = await vault.storeOneTimeSecret("123ABC", 60);
  assert.equal(await vault.consumeOneTimeSecret(reference), "123ABC");
  await assert.rejects(() => vault.consumeOneTimeSecret(reference), (error: unknown) => {
    assert.equal((error as ByoagError).code, "secret_reference_invalid");
    return true;
  });
  const vaultPath = path.join(directory, "vault.json");
  assert.equal((await stat(vaultPath)).mode & 0o777, 0o600);
  assert.doesNotMatch(await readFile(vaultPath, "utf8"), /123ABC/u);
});

test("blocks private destinations unless loopback development is explicit", async () => {
  const policy = new DomainPolicy({
    resolve: async () => [{ address: "10.0.0.8", family: 4 }],
  });
  await assert.rejects(() => policy.assertPublicDestination(new URL("https://platform.example/test")), (error: unknown) => {
    assert.equal((error as ByoagError).code, "invalid_domain");
    return true;
  });
});
