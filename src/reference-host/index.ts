#!/usr/bin/env node
import { ReferenceHost, type ConfirmationMode } from "./server.js";

const mode = (process.env.BYOAG_CONFIRMATION_MODE ?? "code-is-consent") as ConfirmationMode;
if (mode !== "code-is-consent" && mode !== "platform-confirmation") {
  throw new Error("BYOAG_CONFIRMATION_MODE must be code-is-consent or platform-confirmation.");
}

const host = new ReferenceHost({ confirmationMode: mode });
const { origin, domain } = await host.start();
const code = host.issuePairingCode();
console.error(`BYOAg reference host: ${origin}`);
console.error(`Discovery domain: ${domain}`);
console.error(`Development pairing code: ${code}`);

const shutdown = () => { void host.stop(); };
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
