import { NextRequest, NextResponse } from "next/server";
import { reviewLogoImgSrc } from "@/lib/blobLogoRef";
import { prisma } from "@/lib/prisma";

function isTokenActive(row: {
  revokedAt: Date | null;
  expiresAt: Date | null;
}): boolean {
  if (row.revokedAt) return false;
  if (row.expiresAt && row.expiresAt.getTime() <= Date.now()) return false;
  return true;
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ token: string }> }
) {
  const { token } = await ctx.params;
  if (!token) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const row = await prisma.reviewToken.findUnique({
    where: { token },
    include: {
      business: {
        include: {
          locations: { orderBy: { sortOrder: "asc" } },
        },
      },
    },
  });

  if (!row || !isTokenActive(row)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    business: {
      displayName: row.business.displayName,
      logoUrl: reviewLogoImgSrc(row.business.logoUrl, token),
    },
    locations: row.business.locations.map((l) => ({
      id: l.id,
      name: l.name,
    })),
  });
}
