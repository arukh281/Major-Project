import { prisma } from "@/lib/prisma";
import {
  externalReviewsOwnedByWhere,
  ownedInternalReviewsWhere,
} from "@/lib/ownerScope";
import type { NormalizedBlendedReview } from "@/lib/bucketIntelligence";

/**
 * Full blended corpus for analytics / bucket intelligence (Google + internal).
 * Single source of truth for GET analytics and strategy grounding.
 */
export async function loadBlendedReviewsForOwner(
  ownerId: string
): Promise<NormalizedBlendedReview[]> {
  const extScope = externalReviewsOwnedByWhere(ownerId);
  const intScope = ownedInternalReviewsWhere(ownerId);

  const [extRows, intRows] = await Promise.all([
    prisma.externalReview.findMany({
      where: extScope,
      select: {
        id: true,
        rating: true,
        comment: true,
        aiSummary: true,
        createTime: true,
        locationId: true,
        location: { select: { locationTitle: true } },
      },
    }),
    prisma.review.findMany({
      where: intScope,
      select: {
        id: true,
        rating: true,
        userReview: true,
        aiSummary: true,
        createdAt: true,
        businessLocationId: true,
        businessLocation: { select: { name: true } },
      },
    }),
  ]);

  const extNorm: NormalizedBlendedReview[] = extRows.map((r) => ({
    id: r.id,
    source: "external" as const,
    rating: r.rating,
    comment: r.comment,
    aiSummary: r.aiSummary,
    locationTitle: r.location.locationTitle,
    locationKey: `g:${r.locationId}`,
    reviewTime: r.createTime,
  }));

  const intNorm: NormalizedBlendedReview[] = intRows.map((r) => {
    const locId = r.businessLocationId;
    const titleBase = r.businessLocation?.name ?? "Internal";
    return {
      id: r.id,
      source: "internal" as const,
      rating: r.rating,
      comment: r.userReview,
      aiSummary: r.aiSummary,
      locationTitle: titleBase,
      locationKey: locId == null ? "i:none" : `i:${locId}`,
      reviewTime: r.createdAt,
    };
  });

  return [...extNorm, ...intNorm];
}
