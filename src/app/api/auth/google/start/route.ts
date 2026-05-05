import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { shouldUseSecureCookie } from "@/lib/cookieSecure";
import { getAppGoogleRedirectUri, getGoogleClientCredentials } from "@/lib/googleAuth";

const GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";

const APP_SCOPES = "openid email profile";

export async function GET(req: NextRequest) {
  const redirectUri = getAppGoogleRedirectUri(req);

  let clientId: string;
  try {
    ({ clientId } = getGoogleClientCredentials());
  } catch {
    return NextResponse.json(
      { error: "Google OAuth is not configured" },
      { status: 500 }
    );
  }

  const state = randomUUID();

  const url = new URL(GOOGLE_AUTH_ENDPOINT);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("access_type", "online");
  url.searchParams.set("prompt", "select_account");
  url.searchParams.set("scope", APP_SCOPES);
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", state);

  const res = NextResponse.redirect(url.toString());
  res.cookies.set("app_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookie(req),
    path: "/",
    maxAge: 10 * 60,
  });

  return res;
}
