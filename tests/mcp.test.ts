import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";

import { createMcpServer } from "../src/server.js";

test("publishes the generic connector tool surface over MCP", async () => {
  const connector = {
    discover: async () => ({ displayName: "Example" }),
    beginPairing: async () => ({}),
    completePairing: async () => ({}),
    listRegistrations: async () => ({ registrations: [] }),
    listEngagements: async () => ({ engagements: [] }),
    disconnect: async () => ({}),
  };
  const server = createMcpServer(connector as never);
  const client = new Client({ name: "byoag-test", version: "0.1.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  const tools = await client.listTools();
  assert.deepEqual(
    tools.tools.map((tool) => tool.name).sort(),
    [
      "byoag_begin_pairing",
      "byoag_complete_pairing",
      "byoag_disconnect",
      "byoag_discover",
      "byoag_list_engagements",
      "byoag_list_registrations",
    ],
  );

  const result = await client.callTool({ name: "byoag_list_registrations", arguments: {} });
  assert.equal(result.isError, undefined);
  assert.deepEqual(result.structuredContent, { registrations: [] });
  await Promise.all([client.close(), server.close()]);
});

test("launches through the compiled stdio entry point used by mcp.json", async () => {
  const dataDirectory = await mkdtemp(path.join(os.tmpdir(), "byoag-stdio-test-"));
  const client = new Client({ name: "byoag-stdio-test", version: "0.1.0" });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.resolve("dist/src/index.js")],
    env: {
      ...process.env,
      BYOAG_DATA_DIR: dataDirectory,
      BYOAG_PLUGIN_ROOT: path.resolve("."),
    },
    stderr: "pipe",
  });
  await client.connect(transport);
  const result = await client.callTool({ name: "byoag_list_registrations", arguments: {} });
  assert.deepEqual(result.structuredContent, { registrations: [] });
  await client.close();
});
