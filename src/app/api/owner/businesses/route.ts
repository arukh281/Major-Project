import { NextRequest, NextResponse } from "next/server";
import { normalizeIncomingAnalyticsBucketIds } from "@/lib/bucketIntelligence";
import { prisma } from "@/lib/prisma";
import { requireOwnerSession } from "@/lib/ownerSession";

export async function GET(req: NextRequest) {
  const auth = await requireOwnerSession(req);
  if ("response" in auth) return auth.response;

  const businesses = await prisma.business.findMany({
    where: { ownerId: auth.session.userId },
    orderBy: { createdAt: "asc" },
    include: {
      locations: { orderBy: { sortOrder: "asc" } },
      reviewTokens: {
        where: {
          revokedAt: null,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  return NextResponse.json({ data: businesses });
}

export async function POST(req: NextRequest) {
  const auth = await requireOwnerSession(req);
  if ("response" in auth) return auth.response;

  try {
    const existing = await prisma.business.findFirst({
      where: { ownerId: auth.session.userId },
    });
    if (existing) {
      return NextResponse.json(
        { error: "You already have a business. Edit it instead of creating another." },
        { status: 409 }
      );
    }

    const body = (await req.json()) as {
      displayName?: string;
      logoUrl?: string | null;
      locations?: Array<{ name?: string }>;
      businessDescription?: string | null;
      analyticsSubjectBucketIds?: unknown;
    };
    const displayName = body.displayName?.trim();
    if (!displayName) {
      return NextResponse.json(
        { error: "displayName is required" },
        { status: 400 }
      );
    }

    const rawLocs = body.locations;
    const locationNames =
      Array.isArray(rawLocs) && rawLocs.length > 0
        ? rawLocs
            .map((x) => (typeof x?.name === "string" ? x.name.trim() : ""))
            .filter(Boolean)
        : [];

    if (Array.isArray(rawLocs) && rawLocs.length > 0 && locationNames.length === 0) {
      return NextResponse.json(
        { error: "Each location must have a non-empty name" },
        { status: 400 }
      );
    }

    const desc =
      typeof body.businessDescription === "string"
        ? body.businessDescription.trim().slice(0, 4000)
        : "";

    const analyticsCreate =
      body.analyticsSubjectBucketIds !== undefined
        ? {
            analyticsSubjectBucketIds: normalizeIncomingAnalyticsBucketIds(
              body.analyticsSubjectBucketIds
            ),
          }
        : undefined;

    const business = await prisma.business.create({
      data: {
        ownerId: auth.session.userId,
        displayName,
        logoUrl: body.logoUrl?.trim() || null,
        ...(desc ? { businessDescription: desc } : {}),
        ...(analyticsCreate ?? {}),
        ...(locationNames.length > 0
          ? {
              locations: {
                create: locationNames.map((name, i) => ({
                  name,
                  sortOrder: i,
                })),
              },
            }
          : {}),
      },
      include: {
        locations: { orderBy: { sortOrder: "asc" } },
      },
    });

    return NextResponse.json({ data: business });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Failed to create business" },
      { status: 500 }
    );
  }
}
