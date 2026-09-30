# mcp-aeo-server

An **MCP server** that exposes [AEO Protocol](https://github.com/mizcausevic-dev/aeo-protocol-spec) declarations as tools for MCP clients such as Claude Desktop, Cursor, and [Codex CLI](https://github.com/openai/codex).

The server provides four tools to a compatible stdio MCP client:

| Tool | What it does |
|---|---|
| `aeo_fetch` | Fetch the full `/.well-known/aeo.json` for an origin |
| `aeo_inspect` | Return a structured summary (entity, claim count, audit mode) — cheaper for context-window-constrained agents |
| `aeo_get_claim` | Extract a single claim by ID; surfaces available IDs when the requested one is missing |
| `aeo_well_known_url` | Compute the canonical well-known URL without fetching |

Each tool has a bundled [MCP Tool Card](https://github.com/mizcausevic-dev/mcp-tool-card-spec) JSON document in [`tool-cards/`](tool-cards/) describing its inputs and safety properties. An operator can export these cards to a web root for HTTPS discovery. This repository does not host that web root, so live Tool Card conformance is not claimed.

## Run from source

```bash
git clone https://github.com/mizcausevic-dev/mcp-aeo-server.git
cd mcp-aeo-server
npm ci
npm run build
node dist/server.js
```

The package is not yet available from the public npm registry. The `npx` and global-install commands will work only after a package release is verified there.

## Tool Card HTTPS discovery

The stdio server does not expose an HTTP endpoint. After building, export the four bundled cards into a fresh staging web root for a separate HTTPS host:

```bash
npm run tool-cards:export -- /absolute/path/to/staging-web-root
```

This writes `.well-known/mcp-tools/aeo_fetch.json`, `aeo_inspect.json`, `aeo_get_claim.json`, and `aeo_well_known_url.json` beneath that root. Export fails if the `mcp-tools` directory already exists, so use a fresh staging directory for each run. Replace the hosted `mcp-tools` directory with the verified four-file set, then check each public `https://<your-host>/.well-known/mcp-tools/<tool-name>.json` URL returns the matching card with JSON content type. Only then set `MCP_AEO_TOOL_CARD_ORIGIN` to that HTTPS origin in the MCP client environment (for example `https://cards.example.com`). The server includes each canonical URL in `tools/list` as `x-tool-card-uri` and `_meta["x-tool-card-uri"]`. With the variable unset it advertises no Tool Card URI; invalid or non-HTTPS values stop startup. The export and MCP listing checks run locally, but live HTTPS hosting remains an operator release step.

## Claude Desktop config

Add to your `claude_desktop_config.json` (macOS: `~/Library/Application Support/Claude/`, Windows: `%APPDATA%\Claude\`):

```json
{
  "mcpServers": {
    "aeo": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-aeo-server/dist/server.js"]
    }
  }
}
```

Replace the example path with the absolute path to your built checkout (for example, `C:/Users/you/mcp-aeo-server/dist/server.js` on Windows), then restart Claude Desktop. Try:

> *"Use the aeo_inspect tool to show me what mizcausevic-dev.github.io declares about itself."*

Claude will call `aeo_inspect({ origin: "https://mizcausevic-dev.github.io" })` and respond with the entity summary it received.

## Cursor / Continue / other MCP clients

Point a client's stdio server config at `node` with the absolute `dist/server.js` path as its argument.

## Tools

All origin inputs must be public HTTPS hostnames without a path, query, or fragment. The fetch tools reject direct IP addresses and DNS answers in private or reserved ranges; they make outbound requests to the named origin.

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

- The **server** bundles Tool Card metadata in [`tool-cards/`](tool-cards/) for each exposed tool and can export canonical HTTPS discovery files; an operator must host and verify them.
- The **tools** read AEO Protocol documents conforming to [aeo-protocol-spec](https://github.com/mizcausevic-dev/aeo-protocol-spec)
- Together they close a loop: an AEO declaration somewhere on the web → an MCP server that lets any AI agent reason about it

## Conformance

- **AEO Protocol** support: Level 1 (Declare). Signature verification (L2) and audit submission (L3) are deferred to v0.2.
- **MCP Tool Cards**: Four bundled cards with safety fields, an export path, and opt-in MCP discovery metadata. Public HTTPS serving and conformance are unverified until an operator publishes the files.

## Development

```bash
npm install
npm run typecheck
npm test
npm run build
```

Tests use a local fixture for tool handlers and check that unsafe origin and address inputs are rejected. No external network required.

## Compatibility

- Node `20+`
- `@modelcontextprotocol/sdk` `^1.0`
- Uses MCP over stdio; client-specific configuration remains to be verified in each client

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
