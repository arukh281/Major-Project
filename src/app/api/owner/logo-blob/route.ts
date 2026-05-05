import { get } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  isPrivateBlobLogoRef,
  privateBlobPathname,
} from "@/lib/blobLogoRef";
import { requireOwnerSession } from "@/lib/ownerSession";

export async function GET(req: NextRequest) {
  const auth = await requireOwnerSession(req);
  if ("response" in auth) return auth.response;

  const ref = req.nextUrl.searchParams.get("ref")?.trim();
  if (!ref || !isPrivateBlobLogoRef(ref)) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const pathname = privateBlobPathname(ref);
  if (!pathname) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: auth.session.userId },
    include: { business: true },
  });
  const stored = user?.business?.logoUrl ?? null;
  if (stored !== ref) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
    console.error("owner logo-blob get failed", e);
    return NextResponse.json({ error: "Logo unavailable" }, { status: 502 });
  }
}
