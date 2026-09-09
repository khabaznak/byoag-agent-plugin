import path from "node:path";
import { fileURLToPath } from "node:url";

import { ByoagConnector } from "./connector.js";
import { DomainPolicy } from "./domain.js";
import { SecureJsonHttpTransport } from "./http.js";
import { SchemaValidator } from "./schema-validator.js";
import { FileCredentialVault, StateRepository } from "./store.js";

export async function createConnectorFromEnvironment(): Promise<ByoagConnector> {
  const dataDirectory = process.env.BYOAG_DATA_DIR;
  if (!dataDirectory) throw new Error("BYOAG_DATA_DIR is required; Agent Plugins clients should provide it through PLUGIN_DATA.");
  const pluginRoot = process.env.BYOAG_PLUGIN_ROOT ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const allowLoopback = process.env.BYOAG_ALLOW_LOOPBACK === "true";
  const domainPolicy = new DomainPolicy({ allowLoopback });
  const schemas = await SchemaValidator.load(path.join(pluginRoot, "schemas"));
  return new ByoagConnector(
    new StateRepository(dataDirectory),
    new FileCredentialVault(dataDirectory),
    new SecureJsonHttpTransport(domainPolicy),
    schemas,
    domainPolicy,
  );
}
