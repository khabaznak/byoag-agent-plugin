import {
  createHash,
  createPrivateKey,
  createPublicKey,
  randomUUID,
  sign,
  verify,
} from "node:crypto";

import canonicalize from "canonicalize";

import { ByoagError } from "./errors.js";

export interface SignatureEnvelope {
  alg: "EdDSA";
  kid: string;
  value: string;
}

export interface SignedDocument extends Record<string, unknown> {
  signature: SignatureEnvelope;
}

export function canonicalJson(value: unknown): string {
  const result = canonicalize(value);
  if (result === undefined) throw new ByoagError("discovery_invalid", "The signed JSON value cannot be canonicalized.");
  return result;
}

export function signDocument<T extends Record<string, unknown>>(
  document: T,
  privateJwk: JsonWebKey,
  kid: string,
  type: string,
): T & { signature: SignatureEnvelope } {
  if (Object.hasOwn(document, "signature")) throw new Error("Document already contains a signature field.");
  const protectedHeader = encodeJson({ alg: "EdDSA", kid, typ: type });
  const payload = base64url(Buffer.from(canonicalJson(document), "utf8"));
  const signature = sign(null, Buffer.from(`${protectedHeader}.${payload}`), createPrivateKey({ key: privateJwk, format: "jwk" }));
  return { ...document, signature: { alg: "EdDSA", kid, value: `${protectedHeader}..${base64url(signature)}` } };
}

export function verifyDocumentSignature(
  document: SignedDocument,
  keys: JsonWebKey[],
  expectedType: string,
): void {
  try {
    const { signature, ...unsigned } = document;
    if (signature.alg !== "EdDSA") throw new ByoagError("signature_invalid", "The document signature algorithm is not supported.");
    const parts = signature.value.split(".");
    if (parts.length !== 3 || parts[1] !== "") throw new ByoagError("signature_invalid", "The document signature is not a detached JWS.");
    const [protectedValue, , signatureValue] = parts;
    const header = decodeJson(protectedValue!) as Record<string, unknown>;
    if (Object.keys(header).sort().join(",") !== "alg,kid,typ") {
      throw new ByoagError("signature_invalid", "The document signature header contains unsupported fields.");
    }
    if (header.alg !== "EdDSA" || header.kid !== signature.kid || header.typ !== expectedType) {
      throw new ByoagError("signature_invalid", "The document signature header is invalid.");
    }
    const key = keys.find((candidate) => (candidate as JsonWebKey & { kid?: string }).kid === signature.kid && candidate.kty === "OKP" && candidate.crv === "Ed25519");
    if (!key) throw new ByoagError("signature_invalid", "The document signing key is unavailable.");
    const payload = base64url(Buffer.from(canonicalJson(unsigned), "utf8"));
    const valid = verify(
      null,
      Buffer.from(`${protectedValue}.${payload}`),
      createPublicKey({ key, format: "jwk" }),
      fromBase64url(signatureValue!),
    );
    if (!valid) throw new ByoagError("signature_invalid", "The document signature is invalid.");
  } catch (error) {
    if (error instanceof ByoagError) throw error;
    throw new ByoagError("signature_invalid", "The document signature is malformed.");
  }
}

export function jwkThumbprint(jwk: JsonWebKey): string {
  if (jwk.kty !== "OKP" || jwk.crv !== "Ed25519" || !jwk.x) throw new Error("Only Ed25519 public JWKs are supported.");
  const members = { crv: jwk.crv, kty: jwk.kty, x: jwk.x };
  return base64url(createHash("sha256").update(canonicalJson(members)).digest());
}

