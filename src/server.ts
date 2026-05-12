#!/usr/bin/env node
/**
 * MCP server exposing AEO Protocol declarations as tools.
 *
 * Tools:
 *   - aeo_fetch     : fetch an origin's /.well-known/aeo.json
 *   - aeo_inspect   : return a structured summary of an AEO document
 *   - aeo_get_claim : extract a specific claim by ID
 *
 * Designed to drop into Claude Desktop / Cursor / any MCP-compatible
 * client via stdio transport.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import {
  type AeoDocument,
  claimIds,
  fetchWellKnown,
  findClaim,
  wellKnownUrl,
} from "./document.js";
import { toolDescriptors } from "./tools.js";

function summarize(doc: AeoDocument): {
  protocol: string;
  entity: { id: string; type: string; name: string; canonical_url: string };
  primary_source_count: number;
  verification_count: number;
  claim_count: number;
  claim_ids: string[];
  audit_mode: string | null;
} {
  return {
    protocol: doc.aeo_version,
    entity: {
      id: doc.entity.id,
      type: doc.entity.type,
      name: doc.entity.name,
      canonical_url: doc.entity.canonical_url,
    },
    primary_source_count: doc.authority.primary_sources.length,
    verification_count: doc.authority.verifications?.length ?? 0,
    claim_count: doc.claims.length,
    claim_ids: claimIds(doc),
    audit_mode: doc.audit?.mode ?? null,
  };
}

export async function handleAeoFetch(args: { origin: string }): Promise<string> {
  const doc = await fetchWellKnown(args.origin);
  return JSON.stringify(doc, null, 2);
}

export async function handleAeoInspect(args: { origin: string }): Promise<string> {
  const doc = await fetchWellKnown(args.origin);
  return JSON.stringify(summarize(doc), null, 2);
}

export async function handleAeoGetClaim(args: {
  origin: string;
  claim_id: string;
}): Promise<string> {
  const doc = await fetchWellKnown(args.origin);
  const claim = findClaim(doc, args.claim_id);
  if (!claim) {
    return JSON.stringify(
      {
        error: "claim_not_found",
        claim_id: args.claim_id,
        available_claim_ids: claimIds(doc),
      },
      null,
      2,
    );
  }
  return JSON.stringify(claim, null, 2);
}

export async function handleAeoWellKnownUrl(args: {
  origin: string;
}): Promise<string> {
  return JSON.stringify({ url: wellKnownUrl(args.origin) }, null, 2);
}

const handlers: Record<string, (args: any) => Promise<string>> = {
  aeo_fetch: handleAeoFetch,
  aeo_inspect: handleAeoInspect,
  aeo_get_claim: handleAeoGetClaim,
  aeo_well_known_url: handleAeoWellKnownUrl,
};

export function buildServer(): Server {
  const server = new Server(
    {
      name: "mcp-aeo-server",
      version: "0.1.0",
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: toolDescriptors,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const handler = handlers[name];
    if (!handler) {
      return {
        content: [{ type: "text", text: `unknown tool: ${name}` }],
        isError: true,
      };
    }
    try {
      const result = await handler(args ?? {});
      return {
        content: [{ type: "text", text: result }],
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text", text: message }],
        isError: true,
      };
    }
  });

  return server;
}

async function main(): Promise<void> {
  const server = buildServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write("mcp-aeo-server: listening on stdio\n");
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}`) {
  main().catch((err) => {
    process.stderr.write(`mcp-aeo-server: fatal: ${err}\n`);
    process.exit(1);
  });
}
