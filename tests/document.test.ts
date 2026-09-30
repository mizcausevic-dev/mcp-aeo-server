import { describe, expect, it } from "vitest";
import { fetchWellKnown, isPublicAddress, parseDocument, wellKnownUrl } from "../src/document.js";

const valid = {
  aeo_version: "0.1",
  entity: {
    id: "https://example.com/#org",
    type: "Organization",
    name: "Example Org",
    canonical_url: "https://example.com/",
  },
  authority: { primary_sources: ["https://example.com/"] },
  claims: [{ id: "tagline", predicate: "description", value: "test" }],
  audit: { mode: "none" },
};

describe("document validation", () => {
  it("accepts a Level 1 declaration", () => {
    expect(parseDocument(JSON.stringify(valid)).claims).toHaveLength(1);
  });

  it("rejects missing claim values and duplicate claim IDs", () => {
    const missing = structuredClone(valid);
    delete (missing.claims[0] as Partial<typeof missing.claims[0]>).value;
    expect(() => parseDocument(JSON.stringify(missing))).toThrow();

    const duplicate = structuredClone(valid);
    duplicate.claims.push({ ...duplicate.claims[0]! });
    expect(() => parseDocument(JSON.stringify(duplicate))).toThrow();
  });

  it("rejects unsigned signature and endpoint modes", () => {
    for (const mode of ["signature", "endpoint"]) {
      const doc = { ...valid, audit: { mode, endpoint_uri: "https://example.com/audit" } };
      expect(() => parseDocument(JSON.stringify(doc))).toThrow();
    }
  });
});

describe("network boundary", () => {
  it("rejects unsafe origin inputs before networking", async () => {
    for (const origin of ["http://example.com", "https://127.0.0.1", "https://[::1]"]) {
      expect(() => wellKnownUrl(origin)).toThrow();
      await expect(fetchWellKnown(origin)).rejects.toThrow();
    }
    await expect(fetchWellKnown("https://localhost", { timeoutMs: 1000 }))
      .rejects.toThrow("non-public address");
  });

  it("rejects private and allows public address examples", () => {
    expect(isPublicAddress("169.254.169.254", 4)).toBe(false);
    expect(isPublicAddress("10.1.2.3", 4)).toBe(false);
    expect(isPublicAddress("::ffff:127.0.0.1", 6)).toBe(false);
    expect(isPublicAddress("2002:7f00:1::", 6)).toBe(false);
    expect(isPublicAddress("8.8.8.8", 4)).toBe(true);
    expect(isPublicAddress("2606:4700:4700::1111", 6)).toBe(true);
  });
});
