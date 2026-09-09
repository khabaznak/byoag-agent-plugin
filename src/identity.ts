import { generateKeyPairSync, randomUUID } from "node:crypto";

import type { KeyMaterial, PendingIdentity } from "./types.js";

function generateEd25519Key(): KeyMaterial {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  return {
    publicKey: publicKey.export({ format: "jwk" }),
    privateKey: privateKey.export({ format: "jwk" }),
  };
}

export function generatePendingIdentity(): PendingIdentity {
  const pairwiseId = randomUUID();
  const installationId = randomUUID();
  const pairwiseKey = generateEd25519Key();
  const installationKey = generateEd25519Key();
  return { pairwiseId, installationId, pairwiseKey, installationKey };
}
