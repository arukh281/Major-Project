import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  externalReviewsOwnedByWhere,
  getGoogleLocationIdsForOwner,
} from "@/lib/ownerScope";
import { requireOwnerSession } from "@/lib/ownerSession";

export async function GET(req: NextRequest) {
  const auth = await requireOwnerSession(req);
  if ("response" in auth) return auth.response;

  const ownerId = auth.session.userId;

  try {
    const { searchParams } = new URL(req.url);

    const locationId = searchParams.get("locationId") || undefined;
    const ratingStr = searchParams.get("rating") || undefined;
    const startDateStr = searchParams.get("startDate") || undefined;
    const endDateStr = searchParams.get("endDate") || undefined;

    const rating = ratingStr ? parseInt(ratingStr, 10) : undefined;
    const startDate = startDateStr ? new Date(startDateStr) : undefined;
    const endDate = endDateStr ? new Date(endDateStr) : undefined;

    const locationIds = await getGoogleLocationIdsForOwner(ownerId);
    if (locationId && !locationIds.includes(locationId)) {
      return NextResponse.json(
        { error: "Unknown location" },
        { status: 403 }
      );
    }

    const scope = externalReviewsOwnedByWhere(ownerId);

    const reviews = await prisma.externalReview.findMany({
      where: {
        ...scope,
        ...(locationId ? { locationId } : {}),
        ...(rating ? { rating } : {}),
        ...(startDate || endDate
          ? {
              createTime: {
                ...(startDate ? { gte: startDate } : {}),
                ...(endDate ? { lte: endDate } : {}),
              },
            }
          : {}),
      },
      orderBy: { createTime: "desc" },
      include: {
        location: true,
      },
    });

    const locations = await prisma.googleLocation.findMany({
      where: { link: { ownerId } },
      orderBy: { locationTitle: "asc" },
    });

    const internalLocations = await prisma.businessLocation.findMany({
      where: { business: { ownerId } },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true },
    });

    return NextResponse.json({
      data: reviews,
      locations,
      internalLocations,
    });
  } catch (err) {
    console.error("Failed to fetch external reviews", err);
    return NextResponse.json(
      { error: "Failed to fetch external reviews" },
      { status: 500 }
    );
  }
}
