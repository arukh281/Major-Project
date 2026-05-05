import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncLocationsForLink, syncReviewsForLink } from "@/lib/googleBusinessProfile";
import { requireOwnerSession } from "@/lib/ownerSession";

export async function POST(req: NextRequest) {
  const auth = await requireOwnerSession(req);
  if ("response" in auth) return auth.response;

  try {
    let importFromDate: Date | undefined;
    try {
      const body = (await req.json()) as { fromDate?: string } | null;
      if (body?.fromDate) {
        const parsed = new Date(body.fromDate);
        if (!Number.isNaN(parsed.getTime())) {
          importFromDate = parsed;
        }
      }
    } catch {
      // Keep backwards compatibility with clients that POST without JSON body.
    }

    const links = await prisma.googleAccountLink.findMany({
      where: { ownerId: auth.session.userId },
    });

    let totalLocations = 0;
    let totalReviews = 0;
    const errors: { linkId: string; error: string }[] = [];

    for (const link of links) {
      try {
        const locResult = await syncLocationsForLink(link.id);
        totalLocations += locResult.locationsSynced;

        const reviewResult = await syncReviewsForLink(link.id, {
          fromDate: importFromDate,
        });
        totalReviews += reviewResult.reviewsUpserted;

        await prisma.googleAccountLink.update({
          where: { id: link.id },
          data: { lastSyncedAt: new Date() },
        });
      } catch (err) {
        console.error("Error syncing Google link", link.id, err);
        errors.push({
          linkId: link.id,
          error:
            err instanceof Error ? err.message : "Unknown error during sync",
        });
      }
    }

    return NextResponse.json({
      success: true,
      fromDate: importFromDate?.toISOString() ?? null,
      locationsSynced: totalLocations,
      reviewsUpserted: totalReviews,
      errors,
    });
  } catch (err) {
    console.error("Failed to run Google sync", err);
    return NextResponse.json(
      { error: "Failed to run Google sync" },
      { status: 500 }
    );
  }
}
