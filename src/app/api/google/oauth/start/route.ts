import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { shouldUseSecureCookie } from "@/lib/cookieSecure";
import { getGoogleOAuthScopes } from "@/lib/googleAuth";
import { requireOwnerSession } from "@/lib/ownerSession";

const GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";

export async function GET(req: NextRequest) {
  const auth = await requireOwnerSession(req);
  if ("response" in auth) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    console.error(
      "Missing GOOGLE_CLIENT_ID or GOOGLE_REDIRECT_URI for Google OAuth start"
    );
    return NextResponse.json(
      { error: "Google OAuth is not configured" },
      { status: 500 }
    );
  }

  const scopes = getGoogleOAuthScopes();
  const state = randomUUID();

  const url = new URL(GOOGLE_AUTH_ENDPOINT);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("scope", scopes);
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", state);

  const res = NextResponse.redirect(url.toString());
  res.cookies.set("google_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookie(req),
    path: "/",
    maxAge: 10 * 60,
  });

  return res;
}
