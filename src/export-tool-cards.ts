#!/usr/bin/env node
import { exportToolCards } from "./tool-cards.js";

try {
  const webRoot = process.argv[2];
  if (!webRoot) throw new TypeError("Usage: npm run tool-cards:export -- <absolute-web-root>");
  for (const file of exportToolCards(webRoot)) console.log(file);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
