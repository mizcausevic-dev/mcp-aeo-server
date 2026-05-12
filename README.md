# mcp-aeo-server

An **MCP server** that exposes [AEO Protocol](https://github.com/mizcausevic-dev/aeo-protocol-spec) declarations as tools any MCP-compatible AI agent can call — Claude Desktop, Cursor, [Codex CLI](https://github.com/anthropics/claude-cli), or any custom client.

Drop the server config into your MCP client and the agent gains four tools:

| Tool | What it does |
|---|---|
| `aeo_fetch` | Fetch the full `/.well-known/aeo.json` for an origin |
| `aeo_inspect` | Return a structured summary (entity, claim count, audit mode) — cheaper for context-window-constrained agents |
| `aeo_get_claim` | Extract a single claim by ID; surfaces available IDs when the requested one is missing |
| `aeo_well_known_url` | Compute the canonical well-known URL without fetching |

Each tool ships with a conforming [MCP Tool Card](https://github.com/mizcausevic-dev/mcp-tool-card-spec) document in [`tool-cards/`](tool-cards/).

## Install

```bash
npm install -g @mizcausevic-dev/mcp-aeo-server
```

Or run without installing via `npx`:

```bash
npx @mizcausevic-dev/mcp-aeo-server
```

## Claude Desktop config

Add to your `claude_desktop_config.json` (macOS: `~/Library/Application Support/Claude/`, Windows: `%APPDATA%\Claude\`):

```json
{
  "mcpServers": {
    "aeo": {
      "command": "npx",
      "args": ["-y", "@mizcausevic-dev/mcp-aeo-server"]
    }
  }
}
```

Restart Claude Desktop. The four `aeo_*` tools will appear in Claude's tools panel and the model can invoke them directly. Try:

> *"Use the aeo_inspect tool to show me what mizcausevic-dev.github.io declares about itself."*

Claude will call `aeo_inspect({ origin: "https://mizcausevic-dev.github.io" })` and respond with the entity summary it received.

## Cursor / Continue / other MCP clients

Any client that speaks MCP over stdio works. Point its server config at `npx @mizcausevic-dev/mcp-aeo-server` with no arguments.

## Tools

### `aeo_fetch`
```json
{ "origin": "https://mizcausevic-dev.github.io" }
```
Returns the full conforming AEO document as JSON.

### `aeo_inspect`
```json
{ "origin": "https://mizcausevic-dev.github.io" }
```
Returns:
```json
{
  "protocol": "0.1",
  "entity": {
    "id": "https://mizcausevic-dev.github.io/#person",
    "type": "Person",
    "name": "Miz Causevic",
    "canonical_url": "https://mizcausevic-dev.github.io/"
  },
  "primary_source_count": 4,
  "verification_count": 3,
  "claim_count": 6,
  "claim_ids": ["current-role", "location", "years-experience", "live-products", "primary-stack", "authored-spec"],
  "audit_mode": "none"
}
```

### `aeo_get_claim`
```json
{ "origin": "https://mizcausevic-dev.github.io", "claim_id": "years-experience" }
```
Returns the single matching claim, or — if the ID doesn't exist — `{ "error": "claim_not_found", "available_claim_ids": [...] }`.

### `aeo_well_known_url`
```json
{ "origin": "https://example.com/" }
```
Returns `{ "url": "https://example.com/.well-known/aeo.json" }`.

## How this fits the Kinetic Gain Protocol Suite

- The **server itself** uses AEO Protocol semantics (Tool Cards published in [`tool-cards/`](tool-cards/), conforming to [mcp-tool-card-spec](https://github.com/mizcausevic-dev/mcp-tool-card-spec))
- The **tools** read AEO Protocol documents conforming to [aeo-protocol-spec](https://github.com/mizcausevic-dev/aeo-protocol-spec)
- Together they close a loop: an AEO declaration somewhere on the web → an MCP server that lets any AI agent reason about it

## Conformance

- **AEO Protocol** support: Level 1 (Declare). Signature verification (L2) and audit submission (L3) are deferred to v0.2.
- **MCP Tool Cards** support: Level 2 (Safety) for every tool, conforming to the v0.1 spec.

## Development

```bash
npm install
npm run typecheck
npm test
npm run build
```

Tests use a small in-process HTTP server (Node `node:http`) to serve a fixture AEO document. No external network required.

## Compatibility

- Node `18+`
- `@modelcontextprotocol/sdk` `^1.0`
- Tested with Claude Desktop and any MCP client speaking stdio

## License

AGPL-3.0.

## Kinetic Gain Protocol Suite

| Spec | Implementations |
|---|---|
| [AEO Protocol](https://github.com/mizcausevic-dev/aeo-protocol-spec) | [aeo-sdk-python](https://github.com/mizcausevic-dev/aeo-sdk-python) · [aeo-sdk-typescript](https://github.com/mizcausevic-dev/aeo-sdk-typescript) · [aeo-sdk-rust](https://github.com/mizcausevic-dev/aeo-sdk-rust) · [aeo-sdk-go](https://github.com/mizcausevic-dev/aeo-sdk-go) · [aeo-sdk-swift](https://github.com/mizcausevic-dev/aeo-sdk-swift) · [aeo-cli](https://github.com/mizcausevic-dev/aeo-cli) · [aeo-crawler](https://github.com/mizcausevic-dev/aeo-crawler) |
| [Prompt Provenance](https://github.com/mizcausevic-dev/prompt-provenance-spec) | — |
| [Agent Cards](https://github.com/mizcausevic-dev/agent-cards-spec) | — |
| [AI Evidence Format](https://github.com/mizcausevic-dev/ai-evidence-format-spec) | — |
| [MCP Tool Cards](https://github.com/mizcausevic-dev/mcp-tool-card-spec) | **mcp-aeo-server** (this) |

---

**Connect:** [LinkedIn](https://www.linkedin.com/in/mirzacausevic/) · [Kinetic Gain](https://kineticgain.com) · [Medium](https://medium.com/@mizcausevic/) · [Skills](https://mizcausevic.com/skills/)
