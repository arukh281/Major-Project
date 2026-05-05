import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwnerSession } from "@/lib/ownerSession";

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ businessId: string }> }
) {
  const auth = await requireOwnerSession(req);
  if ("response" in auth) return auth.response;

  const { businessId } = await ctx.params;
  const business = await prisma.business.findFirst({
    where: { id: businessId, ownerId: auth.session.userId },
  });
  if (!business) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const body = (await req.json()) as {
      locations?: Array<{ name: string }>;
    };
    const raw = body.locations;
    if (!Array.isArray(raw)) {
      return NextResponse.json(
        { error: "locations array required" },
        { status: 400 }
      );
    }

    const names = raw
      .map((x) => (typeof x.name === "string" ? x.name.trim() : ""))
      .filter(Boolean);
    if (names.length !== raw.length) {
      return NextResponse.json(
        { error: "Each location must have a non-empty name" },
        { status: 400 }
      );
    }

    await prisma.$transaction([
      prisma.businessLocation.deleteMany({ where: { businessId } }),
      prisma.businessLocation.createMany({
        data: names.map((name, i) => ({
          businessId,
          name,
          sortOrder: i,
        })),
      }),
    ]);

    const locations = await prisma.businessLocation.findMany({
      where: { businessId },
      orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json({ data: locations });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Failed to update locations" },
      { status: 500 }
    );
  }
}
