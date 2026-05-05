import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { loadBlendedReviewsForOwner } from "@/lib/blendedReviewCorpus";
import {
  buildBucketIntelligencePayload,
  parseAnalyticsRange,
  resolveMetricsWindow,
} from "@/lib/bucketIntelligence";
import { requireOwnerSession } from "@/lib/ownerSession";

/**
 * Marks a manual bucket-intelligence pass (live GET remains authoritative;
 * timestamps support owner workflow + future schedulers).
 */
export async function POST(req: NextRequest) {
  const auth = await requireOwnerSession(req);
  if ("response" in auth) return auth.response;

  const ownerId = auth.session.userId;

  const business = await prisma.business.findUnique({
    where: { ownerId },
    select: { id: true },
  });
  if (!business) {
    return NextResponse.json(
      { error: "No business profile found for this owner" },
      { status: 404 }
    );
  }

  await prisma.business.update({
    where: { id: business.id },
    data: { analyticsBucketComputeStatus: "running" },
  });

  try {
    const blended = await loadBlendedReviewsForOwner(ownerId);
    const corpusMin =
      blended.length > 0
        ? new Date(Math.min(...blended.map((x) => x.reviewTime.getTime())))
        : null;
    const corpusMax =
      blended.length > 0
        ? new Date(Math.max(...blended.map((x) => x.reviewTime.getTime())))
        : null;

    let range = parseAnalyticsRange(null);
    try {
      const raw = await req.text();
      if (raw.trim()) {
        const j = JSON.parse(raw) as { range?: string };
        range = parseAnalyticsRange(j.range ?? null);
      }
    } catch {
      /* invalid optional body */
    }

    const windows = resolveMetricsWindow(range, {
      now: new Date(),
      corpusMinTime: corpusMin,
      corpusMaxTime: corpusMax,
    });
    buildBucketIntelligencePayload(blended, windows, range);

    const now = new Date();
    await prisma.business.update({
      where: { id: business.id },
      data: {
        analyticsBucketComputeStatus: "idle",
        analyticsBucketLastComputedAt: now,
      },
    });

    return NextResponse.json({
      success: true,
      recomputedAt: now.toISOString(),
    });
  } catch (err) {
    console.error("Bucket recompute failed", err);
    await prisma.business.update({
      where: { id: business.id },
      data: { analyticsBucketComputeStatus: "failed" },
    });
    return NextResponse.json(
      { error: "Bucket recompute failed" },
      { status: 500 }
    );
  }
}
