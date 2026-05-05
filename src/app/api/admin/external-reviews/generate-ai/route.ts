import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { callLlama, REVIEW_TRIAGE_SYSTEM } from "@/lib/llm";
import {
  looksLikeLlmRefusal,
  sanitizeReviewForLlm,
} from "@/lib/reviewLlmSanitize";
import { heuristicAdminSummary } from "@/lib/reviewHeuristicFallback";
import { isSummaryGroundedInReview } from "@/lib/reviewSummaryGrounding";
import {
  externalReviewsOwnedByWhere,
  getGoogleLocationIdsForOwner,
} from "@/lib/ownerScope";
import { requireOwnerSession } from "@/lib/ownerSession";

type GenerateAiBody = {
  reviewIds?: string[];
  locationId?: string;
  since?: string;
};

export async function POST(req: NextRequest) {
  const auth = await requireOwnerSession(req);
  if ("response" in auth) return auth.response;

  const ownerId = auth.session.userId;
  const locationIds = await getGoogleLocationIdsForOwner(ownerId);

  try {
    const body = (await req.json()) as GenerateAiBody;

    const scope = externalReviewsOwnedByWhere(ownerId);

    let reviews = [];

    if (Array.isArray(body.reviewIds) && body.reviewIds.length > 0) {
      const order = new Map(body.reviewIds.map((id, i) => [id, i]));
      reviews = await prisma.externalReview.findMany({
        where: {
          ...scope,
          id: { in: body.reviewIds },
        },
      });
      reviews.sort(
        (a, b) => (order.get(a.id) ?? 999) - (order.get(b.id) ?? 999)
      );
    } else {
      const { locationId, since } = body;
      if (locationId && !locationIds.includes(locationId)) {
        return NextResponse.json(
          { error: "Unknown location" },
          { status: 403 }
        );
      }
      const sinceDate = since ? new Date(since) : undefined;
      reviews = await prisma.externalReview.findMany({
        where: {
          ...scope,
          ...(locationId ? { locationId } : {}),
          ...(sinceDate ? { createTime: { gte: sinceDate } } : {}),
        },
      });
    }

    const updatedIds: string[] = [];

    for (const review of reviews) {
      if (!review.comment || review.comment.trim().length === 0) {
        await prisma.externalReview.update({
          where: { id: review.id },
          data: {
            aiSummary: "Insufficient detail to summarize.",
            aiActions: null,
          },
        });
        updatedIds.push(review.id);
        continue;
      }

      const commentForLlm = sanitizeReviewForLlm(review.comment);
      const basePromptContext = `Platform: Google\nRating: ${review.rating}\nReview text: ${commentForLlm}`;

      const summaryPrompt = `
You are writing a very short owner-facing summary: what the customer actually said, in plain language (not advice and not a to-do list).

Rules:
- Use only the review text. Do NOT invent details, numbers, or follow-up steps.
- If the review is extremely short or generic (e.g. "good", "nice", "great") with no specifics, respond exactly with:
  "Insufficient detail to summarize."
- If the tone is hostile or wording is offensive, still state the factual substance in neutral language (no quoting slurs or insults).
- Tokens like [redacted] represent removed coarse language; infer themes only.
- Output 1–2 short bullet points. Each bullet must name something concrete from the review (topic, product, service moment, or outcome). No generic management speak (e.g. do not say "review procedures", "consult suppliers", "identify improvements") unless the review literally says that.
- Do not tell the business what to do. No "should", "recommend", or "consider".
- Each bullet must reuse at least one distinctive word or short phrase that appears verbatim in the Review text above (so the summary is clearly about this review only).

${basePromptContext}
`;

      const llmOpts = { system: REVIEW_TRIAGE_SYSTEM, temperature: 0.25 as const };
      let aiSummary = await callLlama(summaryPrompt, llmOpts);

      const cueLower = commentForLlm.toLowerCase();
      const ratingNum = Number(review.rating);
      const r = Number.isFinite(ratingNum) ? ratingNum : 3;
      if (looksLikeLlmRefusal(aiSummary)) {
        aiSummary = heuristicAdminSummary(r, cueLower);
      } else if (!isSummaryGroundedInReview(commentForLlm, aiSummary)) {
        const tightened = `${summaryPrompt}\n\nCritical: your summary failed grounding. Repeat—each bullet must include words copied verbatim from the Review text above.`;
        aiSummary = await callLlama(tightened, llmOpts);
        if (
          looksLikeLlmRefusal(aiSummary) ||
          !isSummaryGroundedInReview(commentForLlm, aiSummary)
        ) {
          aiSummary = heuristicAdminSummary(r, cueLower);
        }
      }

      await prisma.externalReview.update({
        where: { id: review.id },
        data: { aiSummary, aiActions: null },
      });

      updatedIds.push(review.id);
    }

    return NextResponse.json({
      success: true,
      updatedCount: updatedIds.length,
      updatedIds,
    });
  } catch (err) {
    console.error("Failed to generate AI for external reviews", err);
    return NextResponse.json(
      { error: "Failed to generate AI for external reviews" },
      { status: 500 }
    );
  }
}
