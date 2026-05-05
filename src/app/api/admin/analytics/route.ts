import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  analyzeThemesAndAlerts,
  type ThemeInsightRow,
} from "@/lib/reviewTextThemes";
import { loadBlendedReviewsForOwner } from "@/lib/blendedReviewCorpus";
import {
  buildBucketIntelligencePayload,
  computeWorstLocationsForWindow,
  filterTopThemesByActiveSubjects,
  metricsWindowEndExclusive,
  parseAnalyticsRange,
  resolveMetricsWindow,
} from "@/lib/bucketIntelligence";
import {
  externalReviewsOwnedByWhere,
  getGoogleLocationIdsForOwner,
  ownedInternalReviewsWhere,
} from "@/lib/ownerScope";
import { resolveAnalyticsBucketsForOwner } from "@/lib/ownerAnalyticsBuckets";
import { requireOwnerSession } from "@/lib/ownerSession";

function toDayKey(d: Date | unknown): string {
  const x = d instanceof Date ? d : new Date(String(d));
  return x.toISOString().slice(0, 10);
}

function mergeDailyTrend(
  ext: Array<{ d: Date | unknown; c: unknown }>,
  int: Array<{ d: Date | unknown; c: unknown }>
): { date: string; count: number }[] {
  const map = new Map<string, number>();
  for (const row of ext) {
    const k = toDayKey(row.d);
    map.set(k, (map.get(k) ?? 0) + Number(row.c));
  }
  for (const row of int) {
    const k = toDayKey(row.d);
    map.set(k, (map.get(k) ?? 0) + Number(row.c));
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));
}

function summarizeWindow(
  rows: Array<{ reviewTime: Date; rating: number; comment: string | null }>,
  start: Date,
  endExclusive: Date
) {
  const inWindow = rows.filter(
    (r) => r.reviewTime >= start && r.reviewTime < endExclusive
  );
  const count = inWindow.length;
  const avgRating =
    count > 0 ? inWindow.reduce((sum, r) => sum + r.rating, 0) / count : null;
  const negativeCount = inWindow.filter((r) => r.rating <= 2).length;
  const withComment = inWindow.filter(
    (r) => (r.comment ?? "").trim().length > 0
  ).length;

  return { count, avgRating, negativeCount, withComment };
}

