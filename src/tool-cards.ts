import { lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { toolDescriptors } from "./tools.js";

/** Copy bundled cards to their canonical paths under an HTTPS site's web root. */
export function exportToolCards(webRoot: string): string[] {
  if (!webRoot || !isAbsolute(webRoot)) {
    throw new TypeError("Tool Card web root must be an absolute directory path");
  }
  const cards = toolDescriptors.map((tool) => {
    const sourceName = `${tool.name.replaceAll("_", "-")}.json`;
    const source = fileURLToPath(new URL(`../tool-cards/${sourceName}`, import.meta.url));
    const content = readFileSync(source, "utf8");
    const card: unknown = JSON.parse(content);
    if (
      typeof card !== "object" || card === null ||
      !('tool' in card) || typeof card.tool !== "object" || card.tool === null ||
      !('name' in card.tool) || card.tool.name !== tool.name
    ) {
      throw new Error(`Bundled Tool Card does not match ${tool.name}`);
    }
    return { name: tool.name, content };
  });

  const root = resolve(webRoot);
  mkdirSync(root, { recursive: true });
  if (lstatSync(root).isSymbolicLink()) {
    throw new Error("Tool Card web root must not be a symbolic link");
  }
  const wellKnown = join(root, ".well-known");
  mkdirSync(wellKnown, { recursive: true });
  if (lstatSync(wellKnown).isSymbolicLink()) {
    throw new Error("Tool Card discovery directory must not be a symbolic link");
  }
  const destination = join(wellKnown, "mcp-tools");
  // Requiring a new directory prevents stale or existing cards from being
  // silently overwritten. The exclusive file flag also protects against races.
  try {
    mkdirSync(destination);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      throw new Error("Tool Card destination already exists; use a fresh staging web root");
    }
    throw error;
  }
  const withinRoot = relative(realpathSync(root), realpathSync(destination));
  if (withinRoot === ".." || withinRoot.startsWith(`..${sep}`) || isAbsolute(withinRoot)) {
    throw new Error("Tool Card destination escapes the staging web root");
  }

  const output: string[] = [];
  for (const card of cards) {
    const target = join(destination, `${card.name}.json`);
    writeFileSync(target, card.content, { flag: "wx" });
    output.push(target);
  }
  return output;
}
