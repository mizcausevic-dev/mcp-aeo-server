import { describe, expect, it, vi } from "vitest";

import {
  handleAeoFetch,
  handleAeoGetClaim,
  handleAeoInspect,
  handleAeoWellKnownUrl,
} from "../src/server.js";
import { isPublicAddress, wellKnownUrl } from "../src/document.js";

const originUrl = "https://example.com";

vi.mock("../src/document.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/document.js")>();
  return {
    ...actual,
    fetchWellKnown: vi.fn(async () => actual.parseDocument(JSON.stringify({
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
    }))),
  };
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

  it("rejects non-HTTPS, credentials, paths, and IP literals", () => {
    for (const origin of [
      "http://example.com",
      "https://user:pass@example.com",
      "https://example.com/other",
      "https://127.0.0.1",
      "https://[::1]",
      "https://example.com/?target=localhost",
    ]) {
      expect(() => wellKnownUrl(origin)).toThrow();
    }
  });
});

describe("network address gate", () => {
  it("denies loopback, private, link-local, mapped, and documentation addresses", () => {
    expect(isPublicAddress("127.0.0.1", 4)).toBe(false);
    expect(isPublicAddress("10.1.2.3", 4)).toBe(false);
    expect(isPublicAddress("169.254.169.254", 4)).toBe(false);
    expect(isPublicAddress("192.168.1.1", 4)).toBe(false);
    expect(isPublicAddress("::ffff:127.0.0.1", 6)).toBe(false);
    expect(isPublicAddress("2001:db8::1", 6)).toBe(false);
  });

  it("allows public IPv4 and global IPv6 addresses", () => {
    expect(isPublicAddress("8.8.8.8", 4)).toBe(true);
    expect(isPublicAddress("2606:4700:4700::1111", 6)).toBe(true);
  });
});