export async function GET(req: NextRequest) {
  const auth = await requireOwnerSession(req);
  if ("response" in auth) return auth.response;

  const ownerId = auth.session.userId;
  const extScope = externalReviewsOwnedByWhere(ownerId);
  const intScope = ownedInternalReviewsWhere(ownerId);

  try {
    const { searchParams } = new URL(req.url);
    const range = parseAnalyticsRange(searchParams.get("range"));

    const locationIds = await getGoogleLocationIdsForOwner(ownerId);

    const [
      extCount,
      intCount,
      extAvgAgg,
      intAvgAgg,
      extNegativeCount,
      intNegativeCount,
      extWithCommentCount,
      intWithCommentCount,
      ratingGroupsExt,
      ratingGroupsInt,
      locationGroupsExt,
      locationGroupsInt,
      googleLocationsMeta,
      internalLocationsMeta,
      blendedReviews,
    ] = await Promise.all([
      prisma.externalReview.count({ where: extScope }),
      prisma.review.count({ where: intScope }),
      prisma.externalReview.aggregate({
        where: extScope,
        _avg: { rating: true },
      }),
      prisma.review.aggregate({
        where: intScope,
        _avg: { rating: true },
      }),
      prisma.externalReview.count({
        where: { ...extScope, rating: { lte: 2 } },
      }),
      prisma.review.count({
        where: { ...intScope, rating: { lte: 2 } },
      }),
      prisma.externalReview.count({
        where: {
          ...extScope,
          NOT: {
            OR: [{ comment: null }, { comment: "" }],
          },
        },
      }),
      prisma.review.count({
        where: {
          ...intScope,
          NOT: { userReview: "" },
        },
      }),
      prisma.externalReview.groupBy({
        by: ["rating"],
        where: extScope,
        _count: { _all: true },
      }),
      prisma.review.groupBy({
        by: ["rating"],
        where: intScope,
        _count: { _all: true },
      }),
      prisma.externalReview.groupBy({
        by: ["locationId"],
        where: extScope,
        _count: { _all: true },
        _avg: { rating: true },
      }),
      prisma.review.groupBy({
        by: ["businessLocationId"],
        where: intScope,
        _count: { _all: true },
        _avg: { rating: true },
      }),
      prisma.googleLocation.findMany({
        where: { link: { ownerId } },
        select: { id: true, locationTitle: true },
      }),
      prisma.businessLocation.findMany({
        where: { business: { ownerId } },
        select: { id: true, name: true },
      }),
      loadBlendedReviewsForOwner(ownerId),
    ]);

    const corpusMin =
      blendedReviews.length > 0
        ? new Date(
            Math.min(...blendedReviews.map((x) => x.reviewTime.getTime()))
          )
        : null;
    const corpusMax =
      blendedReviews.length > 0
        ? new Date(
            Math.max(...blendedReviews.map((x) => x.reviewTime.getTime()))
          )
        : null;

    const now = new Date();
    const metricsWindows = resolveMetricsWindow(range, {
      now,
      corpusMinTime: corpusMin,
      corpusMaxTime: corpusMax,
    });
    const windowEndExclusive = metricsWindowEndExclusive(metricsWindows);
    const priorWindowEndExclusive = metricsWindows.windowStart;

    const trendSince = metricsWindows.windowStart;

    const [trendRowsExt, trendRowsInt] = await Promise.all([
      locationIds.length > 0
        ? prisma.$queryRaw<Array<{ d: Date; c: number }>>`
        SELECT (date_trunc('day', "createTime") AT TIME ZONE 'UTC')::date AS d,
               COUNT(*)::int AS c
        FROM "ExternalReview"
        WHERE "createTime" >= ${trendSince}
          AND "locationId" IN (${Prisma.join(
            locationIds.map((id) => Prisma.sql`${id}`)
          )})
        GROUP BY 1
        ORDER BY 1 ASC
      `
        : Promise.resolve([]),
      prisma.$queryRaw<Array<{ d: Date; c: number }>>`
        SELECT (date_trunc('day', r."createdAt" AT TIME ZONE 'UTC'))::date AS d,
               COUNT(*)::int AS c
        FROM "Review" r
        INNER JOIN "Business" b ON r."businessId" = b."id"
        WHERE b."ownerId" = ${ownerId}
          AND r."createdAt" >= ${trendSince}
        GROUP BY 1
        ORDER BY 1 ASC
      `,
    ]);

    const totalCount = extCount + intCount;
    const avgRating =
      totalCount === 0
        ? null
        : ((extAvgAgg._avg.rating ?? 0) * extCount +
            (intAvgAgg._avg.rating ?? 0) * intCount) /
          totalCount;

    const negativeCount = extNegativeCount + intNegativeCount;
    const withCommentCount = extWithCommentCount + intWithCommentCount;

    const ratingHistogram = [1, 2, 3, 4, 5].map((rating) => {
      const e = ratingGroupsExt.find((g) => g.rating === rating)?._count._all ?? 0;
      const i = ratingGroupsInt.find((g) => g.rating === rating)?._count._all ?? 0;
      return { rating, count: e + i };
    });

    const googleTitleById = new Map(
      googleLocationsMeta.map((l) => [l.id, l.locationTitle])
    );
    const internalTitleById = new Map(
      internalLocationsMeta.map((l) => [l.id, l.name])
    );

    const byLocationGoogle = locationGroupsExt.map((g) => ({
      locationId: `g:${g.locationId}`,
      title: googleTitleById.get(g.locationId) ?? g.locationId,
      count: g._count._all,
      avgRating: g._avg.rating,
    }));

    const byLocationInternal = locationGroupsInt.map((g) => {
      const id = g.businessLocationId;
      const titleBase =
        id == null
          ? "Unassigned location"
          : (internalTitleById.get(id) ?? "Internal location");
      return {
        locationId: id == null ? "i:none" : `i:${id}`,
        title: `${titleBase} · internal`,
        count: g._count._all,
        avgRating: g._avg.rating,
      };
    });

    const byLocation = [...byLocationGoogle, ...byLocationInternal].sort(
      (a, b) => b.count - a.count
    );

    const trend = mergeDailyTrend(trendRowsExt, trendRowsInt);

    const themeInput: ThemeInsightRow[] = blendedReviews.map((r) => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      aiSummary: r.aiSummary,
      locationTitle: r.locationTitle,
    }));

    const { topThemes: themesRaw, alerts } =
      analyzeThemesAndAlerts(themeInput);

    const activeBuckets = await resolveAnalyticsBucketsForOwner(ownerId);
    const topThemes = filterTopThemesByActiveSubjects(themesRaw, activeBuckets);

    const bucketPayload = buildBucketIntelligencePayload(
      blendedReviews,
      metricsWindows,
      range,
      activeBuckets
    );
    const windowTotals = summarizeWindow(
      blendedReviews,
      metricsWindows.windowStart,
      windowEndExclusive
    );
    const priorWindowTotals = summarizeWindow(
      blendedReviews,
      metricsWindows.priorWindowStart,
      priorWindowEndExclusive
    );
    const worstLocationsWindow = computeWorstLocationsForWindow(
      blendedReviews,
      metricsWindows.windowStart,
      windowEndExclusive,
      3
    );

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      range,
      trendSince: trendSince.toISOString(),
      totals: {
        count: totalCount,
        avgRating,
        negativeCount,
        withComment: withCommentCount,
      },
      ratingHistogram,
      trend,
      byLocation,
      topThemes,
      alerts,
      bucketDefinitions: bucketPayload.bucketDefinitions,
      bucketInsights: bucketPayload.bucketInsights,
      bucketTrend: bucketPayload.bucketTrend,
      bucketByLocation: bucketPayload.bucketByLocation,
      bucketMetricsMeta: bucketPayload.bucketMetricsMeta,
      windowTotals,
      priorWindowTotals,
      worstLocationsWindow,
    });
  } catch (err) {
    console.error("Failed to build analytics snapshot", err);
    return NextResponse.json(
      { error: "Failed to build analytics snapshot" },
      { status: 500 }
    );
  }
}
