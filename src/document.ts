/**
 * Minimal AEO Protocol v0.1 types and discovery helpers.
 *
 * Kept self-contained so this package does not depend on
 * @mizcausevic-dev/aeo-protocol being published to npm yet. The
 * shape mirrors aeo-sdk-typescript exactly.
 */
import { z } from "zod";

export const WELL_KNOWN_PATH = "/.well-known/aeo.json";
const ACCEPT_HEADER = "application/aeo+json, application/json";

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
    value: z.unknown(),
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
  .strict();

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
  .strict();

export type AeoDocument = z.infer<typeof documentSchema>;
export type Claim = z.infer<typeof claimSchema>;

export function wellKnownUrl(origin: string): string {
  return origin.replace(/\/+$/, "") + WELL_KNOWN_PATH;
}

export function parseDocument(raw: string): AeoDocument {
  const data = JSON.parse(raw);
  return documentSchema.parse(data);
}

export async function fetchWellKnown(
  origin: string,
  { timeoutMs = 10_000 }: { timeoutMs?: number } = {},
): Promise<AeoDocument> {
  const url = wellKnownUrl(origin);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: { Accept: ACCEPT_HEADER },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`AEO fetch failed: ${response.status} ${response.statusText} (${url})`);
    }
    return parseDocument(await response.text());
  } finally {
    clearTimeout(timer);
  }
}

export function findClaim(doc: AeoDocument, id: string): Claim | undefined {
  return doc.claims.find((c) => c.id === id);
}

export function claimIds(doc: AeoDocument): string[] {
  return doc.claims.map((c) => c.id);
}
