#!/usr/bin/env node
import { serveStdio } from "@modelcontextprotocol/server/stdio";

import { createConnectorFromEnvironment } from "./runtime.js";
import { createMcpServer } from "./server.js";

async function main(): Promise<void> {
  const connector = await createConnectorFromEnvironment();
  const handle = serveStdio(() => createMcpServer(connector), {
    onerror: (error) => console.error("BYOAg MCP transport error:", error.message),
  });
  console.error("BYOAg connector 0.1.0 listening on stdio");
  process.on("SIGINT", () => { void handle.close(); });
  process.on("SIGTERM", () => { void handle.close(); });
}

main().catch((error: unknown) => {
  console.error("BYOAg connector failed to start:", error instanceof Error ? error.message : "unknown error");
  process.exitCode = 1;
});