export function createDpopProof(
  method: string,
  url: URL,
  privateJwk: JsonWebKey,
  accessToken?: string,
  nonce?: string,
): string {
  const publicJwk = publicOnly(privateJwk);
  const header = encodeJson({ typ: "dpop+jwt", alg: "EdDSA", jwk: publicJwk });
  const payload: Record<string, unknown> = {
    jti: randomUUID(),
    htm: method.toUpperCase(),
    htu: dpopTargetUri(url),
    iat: Math.floor(Date.now() / 1000),
  };
  if (accessToken) payload.ath = base64url(createHash("sha256").update(accessToken, "ascii").digest());
  if (nonce) payload.nonce = nonce;
  const encodedPayload = encodeJson(payload);
  const signature = sign(null, Buffer.from(`${header}.${encodedPayload}`), createPrivateKey({ key: privateJwk, format: "jwk" }));
  return `${header}.${encodedPayload}.${base64url(signature)}`;
}

export interface DpopVerificationOptions {
  accessToken?: string;
  expectedThumbprint?: string;
  expectedNonce?: string;
  replayCache?: Set<string>;
  now?: number;
  maxAgeSeconds?: number;
}

export function verifyDpopProof(
  proof: string,
  method: string,
  url: URL,
  options: DpopVerificationOptions = {},
): { thumbprint: string; jti: string } {
  const parts = proof.split(".");
  if (parts.length !== 3) throw new Error("Malformed DPoP proof.");
  const [headerValue, payloadValue, signatureValue] = parts as [string, string, string];
  const header = decodeJson(headerValue) as { typ?: unknown; alg?: unknown; jwk?: JsonWebKey };
  const payload = decodeJson(payloadValue) as Record<string, unknown>;
  if (header.typ !== "dpop+jwt" || header.alg !== "EdDSA" || !header.jwk || header.jwk.d) throw new Error("Invalid DPoP header.");
  const publicKey = createPublicKey({ key: header.jwk, format: "jwk" });
  if (!verify(null, Buffer.from(`${headerValue}.${payloadValue}`), publicKey, fromBase64url(signatureValue))) {
    throw new Error("Invalid DPoP signature.");
  }
  const now = options.now ?? Math.floor(Date.now() / 1000);
  const maxAge = options.maxAgeSeconds ?? 300;
  if (payload.htm !== method.toUpperCase() || payload.htu !== dpopTargetUri(url)) throw new Error("DPoP request binding mismatch.");
  if (typeof payload.iat !== "number" || Math.abs(now - payload.iat) > maxAge) throw new Error("DPoP proof is outside the accepted time window.");
  if (typeof payload.jti !== "string" || payload.jti.length < 16) throw new Error("DPoP proof identifier is invalid.");
  if (options.replayCache?.has(payload.jti)) throw new Error("DPoP proof replay detected.");
  if (options.expectedNonce !== undefined && payload.nonce !== options.expectedNonce) throw new Error("DPoP nonce mismatch.");
  if (options.accessToken !== undefined) {
    const expectedAth = base64url(createHash("sha256").update(options.accessToken, "ascii").digest());
    if (payload.ath !== expectedAth) throw new Error("DPoP access-token hash mismatch.");
  }
  const thumbprint = jwkThumbprint(header.jwk);
  if (options.expectedThumbprint !== undefined && thumbprint !== options.expectedThumbprint) throw new Error("DPoP key binding mismatch.");
  options.replayCache?.add(payload.jti);
  return { thumbprint, jti: payload.jti };
}

export function dpopTargetUri(url: URL): string {
  const target = new URL(url);
  target.search = "";
  target.hash = "";
  return target.toString();
}

function publicOnly(jwk: JsonWebKey): JsonWebKey {
  const { d: _private, ...publicJwk } = jwk;
  return publicJwk;
}

function encodeJson(value: unknown): string {
  return base64url(Buffer.from(JSON.stringify(value), "utf8"));
}

function decodeJson(value: string): unknown {
  try {
    return JSON.parse(fromBase64url(value).toString("utf8")) as unknown;
  } catch {
    throw new Error("Invalid encoded JSON.");
  }
}

function base64url(value: Buffer): string {
  return value.toString("base64url");
}

function fromBase64url(value: string): Buffer {
  return Buffer.from(value, "base64url");
}
