import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type Server as HttpServer } from "node:http";

import {
  handleAeoFetch,
  handleAeoGetClaim,
  handleAeoInspect,
  handleAeoWellKnownUrl,
} from "../src/server.js";

let server: HttpServer;
let originUrl: string;

const exampleDoc = {
  aeo_version: "0.1",
  entity: {
    id: "https://example.com/#org",
    type: "Organization",
    name: "Example Org",
    canonical_url: "https://example.com/",
  },
  authority: {
    primary_sources: ["https://example.com/"],
    verifications: [{ type: "domain", value: "example.com" }],
  },
  claims: [
    { id: "tagline", predicate: "description", value: "test", confidence: "high" },
    { id: "year-founded", predicate: "foundingDate", value: 2026, confidence: "high" },
  ],
  audit: { mode: "none" },
};

beforeAll(async () => {
  server = createServer((req, res) => {
    if (req.url === "/.well-known/aeo.json") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(exampleDoc));
    } else {
      res.writeHead(404);
      res.end("not found");
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  if (typeof addr === "object" && addr !== null) {
    originUrl = `http://127.0.0.1:${addr.port}`;
  }
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe("aeo_fetch", () => {
  it("returns the full document JSON", async () => {
    const out = await handleAeoFetch({ origin: originUrl });
    const parsed = JSON.parse(out);
    expect(parsed.entity.name).toBe("Example Org");
    expect(parsed.claims).toHaveLength(2);
  });
});

describe("aeo_inspect", () => {
  it("returns a structured summary", async () => {
    const out = await handleAeoInspect({ origin: originUrl });
    const summary = JSON.parse(out);
    expect(summary.protocol).toBe("0.1");
    expect(summary.entity.name).toBe("Example Org");
    expect(summary.claim_count).toBe(2);
    expect(summary.claim_ids).toEqual(["tagline", "year-founded"]);
    expect(summary.audit_mode).toBe("none");
  });
});

describe("aeo_get_claim", () => {
  it("returns a claim by ID", async () => {
    const out = await handleAeoGetClaim({ origin: originUrl, claim_id: "tagline" });
    const claim = JSON.parse(out);
    expect(claim.predicate).toBe("description");
    expect(claim.value).toBe("test");
  });

  it("returns a not-found error with available IDs", async () => {
    const out = await handleAeoGetClaim({
      origin: originUrl,
      claim_id: "does-not-exist",
    });
    const err = JSON.parse(out);
    expect(err.error).toBe("claim_not_found");
    expect(err.available_claim_ids).toEqual(["tagline", "year-founded"]);
  });
});

describe("aeo_well_known_url", () => {
  it("appends the well-known path", async () => {
    const out = await handleAeoWellKnownUrl({ origin: "https://example.com" });
    expect(JSON.parse(out).url).toBe(
      "https://example.com/.well-known/aeo.json",
    );
  });

  it("strips trailing slashes", async () => {
    const out = await handleAeoWellKnownUrl({ origin: "https://example.com///" });
    expect(JSON.parse(out).url).toBe(
      "https://example.com/.well-known/aeo.json",
    );
  });
});
