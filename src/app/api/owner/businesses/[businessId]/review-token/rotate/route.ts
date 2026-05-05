import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateReviewTokenString } from "@/lib/reviewToken";
import { requireOwnerSession } from "@/lib/ownerSession";

export async function POST(
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

  const now = new Date();

  await prisma.reviewToken.updateMany({
    where: {
      businessId,
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    data: { revokedAt: now },
  });

  for (let i = 0; i < 5; i++) {
    const token = generateReviewTokenString();
    try {
      const row = await prisma.reviewToken.create({
        data: { businessId, token },
      });
      return NextResponse.json({ data: row });
    } catch {
      // unique collision
    }
  }

  return NextResponse.json(
    { error: "Could not mint token" },
    { status: 500 }
  );
}
