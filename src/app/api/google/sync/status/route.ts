import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwnerSession } from "@/lib/ownerSession";

export async function GET(req: NextRequest) {
  const auth = await requireOwnerSession(req);
  if ("response" in auth) return auth.response;

  try {
    const latest = await prisma.googleAccountLink.findFirst({
      where: { ownerId: auth.session.userId },
      orderBy: { lastSyncedAt: "desc" },
      select: { lastSyncedAt: true },
    });

    return NextResponse.json({
      lastSyncTime: latest?.lastSyncedAt
        ? latest.lastSyncedAt.toISOString()
        : null,
    });
  } catch (err) {
    console.error("Failed to read Google sync status", err);
    return NextResponse.json(
      { error: "Failed to read sync status" },
      { status: 500 }
    );
  }
}
