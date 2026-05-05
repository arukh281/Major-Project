import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { externalReviewsOwnedByWhere } from "@/lib/ownerScope";
import { requireOwnerSession } from "@/lib/ownerSession";

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireOwnerSession(req);
  if ("response" in auth) return auth.response;

  const { id } = await ctx.params;
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  try {
    const result = await prisma.externalReview.deleteMany({
      where: {
        id,
        ...externalReviewsOwnedByWhere(auth.session.userId),
      },
    });

    if (result.count === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Failed to delete external review", err);
    return NextResponse.json(
      { error: "Failed to delete review" },
      { status: 500 }
    );
  }
}
