import { z } from "zod";

/** Server-computed facts (not from LLM) — shown as ground truth next to synthesis. */
export const OrgSynthesisGroundingSchema = z.object({
  totalReviews: z.number().int().nonnegative(),
  avgRating: z.number().min(1).max(5).nullable(),
  negativeCount: z.number().int().nonnegative(),
  topThemes: z.array(
    z.object({
      theme: z.string(),
      count: z.number().int().nonnegative(),
    })
  ),
  riskKeywords: z.array(
    z.object({
      keyword: z.string(),
      count: z.number().int().nonnegative(),
    })
  ),
  /** Blended Google + internal corpus (additive vs older clients). */
  corpusKind: z.literal("blended"),
  externalReviewCount: z.number().int().nonnegative(),
  internalReviewCount: z.number().int().nonnegative(),
  lowHealthBuckets: z.array(
    z.object({
      bucketId: z.string(),
      label: z.string(),
      healthScore: z.number(),
      taggedCountWindow: z.number().int().nonnegative(),
    })
  ),
  worseningBuckets: z.array(
    z.object({
      bucketId: z.string(),
      label: z.string(),
      healthDeltaVsPrior: z.number(),
    })
  ),
  worstLocations: z.array(
    z.object({
      locationId: z.string(),
      title: z.string(),
      count: z.number().int().nonnegative(),
      avgRating: z.number().min(1).max(5).nullable(),
      lowScoreShare: z.number().min(0).max(1),
    })
  ),
});

export type OrgSynthesisGrounding = z.infer<typeof OrgSynthesisGroundingSchema>;

const NextStepItemSchema = z.object({
  keyword: z
    .string()
    .trim()
    .min(1)
    .max(96)
    .describe("Short lead phrase (2–6 words) — the main action; shown bold"),
  detail: z
    .string()
    .trim()
    .min(1)
    .describe("Rest of the recommendation, full sentence with the keyword"),
});

/**
 * Validated org-level synthesis from aggregate review signals (LLM output).
 * Zod ≈ Pydantic: schema is source of truth; types infer from schema.
 */
export const OrgSynthesisSchema = z.object({
  patterns: z
    .array(z.string().trim().min(1))
    .min(1)
    .max(8)
    .describe(
      "2–4 insights; cite concrete numbers from the facts when relevant (μ rating, counts, themes)"
    ),
  nextSteps: z
    .array(NextStepItemSchema)
    .min(1)
    .max(10)
    .describe("3–5 actions; each item splits bold keyword vs body"),
});

export type OrgSynthesis = z.infer<typeof OrgSynthesisSchema>;
export type OrgNextStep = z.infer<typeof NextStepItemSchema>;

/** Empty-corpus placeholder — same shape as LLM success. */
export const emptyCorpusSynthesis: OrgSynthesis = {
  patterns: [
    "No reviews in the blended corpus yet — connect Google and/or collect internal reviews to populate analytics.",
  ],
  nextSteps: [
    {
      keyword: "Connect Google",
      detail:
        "Business Profile in admin and run a sync to import external reviews into this corpus.",
    },
    {
      keyword: "Share review links",
      detail:
        "from the admin flow so internal token reviews appear alongside Google imports.",
    },
    {
      keyword: "Re-run overview",
      detail:
        "after data arrives so patterns are grounded in real blended volume.",
    },
  ],
};

export const emptyGrounding: OrgSynthesisGrounding = {
  totalReviews: 0,
  avgRating: null,
  negativeCount: 0,
  topThemes: [],
  riskKeywords: [],
  corpusKind: "blended",
  externalReviewCount: 0,
  internalReviewCount: 0,
  lowHealthBuckets: [],
  worseningBuckets: [],
  worstLocations: [],
};

function extractJsonObject(raw: string): unknown {
  const trimmed = raw.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  let candidate = fence ? fence[1].trim() : trimmed;
  const first = candidate.indexOf("{");
  const last = candidate.lastIndexOf("}");
  if (first === -1 || last <= first) {
    throw new SyntaxError("No JSON object in model output");
  }
  candidate = candidate.slice(first, last + 1);
  return JSON.parse(candidate) as unknown;
}

export function parseOrgSynthesisFromLlm(raw: string): OrgSynthesis {
  const parsed = extractJsonObject(raw);
  return OrgSynthesisSchema.parse(parsed);
}
