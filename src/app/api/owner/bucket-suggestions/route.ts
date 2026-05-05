import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  BUCKET_DEFINITIONS,
  formatAnalyticsBucketSuggestionSummary,
  type SubjectBucketId,
} from "@/lib/bucketIntelligence";
import { callLlama, parseJsonFromLlmContent } from "@/lib/llm";
import { requireOwnerSession } from "@/lib/ownerSession";

const BodySchema = z.object({
  description: z.string().min(8).max(4000),
});

const ResponseSchema = z
  .object({
    recommendedIds: z.array(z.string()),
  })
  .passthrough();

const BUCKET_CATALOG_TEXT = BUCKET_DEFINITIONS.map(
  (b) =>
    `- id: "${b.id}"\n  label: ${b.label}\n  description: ${b.description}`
).join("\n\n");

export async function POST(req: NextRequest) {
  const auth = await requireOwnerSession(req);
  if ("response" in auth) return auth.response;

  if (!process.env.OPENROUTER_API_KEY?.trim()) {
    return NextResponse.json(
      { error: "Analytics suggestions are not configured (missing API key)." },
      { status: 503 }
    );
  }

  let body: z.infer<typeof BodySchema>;
  try {
    const raw = (await req.json()) as unknown;
    body = BodySchema.parse(raw);
  } catch {
    return NextResponse.json(
      { error: "Provide description (8–4000 characters)." },
      { status: 400 }
    );
  }

  const allowed = new Set(BUCKET_DEFINITIONS.map((b) => b.id));

  const system = `You map a written business description to analytics subject buckets.
Only use bucket ids from the catalog below. Reply with a single JSON object, no markdown outside JSON.

Catalog:
${BUCKET_CATALOG_TEXT}

Schema:
{ "recommendedIds": string[] }

Rules:
- recommendedIds must be a subset of the ids above (no invented ids).
- Infer the business model first (e.g. restaurant, retail, e‑commerce, education/studio, salon, clinic, on‑site services).
- Prefer precision over breadth: include a bucket only if typical reviewers would **reasonably** talk about that dimension for this business. Do not select a bucket just because it could be stretched by analogy.
- **delivery_ops**: Include only if the description clearly involves shipping, mail order, packaged goods delivery, or third‑party meal/app delivery. **Exclude** for in‑person‑only services (music lessons, tutoring, coaching, yoga, barbershop, etc.) unless they also ship products or use couriers.
- **stock_items_orders**: Include only if customers deal with **inventory, wrong/missing items, order mistakes, or rental SKU‑style fulfillment**. **Exclude** for instruction, consulting, or coaching where there is no meaningful “order accuracy” or stock story unless they also run retail/rentals/restaurant ordering.
- **food_drinks** (label “Product quality”): Use for the quality of the core offering—meals, goods, or **teaching/instruction outcomes and materials**—not for general staff friendliness.
- **staff_service** vs **pricing_trust**: Most paid services need staff_service; include pricing_trust when fees, tuition, packages, refunds, or value are part of the relationship.
- Aim for about **2–5** buckets for a focused business; use **all six** only when the description clearly mixes retail or delivery with on‑site service (e.g. shop + shipping + in‑store experience).
- Reply with JSON only; no extra keys or commentary outside JSON.`;

  const user = `Business description:\n${body.description.trim()}`;

  try {
    const rawLlm = await callLlama(user, { system, temperature: 0.15 });
    let parsed: unknown;
    try {
      parsed = parseJsonFromLlmContent(rawLlm);
    } catch {
      return NextResponse.json(
        { error: "Could not parse suggestion response. Try again." },
        { status: 502 }
      );
    }

    const check = ResponseSchema.safeParse(parsed);
    if (!check.success) {
      return NextResponse.json(
        { error: "Invalid suggestion shape from model." },
        { status: 502 }
      );
    }

    const recommendedIds = [...new Set(check.data.recommendedIds)].filter(
      (id): id is SubjectBucketId => allowed.has(id as SubjectBucketId)
    );

    if (recommendedIds.length === 0) {
      return NextResponse.json(
        {
          error:
            "No valid buckets returned. Try a slightly longer description or try again.",
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      recommendedIds,
      summary: formatAnalyticsBucketSuggestionSummary(recommendedIds),
    });
  } catch (e) {
    console.error("bucket-suggestions", e);
    return NextResponse.json(
      { error: "Suggestion request failed." },
      { status: 502 }
    );
  }
}
