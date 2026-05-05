import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwnerSession } from "@/lib/ownerSession";

export async function GET(req: NextRequest) {
  const auth = await requireOwnerSession(req);
  if ("response" in auth) return auth.response;

  const user = await prisma.user.findUnique({
    where: { id: auth.session.userId },
    include: {
      business: {
        include: {
          locations: { orderBy: { sortOrder: "asc" } },
          reviewTokens: {
            where: {
              revokedAt: null,
              OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
            },
            take: 5,
            orderBy: { createdAt: "desc" },
          },
        },
      },
      googleAccountLinks: { select: { id: true, googleAccountEmail: true } },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
    },
    business: user.business
      ? {
          id: user.business.id,
          displayName: user.business.displayName,
          logoUrl: user.business.logoUrl,
          locations: user.business.locations.map((l) => ({
            id: l.id,
            name: l.name,
            sortOrder: l.sortOrder,
          })),
          activeTokens: user.business.reviewTokens.map((t) => ({
            id: t.id,
            token: t.token,
            expiresAt: t.expiresAt,
            createdAt: t.createdAt,
          })),
        }
      : null,
    googleLinked: user.googleAccountLinks.length > 0,
    googleAccountEmail: user.googleAccountLinks[0]?.googleAccountEmail ?? null,
  });
}
