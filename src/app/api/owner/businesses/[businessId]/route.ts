import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwnerSession } from "@/lib/ownerSession";

async function getOwnedBusiness(
  ownerId: string,
  businessId: string
) {
  return prisma.business.findFirst({
    where: { id: businessId, ownerId },
  });
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ businessId: string }> }
) {
  const auth = await requireOwnerSession(req);
  if ("response" in auth) return auth.response;

  const { businessId } = await ctx.params;
  const business = await getOwnedBusiness(auth.session.userId, businessId);
  if (!business) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const body = (await req.json()) as {
      displayName?: string;
      logoUrl?: string | null;
    };
    const data: { displayName?: string; logoUrl?: string | null } = {};
    if (body.displayName !== undefined) {
      const t = body.displayName.trim();
      if (!t) {
        return NextResponse.json(
          { error: "displayName cannot be empty" },
          { status: 400 }
        );
      }
      data.displayName = t;
    }
    if (body.logoUrl !== undefined) {
      data.logoUrl = body.logoUrl?.trim() || null;
    }

    const updated = await prisma.business.update({
      where: { id: businessId },
      data,
    });
    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Failed to update business" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ businessId: string }> }
) {
  const auth = await requireOwnerSession(req);
  if ("response" in auth) return auth.response;

  const { businessId } = await ctx.params;
  const business = await getOwnedBusiness(auth.session.userId, businessId);
  if (!business) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.business.delete({ where: { id: businessId } });
  return NextResponse.json({ success: true });
}
