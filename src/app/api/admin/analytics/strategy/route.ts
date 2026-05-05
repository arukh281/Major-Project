import { NextRequest, NextResponse } from "next/server";
import { callLlama } from "@/lib/llm";
import {
  emptyCorpusSynthesis,
  emptyGrounding,
  OrgSynthesisGroundingSchema,
  parseOrgSynthesisFromLlm,
} from "@/lib/models/orgSynthesis";
import { analyzeThemesAndAlerts, type ThemeInsightRow } from "@/lib/reviewTextThemes";
import { loadBlendedReviewsForOwner } from "@/lib/blendedReviewCorpus";
import {
  buildBucketIntelligencePayload,
  computeWorstLocationsForWindow,
  filterTopThemesByActiveSubjects,
  metricsWindowEndExclusive,
  parseAnalyticsRange,
  resolveMetricsWindow,
} from "@/lib/bucketIntelligence";
import { resolveAnalyticsBucketsForOwner } from "@/lib/ownerAnalyticsBuckets";
import { requireOwnerSession } from "@/lib/ownerSession";

export async function POST(req: NextRequest) {
  const auth = await requireOwnerSession(req);
  if ("response" in auth) return auth.response;

  const ownerId = auth.session.userId;

  try {
    const rows = await loadBlendedReviewsForOwner(ownerId);

    if (rows.length === 0) {
      return NextResponse.json({
        success: true,
        synthesis: emptyCorpusSynthesis,
        grounding: emptyGrounding,
      });
    }

    let range = parseAnalyticsRange(null);
    try {
      const raw = await req.text();
      if (raw.trim()) {
        const j = JSON.parse(raw) as { range?: string };
        range = parseAnalyticsRange(j.range ?? null);
      }
    } catch {
      /* optional body */
    }

    const corpusMin = new Date(
      Math.min(...rows.map((x) => x.reviewTime.getTime()))
    );
    const corpusMax = new Date(
      Math.max(...rows.map((x) => x.reviewTime.getTime()))
    );

    const windows = resolveMetricsWindow(range, {
      now: new Date(),
      corpusMinTime: corpusMin,
      corpusMaxTime: corpusMax,
    });

    const activeBuckets = await resolveAnalyticsBucketsForOwner(ownerId);
    const bucketPayload = buildBucketIntelligencePayload(
      rows,
      windows,
      range,
      activeBuckets
    );

    const windowEndEx = metricsWindowEndExclusive(windows);
    const worstLocations = computeWorstLocationsForWindow(
      rows,
      windows.windowStart,
      windowEndEx,
      5
    );

    const extCount = rows.filter((r) => r.source === "external").length;
    const intCount = rows.filter((r) => r.source === "internal").length;

    const ratingsSum = rows.reduce((s, r) => s + r.rating, 0);
    const avgRating = ratingsSum / rows.length;
    const negativeCount = rows.filter((r) => r.rating <= 2).length;

    const themeInput: ThemeInsightRow[] = rows.map((r) => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      aiSummary: r.aiSummary,
      locationTitle: r.locationTitle,
    }));

    const { topThemes: themesRaw, alerts } =
      analyzeThemesAndAlerts(themeInput);
    const topThemes = filterTopThemesByActiveSubjects(
      themesRaw,
      activeBuckets
    );

    const lowHealthBuckets = bucketPayload.bucketInsights
      .filter(
        (b) =>
          b.healthScore != null &&
          b.healthScore <= 39 &&
          b.taggedCountWindow > 0
      )
      .map((b) => ({
        bucketId: b.id,
        label: b.label,
        healthScore: b.healthScore!,
        taggedCountWindow: b.taggedCountWindow,
      }))
      .slice(0, 6);

    const worseningBuckets = bucketPayload.bucketInsights
      .filter(
        (b) =>
          b.healthDeltaVsPrior != null &&
          b.healthDeltaVsPrior > 5 &&
          b.taggedCountWindow > 0
      )
      .map((b) => ({
        bucketId: b.id,
        label: b.label,
        healthDeltaVsPrior: b.healthDeltaVsPrior!,
      }))
      .slice(0, 6);

    const grounding = OrgSynthesisGroundingSchema.parse({
      totalReviews: rows.length,
      avgRating,
      negativeCount,
      topThemes: topThemes.slice(0, 6).map((t) => ({ theme: t.theme, count: t.count })),
      riskKeywords: alerts.map((a) => ({ keyword: a.keyword, count: a.count })),
      corpusKind: "blended" as const,
      externalReviewCount: extCount,
      internalReviewCount: intCount,
      lowHealthBuckets,
      worseningBuckets,
      worstLocations,
    });

    const facts = [
      `Corpus: blended Google + internal reviews (total ${rows.length}; external ${extCount}, internal ${intCount}).`,
      `Average rating (full corpus, 1–5): ${avgRating.toFixed(2)}.`,
      `Reviews rated ≤2 stars (full corpus): ${negativeCount}.`,
      `Metrics window (bucket health / priority): ${bucketPayload.bucketMetricsMeta.windowStart.slice(0, 10)} → ${bucketPayload.bucketMetricsMeta.windowEnd.slice(0, 10)} (range ${range}).`,
      `Top recurring themes (keyword buckets): ${topThemes
        .slice(0, 6)
        .map((t) => `${t.theme} (${t.count})`)
        .join("; ")}`,
      `Risk keywords detected: ${alerts
        .map((a) => `${a.keyword} (${a.count})`)
        .join("; ") || "none flagged"}`,
      `Low-health subject buckets (≤39): ${lowHealthBuckets
        .map((b) => `${b.label} (${b.healthScore}, n=${b.taggedCountWindow})`)
        .join("; ") || "none in window"}`,
      `Worsening buckets (health vs prior window): ${worseningBuckets
        .map((b) => `${b.label} (Δ${b.healthDeltaVsPrior})`)
        .join("; ") || "none flagged"}`,
      `Worst locations by ≤2★ share in metrics window: ${worstLocations
        .map(
          (l) =>
            `${l.title} (${Math.round(l.lowScoreShare * 100)}% low, n=${l.count}, μ=${l.avgRating?.toFixed(2) ?? "n/a"})`
        )
        .join("; ") || "n/a"}`,
    ].join("\n");

    const prompt = `You are a concise operations advisor for a multi-location business.

Below are aggregated facts computed from ALL blended reviews (Google imports + internal token reviews). Do NOT invent locations, numbers, or incidents not implied by the facts. When you summarize, explicitly use the given totals (review count, external vs internal counts, average rating, low-score count) and theme/risk/bucket/location facts where they strengthen the point.

Facts:
${facts}

Respond with ONLY a single JSON object and no other text (no markdown fences, no commentary). Keys:
- "patterns": array of 2–4 short strings. At least two bullets should reference specific numbers from Facts above (e.g. average rating, total reviews, count of 1–2★ reviews, external vs internal split, a theme/risk count, a low-health bucket, a worsening bucket, or a worst location line).
- "nextSteps": array of 3–5 objects. Each object MUST have:
  - "keyword": string, 2–6 words — the main action or theme (Title Case or sentence case).
  - "detail": string — the full recommendation; MUST start by naturally continuing the keyword (e.g. keyword "Review workflows" + detail "to cut wait times across locations."). No per-review reply text.

Example (structure only):
{"patterns":["…"],"nextSteps":[{"keyword":"…","detail":"…"}]}`;

    const raw = await callLlama(prompt, { temperature: 0.35 });

    let synthesis;
    try {
      synthesis = parseOrgSynthesisFromLlm(raw);
    } catch (e) {
      console.error("Org synthesis validation failed", e, raw.slice(0, 500));
      return NextResponse.json(
        {
          error:
            "The model returned invalid JSON. Try Generate overview again.",
        },
        { status: 502 }
      );
    }

    return NextResponse.json({ success: true, synthesis, grounding });
  } catch (err) {
    console.error("Failed to generate strategy", err);
    return NextResponse.json(
      { error: "Failed to generate strategy" },
      { status: 500 }
    );
  }
}
