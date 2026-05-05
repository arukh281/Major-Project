import { NextRequest, NextResponse } from "next/server";
import { clearOwnerSessionCookie } from "@/lib/ownerSession";

export async function POST(req: NextRequest) {
  const res = NextResponse.json({ success: true });
  clearOwnerSessionCookie(res, req);
  return res;
}
