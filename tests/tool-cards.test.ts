import { lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it } from "vitest";

import { buildServer } from "../src/server.js";
import { exportToolCards } from "../src/tool-cards.js";
import { toolDescriptors, toolsWithCardUris } from "../src/tools.js";

describe("Tool Card discovery", () => {
  it("exports every bundled card at its canonical well-known path", () => {
    const root = mkdtempSync(join(tmpdir(), "mcp-aeo-cards-"));
    try {
      expect(dirname(realpathSync(root))).toBe(realpathSync(tmpdir()));
      const files = exportToolCards(root);
      expect(files).toHaveLength(toolDescriptors.length);
      for (const tool of toolDescriptors) {
        const file = join(root, ".well-known", "mcp-tools", `${tool.name}.json`);
        expect(files).toContain(file);
        expect(JSON.parse(readFileSync(file, "utf8")).tool.name).toBe(tool.name);
      }
    } finally {
      if (dirname(realpathSync(root)) === realpathSync(tmpdir())) {
        rmSync(root, { recursive: true, force: true });
      }
    }
  });

  it("refuses an existing destination without changing card bytes", () => {
    const root = mkdtempSync(join(tmpdir(), "mcp-aeo-existing-"));
    try {
      expect(dirname(realpathSync(root))).toBe(realpathSync(tmpdir()));
      const destination = join(root, ".well-known", "mcp-tools");
      mkdirSync(destination, { recursive: true });
      const existing = join(destination, "aeo_fetch.json");
      const original = "pre-existing card bytes\n";
      writeFileSync(existing, original);

      expect(() => exportToolCards(root)).toThrow(/destination already exists/);
      expect(readFileSync(existing, "utf8")).toBe(original);
    } finally {
      if (dirname(realpathSync(root)) === realpathSync(tmpdir())) {
        rmSync(root, { recursive: true, force: true });
      }
    }
  });

  it("rejects a symlinked discovery directory without writing outside staging", () => {
    const parent = realpathSync(tmpdir());
    const root = mkdtempSync(join(parent, "mcp-aeo-link-root-"));
    const outside = mkdtempSync(join(parent, "mcp-aeo-link-outside-"));
    const link = join(root, ".well-known");
    try {
      expect(dirname(realpathSync(root))).toBe(parent);
      expect(dirname(realpathSync(outside))).toBe(parent);
      symlinkSync(outside, link, process.platform === "win32" ? "junction" : "dir");

      expect(() => exportToolCards(root)).toThrow(/symbolic link/);
      expect(readdirSync(outside)).toEqual([]);
    } finally {
      if (lstatSync(link, { throwIfNoEntry: false })?.isSymbolicLink()) unlinkSync(link);
      if (dirname(realpathSync(root)) === parent) rmSync(root, { recursive: true, force: true });
      if (dirname(realpathSync(outside)) === parent) rmSync(outside, { recursive: true, force: true });
    }
  });

  it("rejects an unsafe discovery origin and leaves metadata off by default", () => {
    expect(toolsWithCardUris()).toBe(toolDescriptors);
    for (const origin of ["http://cards.example", "https://user:pass@cards.example", "https://cards.example/path", "https://127.0.0.1"]) {
      expect(() => toolsWithCardUris(origin)).toThrow();
    }
  });

  it("exposes configured card URIs to a real MCP client", async () => {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = buildServer({ toolCardOrigin: "https://cards.example/" });
    const client = new Client({ name: "tool-card-test", version: "0.1.0" });
    try {
      await server.connect(serverTransport);
      await client.connect(clientTransport);
      const result = await client.listTools();
      expect(result.tools).toHaveLength(toolDescriptors.length);
      for (const tool of result.tools) {
        expect(tool._meta?.["x-tool-card-uri"]).toBe(
          `https://cards.example/.well-known/mcp-tools/${tool.name}.json`,
        );
      }
    } finally {
      await client.close();
      await server.close();
    }
  });
});
