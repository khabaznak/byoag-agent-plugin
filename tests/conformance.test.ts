import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { ByoagConnector } from "../src/connector.js";
import { createDpopProof, verifyDpopProof } from "../src/crypto.js";
import { DomainPolicy } from "../src/domain.js";
import { ByoagError } from "../src/errors.js";
import { SecureJsonHttpTransport } from "../src/http.js";
import { ReferenceHost, type ConfirmationMode } from "../src/reference-host/server.js";
import { SchemaValidator } from "../src/schema-validator.js";
import { FileCredentialVault, StateRepository } from "../src/store.js";

async function connectorFixture() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "byoag-conformance-"));
  const domains = new DomainPolicy({ allowLoopback: true });
  const state = new StateRepository(directory);
  const vault = new FileCredentialVault(directory);
  const schemas = await SchemaValidator.load(path.resolve("schemas"));
  const connector = new ByoagConnector(state, vault, new SecureJsonHttpTransport(domains, 2_000), schemas, domains);
  return { connector, directory, state };
}

async function pair(
  connector: ByoagConnector,
  host: ReferenceHost,
  domain: string,
  mode: ConfirmationMode = "code-is-consent",
) {
  const code = host.issuePairingCode();
  const begun = await connector.beginPairing(domain, "Alphonse") as { connectionId: string };
  const first = await connector.completePairing({ connectionId: begun.connectionId, pairingCode: code }) as { status: string; registrationId?: string };
  if (mode === "platform-confirmation") {
    assert.equal(first.status, "confirmation-required");
    host.approvePending();
    return connector.completePairing({ connectionId: begun.connectionId }) as Promise<{ status: string; registrationId: string }>;
  }
  return first as { status: string; registrationId: string };
}

test("completes code-is-consent pairing, validates two engagements, and tears down only BYOAg state", async (t) => {
  const host = new ReferenceHost();
  const { domain } = await host.start();
  t.after(() => host.stop());
  const { connector, directory } = await connectorFixture();
  const sentinel = path.join(directory, "unrelated-agent-config.txt");
  await writeFile(sentinel, "preserve me");

  const registration = await pair(connector, host, domain);
  const engagements = await connector.listEngagements(registration.registrationId) as { engagements: Array<{ engagementId: string }> };
  assert.equal(engagements.engagements.length, 2);
  assert.notEqual(engagements.engagements[0]?.engagementId, engagements.engagements[1]?.engagementId);
  await connector.disconnect(registration.registrationId);
  assert.equal(await readFile(sentinel, "utf8"), "preserve me");
  assert.deepEqual(await connector.listRegistrations(), { registrations: [] });
});

test("supports first-party platform confirmation without resending the code", async (t) => {
  const host = new ReferenceHost({ confirmationMode: "platform-confirmation" });
  const { domain } = await host.start();
  t.after(() => host.stop());
  const { connector } = await connectorFixture();
  const registration = await pair(connector, host, domain, "platform-confirmation");
  assert.equal(registration.status, "registered");
});

test("uses unlinkable pairwise identities for two independent hosts", async (t) => {
  const firstHost = new ReferenceHost({ displayName: "Business One" });
  const secondHost = new ReferenceHost({ displayName: "Business Two" });
  const firstAddress = await firstHost.start();
  const secondAddress = await secondHost.start();
  t.after(async () => { await Promise.all([firstHost.stop(), secondHost.stop()]); });
  const { connector, state } = await connectorFixture();
  await pair(connector, firstHost, firstAddress.domain);
  await pair(connector, secondHost, secondAddress.domain);
  const registrations = Object.values((await state.read()).registrations);
  assert.equal(registrations.length, 2);
  assert.notEqual(registrations[0]?.pairwiseId, registrations[1]?.pairwiseId);
  assert.notEqual(registrations[0]?.installationId, registrations[1]?.installationId);
});

test("rejects expired and replayed pairing codes and rate-limits repeated failures", async (t) => {
  const host = new ReferenceHost({ maximumCodeFailures: 3 });
  const { domain } = await host.start();
  t.after(() => host.stop());
  const { connector } = await connectorFixture();

  const expired = host.issuePairingCode({ expiresInMs: -1 });
  const expiredConnection = await connector.beginPairing(domain, "Alphonse") as { connectionId: string };
  await expectCode(connector.completePairing({ connectionId: expiredConnection.connectionId, pairingCode: expired }), "pairing_code_expired");

  const reusable = host.issuePairingCode();
  const first = await connector.beginPairing(domain, "Alphonse") as { connectionId: string };
  await connector.completePairing({ connectionId: first.connectionId, pairingCode: reusable });
  const replay = await connector.beginPairing(domain, "Alphonse") as { connectionId: string };
  await expectCode(connector.completePairing({ connectionId: replay.connectionId, pairingCode: reusable }), "pairing_code_replayed");

  const limited = await connector.beginPairing(domain, "Alphonse") as { connectionId: string };
  await expectCode(connector.completePairing({ connectionId: limited.connectionId, pairingCode: "BAD001" }), "pairing_code_invalid");
  await expectCode(connector.completePairing({ connectionId: limited.connectionId, pairingCode: "BAD002" }), "pairing_code_invalid");
  await expectCode(connector.completePairing({ connectionId: limited.connectionId, pairingCode: "BAD003" }), "pairing_rate_limited");
});

test("rejects a discovery document changed after signing", async (t) => {
  const host = new ReferenceHost();
  const { domain } = await host.start();
  t.after(() => host.stop());
  host.tamperWithDiscoverySignature();
  const { connector } = await connectorFixture();
  await expectCode(connector.discover(domain), "signature_invalid");
});

test("rejects server-revoked credentials", async (t) => {
  const host = new ReferenceHost();
  const { domain } = await host.start();
  t.after(() => host.stop());
  const { connector } = await connectorFixture();
  const registration = await pair(connector, host, domain);
  host.revokeAllRegistrations();
  await expectCode(connector.listEngagements(registration.registrationId), "credential_revoked");
});

test("detects DPoP proof replay", () => {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const privateJwk = privateKey.export({ format: "jwk" });
  const url = new URL("https://platform.example/resource?ignored=yes");
  const proof = createDpopProof("GET", url, privateJwk, "token");
  const replayCache = new Set<string>();
  verifyDpopProof(proof, "GET", url, { accessToken: "token", replayCache });
  assert.throws(() => verifyDpopProof(proof, "GET", url, { accessToken: "token", replayCache }), /replay/u);
  const wrongMethod = createDpopProof("GET", url, privateJwk, "token");
  assert.throws(() => verifyDpopProof(wrongMethod, "POST", url, { accessToken: "token" }), /binding/u);
  const wrongToken = createDpopProof("GET", url, privateJwk, "token");
  assert.throws(() => verifyDpopProof(wrongToken, "GET", url, { accessToken: "other-token" }), /token hash/u);
  const wrongKey = createDpopProof("GET", url, privateJwk, "token");
  assert.throws(() => verifyDpopProof(wrongKey, "GET", url, { accessToken: "token", expectedThumbprint: "different" }), /key binding/u);
  assert.ok(publicKey);
});

async function expectCode(operation: Promise<unknown>, code: string): Promise<void> {
  await assert.rejects(operation, (error: unknown) => {
    assert.equal((error as ByoagError).code, code);
    return true;
  });
}
