import { NextRequest, NextResponse } from "next/server";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";
import {
  exchangeCodeForTokens,
  getAppGoogleRedirectUri,
  getGoogleClientCredentials,
} from "@/lib/googleAuth";
import { shouldUseSecureCookie } from "@/lib/cookieSecure";
import {
  attachOwnerSessionCookie,
  sealOwnerSession,
} from "@/lib/ownerSession";

const GOOGLE_JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs")
);

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    console.error("App Google OAuth error", error);
    return NextResponse.redirect(
      new URL(`/?error=${encodeURIComponent(error)}`, req.url)
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/?error=missing_code", req.url)
    );
  }

  const stateCookie = req.cookies.get("app_oauth_state")?.value;
  if (!stateCookie || stateCookie !== state) {
    console.error("App OAuth state mismatch");
    return NextResponse.redirect(new URL("/?error=invalid_state", req.url));
  }

  const redirectUri = getAppGoogleRedirectUri(req);

  let clientId: string;
  try {
    ({ clientId } = getGoogleClientCredentials());
  } catch {
    return NextResponse.redirect(new URL("/?error=misconfigured", req.url));
  }

  try {
    const tokens = await exchangeCodeForTokens(code, redirectUri);
    const idToken = tokens.id_token;
    if (!idToken) {
      console.error("App OAuth: no id_token in token response");
      return NextResponse.redirect(new URL("/?error=no_id_token", req.url));
    }

    const { payload } = await jwtVerify(idToken, GOOGLE_JWKS, {
      issuer: ["https://accounts.google.com", "accounts.google.com"],
      audience: clientId,
    });

    const googleSub = payload.sub as string | undefined;
    if (!googleSub) {
      return NextResponse.redirect(new URL("/?error=no_sub", req.url));
    }

    const email =
      typeof payload.email === "string" ? payload.email : null;
    const name =
      typeof payload.name === "string" ? payload.name : null;
    const image =
      typeof payload.picture === "string" ? payload.picture : null;

    const user = await prisma.user.upsert({
      where: { googleSub },
      create: {
        googleSub,
        email,
        name,
        image,
      },
      update: {
        email,
        name,
        image,
      },
    });

    const jwt = await sealOwnerSession({
      userId: user.id,
      googleSub: user.googleSub,
    });

    const res = NextResponse.redirect(new URL("/admin", req.url));
    attachOwnerSessionCookie(res, jwt, req);
    res.cookies.set("app_oauth_state", "", {
      httpOnly: true,
      sameSite: "lax",
      secure: shouldUseSecureCookie(req),
      path: "/",
      maxAge: 0,
    });
    return res;
  } catch (err) {
    console.error("App Google OAuth callback failed", err);
    return NextResponse.redirect(
      new URL("/?error=callback_failed", req.url)
    );
  }
}
