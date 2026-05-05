import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getGoogleLocationIdsForOwner,
} from "@/lib/ownerScope";
import { requireOwnerSession } from "@/lib/ownerSession";

export async function GET(req: NextRequest) {
  const auth = await requireOwnerSession(req);
  if ("response" in auth) return auth.response;

  try {
    const reviews = await prisma.review.findMany({
      where: {
        business: {
          ownerId: auth.session.userId,
        },
      },
      orderBy: { createdAt: "desc" },
      include: {
        business: { select: { id: true, displayName: true } },
        businessLocation: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ data: reviews });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Failed to fetch reviews" },
      { status: 500 }
    );
  }
}
