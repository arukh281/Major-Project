import { NextRequest, NextResponse } from "next/server";
import { shouldUseSecureCookie } from "@/lib/cookieSecure";
import { prisma } from "@/lib/prisma";
import {
  encryptToken,
  exchangeBusinessCodeForTokens,
} from "@/lib/googleAuth";
import { syncLocationsForLink } from "@/lib/googleBusinessProfile";
import { getOwnerSessionFromRequest } from "@/lib/ownerSession";

const GOOGLE_USERINFO_ENDPOINT =
  "https://www.googleapis.com/oauth2/v2/userinfo";

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    console.error("Google OAuth error", error);
    return NextResponse.redirect(
      new URL(`/admin?gbp_error=${encodeURIComponent(error)}`, req.url)
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/admin?gbp_error=missing_code", req.url)
    );
  }

  const stateCookie = req.cookies.get("google_oauth_state")?.value;
  if (!stateCookie || stateCookie !== state) {
    console.error("Google OAuth state mismatch", {
      queryState: state,
      cookieState: stateCookie,
    });
    return NextResponse.redirect(
      new URL("/admin?gbp_error=invalid_state", req.url)
    );
  }

  const session = await getOwnerSessionFromRequest(req);
  if (!session) {
    return NextResponse.redirect(
      new URL("/?error=session_required_for_gbp", req.url)
    );
  }

  try {
    const tokens = await exchangeBusinessCodeForTokens(code);

    if (!tokens.refresh_token) {
      console.warn(
        "Google OAuth callback did not return a refresh token. Ensure access_type=offline and prompt=consent are configured."
      );
    }

    const accessTokenEncrypted = encryptToken(tokens.access_token);
    const refreshTokenEncrypted = tokens.refresh_token
      ? encryptToken(tokens.refresh_token)
      : null;

    let googleAccountEmail: string | null = null;
    try {
      const userInfoRes = await fetch(GOOGLE_USERINFO_ENDPOINT, {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
        },
      });
      if (userInfoRes.ok) {
        const info = (await userInfoRes.json()) as { email?: string };
        googleAccountEmail = info.email ?? null;
      }
    } catch (err) {
      console.warn("Failed to fetch Google userinfo", err);
    }

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
    const ownerId = session.userId;

    let link = await prisma.googleAccountLink.findFirst({
      where: { ownerId },
    });

    if (!link) {
      link = await prisma.googleAccountLink.create({
        data: {
          ownerId,
          googleAccountEmail,
          accessToken: accessTokenEncrypted,
          refreshToken:
            refreshTokenEncrypted ??
            (tokens.refresh_token
              ? encryptToken(tokens.refresh_token)
              : encryptToken(tokens.access_token)),
          tokenExpiry: expiresAt,
          scope: tokens.scope ?? "",
        },
      });
    } else {
      link = await prisma.googleAccountLink.update({
        where: { id: link.id },
        data: {
          googleAccountEmail,
          accessToken: accessTokenEncrypted,
          ...(refreshTokenEncrypted
            ? { refreshToken: refreshTokenEncrypted }
            : {}),
          tokenExpiry: expiresAt,
          scope: tokens.scope ?? link.scope,
        },
      });
    }

    try {
      await syncLocationsForLink(link.id);
    } catch (err) {
      console.error("Failed to sync locations after OAuth callback", err);
    }

    const res = NextResponse.redirect(
      new URL("/admin?gbp_connected=1", req.url)
    );
    res.cookies.set("google_oauth_state", "", {
      httpOnly: true,
      sameSite: "lax",
      secure: shouldUseSecureCookie(req),
      path: "/",
      maxAge: 0,
    });

    return res;
  } catch (err) {
    console.error("Error in Google OAuth callback", err);
    return NextResponse.redirect(
      new URL("/admin?gbp_error=callback_failed", req.url)
    );
  }
}
