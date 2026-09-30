/**
 * Minimal AEO Protocol v0.1 types and discovery helpers.
 *
 * Kept self-contained so this package does not depend on
 * @mizcausevic-dev/aeo-protocol being published to npm yet. The
 * shape mirrors aeo-sdk-typescript exactly.
 */
import { z } from "zod";
import { lookup as dnsLookup, type LookupOptions } from "node:dns";
import { request as httpsRequest } from "node:https";
import { BlockList, isIP } from "node:net";

export const WELL_KNOWN_PATH = "/.well-known/aeo.json";
const ACCEPT_HEADER = "application/aeo+json, application/json";
const MAX_RESPONSE_BYTES = 1_048_576;
const blockedAddresses = new BlockList();
const publicV6 = new BlockList();

for (const [address, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10],
  ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12],
  ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.168.0.0", 16],
  ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24],
  ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const) blockedAddresses.addSubnet(address, prefix, "ipv4");
publicV6.addSubnet("2000::", 3, "ipv6");
blockedAddresses.addSubnet("2001:db8::", 32, "ipv6");
blockedAddresses.addSubnet("2001::", 32, "ipv6");
blockedAddresses.addSubnet("2002::", 16, "ipv6");

export function isPublicAddress(address: string, family: 4 | 6): boolean {
  if (family === 4) return !blockedAddresses.check(address, "ipv4");
  return publicV6.check(address, "ipv6") && !blockedAddresses.check(address, "ipv6");
}

