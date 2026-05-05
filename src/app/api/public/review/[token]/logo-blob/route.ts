import { get } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  isPrivateBlobLogoRef,
  privateBlobPathname,
} from "@/lib/blobLogoRef";

function isTokenActive(row: {
  revokedAt: Date | null;
  expiresAt: Date | null;
}): boolean {
  if (row.revokedAt) return false;
  if (row.expiresAt && row.expiresAt.getTime() <= Date.now()) return false;
  return true;
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ token: string }> }
) {
  const { token } = await ctx.params;
  if (!token) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const row = await prisma.reviewToken.findUnique({
    where: { token },
    include: { business: true },
  });

  if (!row || !isTokenActive(row)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const logoUrl = row.business.logoUrl;
  if (!logoUrl || !isPrivateBlobLogoRef(logoUrl)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const pathname = privateBlobPathname(logoUrl);
  if (!pathname) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const result = await get(pathname, { access: "private" });
    if (
      !result ||
      result.statusCode !== 200 ||
      !result.stream
    ) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return new NextResponse(result.stream, {
      headers: {
        "Content-Type": result.blob.contentType,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (e) {
    console.error("logo-blob get failed", e);
    return NextResponse.json({ error: "Logo unavailable" }, { status: 502 });
  }
}
