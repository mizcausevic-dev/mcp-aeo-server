/**
 * MCP tool descriptors. Each tool has an input JSON Schema that the
 * MCP client (Claude / Cursor / etc.) consumes for argument validation.
 *
 * For each tool, a conforming MCP Tool Card document lives in
 * tool-cards/ at the repo root and is served alongside the package.
 */
export const toolDescriptors = [
  {
    name: "aeo_fetch",
    description:
      "Fetch the full AEO Protocol declaration document at an origin's well-known URL (/.well-known/aeo.json). Returns the raw conforming JSON document.",
    inputSchema: {
      type: "object",
      required: ["origin"],
      additionalProperties: false,
      properties: {
        origin: {
          type: "string",
          format: "uri",
          description:
            "Origin URL to discover (e.g. 'https://mizcausevic-dev.github.io').",
        },
      },
    },
  },
  {
    name: "aeo_inspect",
    description:
      "Return a structured summary of an AEO declaration: entity name + type + canonical URL, source/verification counts, claim count + IDs, audit mode. Cheaper than aeo_fetch for context-window-constrained agents.",
    inputSchema: {
      type: "object",
      required: ["origin"],
      additionalProperties: false,
      properties: {
        origin: {
          type: "string",
          format: "uri",
          description: "Origin URL to inspect.",
        },
      },
    },
  },
  {
    name: "aeo_get_claim",
    description:
      "Extract a single claim by ID from an origin's AEO declaration. Returns the claim object or an 'claim_not_found' error with the list of available claim IDs.",
    inputSchema: {
      type: "object",
      required: ["origin", "claim_id"],
      additionalProperties: false,
      properties: {
        origin: {
          type: "string",
          format: "uri",
          description: "Origin URL to query.",
        },
        claim_id: {
          type: "string",
          description: "Claim ID to extract (e.g. 'current-role').",
        },
      },
    },
  },
  {
    name: "aeo_well_known_url",
    description:
      "Compute the canonical well-known URL for an origin, without fetching. Returns { url: string }.",
    inputSchema: {
      type: "object",
      required: ["origin"],
      additionalProperties: false,
      properties: {
        origin: {
          type: "string",
          format: "uri",
          description: "Origin URL.",
        },
      },
    },
  },
];
