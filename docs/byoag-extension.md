# `ai.byoag` Agent Plugins extension

Status: proposal draft 0.1.0

This document proposes a backward-compatible extension to the [Agent Plugins 1.0.0](https://agent-plugins.org/) package format. It does not modify the Agent Plugins portable core.

## Packaging approach

The root `plugin.json` remains valid under the closed Agent Plugins schema. BYOAg metadata is placed under the reverse-domain namespace owned by `byoag.ai`:

```json
{
  "$schema": "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
  "name": "byoag",
  "version": "0.1.0",
  "extensions": {
    "ai.byoag": {
      "manifest": "./byoag.json"
    }
  }
}
```

Legacy clients ignore the namespace and load the ordinary skill and MCP configuration. BYOAg-aware clients resolve and validate `byoag.json` within the plugin root.

The root extension object is deliberately small so future extension-manifest versions can evolve independently from Agent Plugins.

## Native client responsibilities

A client claiming full conformance must provide:

- Protected secret and confirmation input outside model context.
- Secure credential and private-key storage.
- Pairwise platform identities by default.
- Domain-bound discovery and signature validation.
- Registration and concurrent engagement lifecycle management.
- Dynamic MCP capability isolation per engagement.
- Signed declarative skill verification and scoped activation.
- Data-label propagation and cross-tool enforcement.
- Clean teardown without changing unrelated agent configuration.

## Backward-compatible responsibilities

The static bootstrap skill explains the flow and uses a single local MCP connector. The connector mediates dynamic platforms; `mcp.json` does not list every platform endpoint. Compatibility clients declare their limitations during negotiation.

## Candidate extension manifest

The extension manifest is expected to declare:

- Extension specification version.
- Bootstrap mode and MCP connector name.
- Supported discovery and pairing versions.
- Required security properties.
- Client conformance mode.
- References to local schemas or policy files contained within the plugin.

The initial JSON Schema is [plugin-extension.schema.json](../schemas/plugin-extension.schema.json). The package will add a concrete root `byoag.json` only when the connector contract is implemented, avoiding a manifest that advertises unavailable runtime behavior.

## Compatibility invariant

The extension may add native behavior but must not change the meaning of the Agent Plugins core files or make the static skill invalid. A client that ignores `ai.byoag` should still load a truthful, useful compatibility-mode skill.
