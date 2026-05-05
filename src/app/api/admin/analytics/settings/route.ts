import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwnerSession } from "@/lib/ownerSession";

const MODES = new Set(["manual", "scheduled"]);

export async function PATCH(req: NextRequest) {
  const auth = await requireOwnerSession(req);
  if ("response" in auth) return auth.response;

  const ownerId = auth.session.userId;

  let body: { mode?: string; scheduleCron?: string | null };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.mode != null && !MODES.has(body.mode)) {
    return NextResponse.json(
      { error: "mode must be manual or scheduled" },
      { status: 400 }
    );
  }

  const business = await prisma.business.findUnique({
    where: { ownerId },
    select: { id: true },
  });
  if (!business) {
    return NextResponse.json(
      { error: "No business profile found for this owner" },
      { status: 404 }
    );
  }

  await prisma.business.update({
    where: { id: business.id },
    data: {
      ...(body.mode != null ? { analyticsBucketMode: body.mode } : {}),
      ...(body.scheduleCron !== undefined
        ? { analyticsBucketScheduleCron: body.scheduleCron }
        : {}),
    },
  });

  const fresh = await prisma.business.findUnique({
    where: { ownerId },
    select: {
      analyticsBucketMode: true,
      analyticsBucketLastComputedAt: true,
      analyticsBucketComputeStatus: true,
      analyticsBucketScheduleCron: true,
    },
  });

  return NextResponse.json({
    success: true,
    bucketSettings: {
      mode: fresh?.analyticsBucketMode ?? "manual",
      lastComputedAt:
        fresh?.analyticsBucketLastComputedAt?.toISOString() ?? null,
      status: fresh?.analyticsBucketComputeStatus ?? "idle",
      scheduleCron: fresh?.analyticsBucketScheduleCron ?? null,
    },
  });
}
