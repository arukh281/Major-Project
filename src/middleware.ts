import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { OWNER_SESSION_COOKIE } from "@/lib/ownerSession";

function sessionKeyBytes(): Uint8Array | null {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) return null;
  return new TextEncoder().encode(s.slice(0, 32));
}

export async function middleware(req: NextRequest) {
  if (!req.nextUrl.pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

  const token = req.cookies.get(OWNER_SESSION_COOKIE)?.value;
  const key = sessionKeyBytes();
  if (!token || !key) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  try {
    await jwtVerify(token, key, { algorithms: ["HS256"] });
    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL("/", req.url));
  }
}

export const config = {
  matcher: ["/admin/:path*"],
};
