import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { callLlama, REVIEW_TRIAGE_SYSTEM } from "@/lib/llm";
import {
  looksLikeLlmRefusal,
  sanitizeReviewForLlm,
} from "@/lib/reviewLlmSanitize";
import {
  fallbackPublicReply,
  heuristicAdminSummary,
  ratingOnlyAdminSummary,
} from "@/lib/reviewHeuristicFallback";
import { isSummaryGroundedInReview } from "@/lib/reviewSummaryGrounding";

function isTokenActive(row: {
  revokedAt: Date | null;
  expiresAt: Date | null;
}): boolean {
  if (row.revokedAt) return false;
  if (row.expiresAt && row.expiresAt.getTime() <= Date.now()) return false;
  return true;
}

type Body = {
  token?: string;
  businessLocationId?: string;
  rating?: number;
  review?: string;
};

/**
 * Token-scoped customer review. Persists public reply + admin summary; `aiActions` is empty (legacy field).
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const { token, businessLocationId, rating, review: reviewRaw } = body;
    const review =
      typeof reviewRaw === "string" ? reviewRaw.trim() : "";

    if (!token || typeof token !== "string") {
      return NextResponse.json(
        { error: "token is required" },
        { status: 400 }
      );
    }

    if (!businessLocationId || typeof businessLocationId !== "string") {
      return NextResponse.json(
        { error: "businessLocationId is required" },
        { status: 400 }
      );
    }

    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: "Invalid rating" },
        { status: 400 }
      );
    }

    if (review.length > 2000) {
      return NextResponse.json(
        { error: "Review too long" },
        { status: 400 }
      );
    }

    const tokenRow = await prisma.reviewToken.findUnique({
      where: { token },
      include: { business: true },
    });

    if (!tokenRow || !isTokenActive(tokenRow)) {
      return NextResponse.json(
        { error: "Invalid or expired review link" },
        { status: 404 }
      );
    }

    const location = await prisma.businessLocation.findFirst({
      where: {
        id: businessLocationId,
        businessId: tokenRow.businessId,
      },
    });

    if (!location) {
      return NextResponse.json(
        { error: "Unknown location for this business" },
        { status: 400 }
      );
    }

    const forLlm = sanitizeReviewForLlm(review);

    if (forLlm.length === 0) {
      const safeResponse = fallbackPublicReply(rating);
      const safeSummary = ratingOnlyAdminSummary(rating);
      const saved = await prisma.review.create({
        data: {
          rating,
          userReview: review,
          aiResponse: safeResponse,
          aiSummary: safeSummary,
          aiActions: "",
          businessId: tokenRow.businessId,
          businessLocationId: location.id,
        },
      });
      return NextResponse.json({ success: true, data: saved });
    }

    const reviewCue = forLlm;

    const userPrompt = `
You are writing a customer-facing reply on behalf of a business.

Rules:
- Write the response as the business.
- Do NOT use placeholders like [User], [Customer], or [Business Name].
- Do NOT mention AI or analysis.
- Do NOT explain your reasoning.
- Keep it concise (1–2 sentences).
- Match tone to the rating.
- If rating is low, be apologetic and empathetic.
- If rating is high, be appreciative and warm.
- Stay professional: do not repeat profanity, slurs, or personal insults from the review; acknowledge concerns in clean language.
- Tokens like [redacted] represent removed coarse language; infer sentiment only, never echo slurs.

User rating: ${rating}
User review: ${reviewCue}
`;

    const summaryPrompt = `
You are writing a very short owner-facing summary: what the customer actually said, in plain language (not advice and not a to-do list).

Rules:
- Use only the review text. Do NOT invent details or follow-up steps.
- If the review is only generic praise (e.g. "good", "nice", "great") with no specifics, return exactly:
  "Generic positive feedback with no specifics."
- If the tone is hostile or the wording is coarse, still state only the factual substance in neutral language (no quoting insults or slurs).
- Output max 2 bullet points. Each bullet must name something concrete from the review (topic, product, service moment, or outcome). No generic management speak (e.g. do not say "review procedures", "consult suppliers", "identify improvements") unless the review literally says that.
- Do not tell the business what to do. No "should", "recommend", or "consider".
- Each bullet must reuse at least one distinctive word or short phrase that appears verbatim in the Review text above.

Rating: ${rating}
Review: ${reviewCue}
`;

    const llmBase = { system: REVIEW_TRIAGE_SYSTEM };
    const adminLlm = { ...llmBase, temperature: 0.25 as const };
    const [aiResponse, aiSummary] = await Promise.all([
      callLlama(userPrompt, { ...llmBase, temperature: 0.45 }),
      callLlama(summaryPrompt, adminLlm),
    ]);

    const cueLower = forLlm.toLowerCase();
    const safeResponse = looksLikeLlmRefusal(aiResponse)
      ? fallbackPublicReply(rating)
      : aiResponse;
    let safeSummary: string;
    if (looksLikeLlmRefusal(aiSummary)) {
      safeSummary = heuristicAdminSummary(rating, cueLower);
    } else if (!isSummaryGroundedInReview(forLlm, aiSummary)) {
      const tightened = `${summaryPrompt}\n\nCritical: your summary failed grounding. Repeat—each bullet must include words copied verbatim from the Review text above.`;
      const second = await callLlama(tightened, adminLlm);
      if (
        !looksLikeLlmRefusal(second) &&
        isSummaryGroundedInReview(forLlm, second)
      ) {
        safeSummary = second;
      } else {
        safeSummary = heuristicAdminSummary(rating, cueLower);
      }
    } else {
      safeSummary = aiSummary;
    }

    const saved = await prisma.review.create({
      data: {
        rating,
        userReview: review,
        aiResponse: safeResponse,
        aiSummary: safeSummary,
        aiActions: "",
        businessId: tokenRow.businessId,
        businessLocationId: location.id,
      },
    });

    return NextResponse.json({ success: true, data: saved });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