function parseOrigin(origin: string): URL {
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    throw new TypeError("AEO origin must be an absolute HTTPS origin URL");
  }
  if (
    url.protocol !== "https:" || url.username || url.password ||
    !/^\/*$/.test(url.pathname) || url.search || url.hash ||
    isIP(url.hostname.replace(/^\[|\]$/g, "")) !== 0
  ) {
    throw new TypeError("AEO origin must be a public HTTPS hostname without credentials, path, query, or fragment");
  }
  return url;
}

function safeLookup(
  hostname: string,
  options: LookupOptions,
  callback: (error: NodeJS.ErrnoException | null, address: string | import("node:dns").LookupAddress[], family?: number) => void,
): void {
  dnsLookup(hostname, { all: true, family: options.family ?? 0 }, (error, addresses) => {
    if (error) return callback(error, "");
    if (addresses.length === 0 || addresses.some(({ address, family }) =>
      !isPublicAddress(address, family as 4 | 6))) {
      return callback(new Error("AEO origin resolves to a non-public address"), "");
    }
    const first = addresses[0]!;
    if (options.all) callback(null, addresses);
    else callback(null, first.address, first.family);
  });
}

interface HttpResult {
  status: number;
  statusText: string;
  location?: string;
  body: string;
}

function requestOnce(url: URL, timeoutMs: number): Promise<HttpResult> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error: Error | null, result?: HttpResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error);
      else resolve(result!);
    };
    const req = httpsRequest(url, {
      headers: { Accept: ACCEPT_HEADER, "Accept-Encoding": "identity" },
      lookup: safeLookup,
    }, (res) => {
      const status = res.statusCode ?? 0;
      const statusText = res.statusMessage ?? "";
      const location = res.headers.location;
      if (status === 301 || status === 302) {
        res.resume();
        finish(null, { status, statusText, location, body: "" });
        return;
      }
      const decoder = new TextDecoder("utf-8", { fatal: true });
      let bytes = 0;
      let body = "";
      res.on("data", (chunk: Buffer) => {
        bytes += chunk.length;
        if (bytes > MAX_RESPONSE_BYTES) {
          finish(new Error("AEO response exceeds size limit"));
          req.destroy();
          return;
        }
        try { body += decoder.decode(chunk, { stream: true }); }
        catch (error) {
          finish(error as Error);
          req.destroy();
        }
      });
      res.on("end", () => {
        try {
          body += decoder.decode();
          finish(null, { status, statusText, location, body });
        } catch (error) { finish(error as Error); }
      });
      res.on("error", (error) => finish(error));
    });
    const timer = setTimeout(() => req.destroy(new Error("AEO fetch timed out")), timeoutMs);
    req.on("error", (error) => finish(error));
    req.end();
  });
}

const entityTypeSchema = z.enum([
  "Person",
  "Organization",
  "Product",
  "Place",
  "Concept",
]);

const verificationTypeSchema = z.enum([
  "domain",
  "dns",
  "github",
  "linkedin",
  "gpg",
  "well-known-uri",
]);

const confidenceSchema = z.enum(["high", "medium", "low"]);
const auditModeSchema = z.enum(["none", "signature", "endpoint"]);

const entitySchema = z
  .object({
    id: z.string().url(),
    type: entityTypeSchema,
    name: z.string().min(1),
    aliases: z.array(z.string().min(1)).optional(),
    canonical_url: z.string().url(),
  })
  .strict();

const verificationSchema = z
  .object({
    type: verificationTypeSchema,
    value: z.string().min(1),
    proof_uri: z.string().url().optional(),
  })
  .strict();

const authoritySchema = z
  .object({
    primary_sources: z.array(z.string().url()).min(1),
    evidence_links: z.array(z.string().url()).optional(),
    verifications: z.array(verificationSchema).optional(),
  })
  .strict();

const claimSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/),
    predicate: z.string().min(1),
    value: z.unknown().refine((value) => value !== undefined, "Claim value is required"),
    evidence: z.array(z.string().url()).optional(),
    valid_from: z.string().date().optional(),
    valid_until: z.union([z.string().date(), z.null()]).optional(),
    confidence: confidenceSchema.default("high"),
  })
  .strict();

const citationPreferencesSchema = z
  .object({
    preferred_attribution: z.string().optional(),
    canonical_links: z.array(z.string().url()).optional(),
    do_not_cite: z.array(z.string().url()).optional(),
  })
  .strict();

const answerConstraintsSchema = z
  .object({
    must_include: z.array(z.string()).optional(),
    must_not_include: z.array(z.string()).optional(),
    freshness_window_days: z.number().int().min(1).optional(),
  })
  .strict();

const auditSchema = z
  .object({
    mode: auditModeSchema,
    signing_key_uri: z.string().url().optional(),
    signature: z.string().optional(),
    endpoint_uri: z.string().url().optional(),
    endpoint_schema: z.string().url().optional(),
  })
  .strict()
  .superRefine((audit, ctx) => {
    if (audit.mode === "signature" || audit.mode === "endpoint") {
      if (!audit.signing_key_uri) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["signing_key_uri"], message: "Signing key URI is required" });
      if (!audit.signature) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["signature"], message: "Signature is required" });
    }
    if (audit.mode === "endpoint" && !audit.endpoint_uri) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["endpoint_uri"], message: "Endpoint URI is required" });
    }
  });

export const documentSchema = z
  .object({
    aeo_version: z.literal("0.1"),
    entity: entitySchema,
    authority: authoritySchema,
    claims: z.array(claimSchema).min(1),
    citation_preferences: citationPreferencesSchema.optional(),
    answer_constraints: answerConstraintsSchema.optional(),
    audit: auditSchema.optional(),
  })
  .strict()
  .superRefine((doc, ctx) => {
    const seen = new Set<string>();
    doc.claims.forEach((claim, index) => {
      if (seen.has(claim.id)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["claims", index, "id"], message: "Claim IDs must be unique" });
      seen.add(claim.id);
    });
  });

export type AeoDocument = z.infer<typeof documentSchema>;
export type Claim = z.infer<typeof claimSchema>;

export function wellKnownUrl(origin: string): string {
  return parseOrigin(origin).origin + WELL_KNOWN_PATH;
}

export function parseDocument(raw: string): AeoDocument {
  const data = JSON.parse(raw);
  return documentSchema.parse(data);
}

export async function fetchWellKnown(
  origin: string,
  { timeoutMs = 10_000 }: { timeoutMs?: number } = {},
): Promise<AeoDocument> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new RangeError("AEO timeoutMs must be a positive finite number");
  }
  let url = new URL(wellKnownUrl(origin));
  const expectedOrigin = url.origin;
  const deadline = Date.now() + timeoutMs;
  for (let redirects = 0; redirects <= 1; redirects++) {
    const response = await requestOnce(url, Math.max(1, deadline - Date.now()));
    if (response.status === 301 || response.status === 302) {
      if (!response.location || redirects === 1) throw new Error("AEO redirect limit exceeded");
      const destination = new URL(response.location, url);
      if (destination.origin !== expectedOrigin) throw new Error("AEO cross-origin redirect refused");
      if (destination.username || destination.password) throw new Error("AEO redirect credentials refused");
      url = destination;
      continue;
    }
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`AEO fetch failed: ${response.status} ${response.statusText} (${url})`);
    }
    return parseDocument(response.body);
  }
  throw new Error("AEO redirect limit exceeded");
}

export function findClaim(doc: AeoDocument, id: string): Claim | undefined {
  return doc.claims.find((c) => c.id === id);
}

export function claimIds(doc: AeoDocument): string[] {
  return doc.claims.map((c) => c.id);
}
