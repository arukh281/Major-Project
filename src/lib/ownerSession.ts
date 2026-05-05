import { SignJWT, jwtVerify } from "jose";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { shouldUseSecureCookie } from "@/lib/cookieSecure";

export const OWNER_SESSION_COOKIE = "fynd_owner_session";

const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 14; // 14 days

function sessionKey(): Uint8Array {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) {
    throw new Error(
      "SESSION_SECRET must be set and at least 32 characters (use a strong random string)."
    );
  }
  return new TextEncoder().encode(s.slice(0, 32));
}

export type OwnerSessionPayload = {
  userId: string;
  googleSub: string;
};

export async function sealOwnerSession(
  payload: OwnerSessionPayload
): Promise<string> {
  return new SignJWT({
    userId: payload.userId,
    googleSub: payload.googleSub,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SEC}s`)
    .sign(sessionKey());
}

export async function verifyOwnerSessionToken(
  token: string
): Promise<OwnerSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, sessionKey(), {
      algorithms: ["HS256"],
    });
    const userId = payload.userId as string | undefined;
    const googleSub = payload.googleSub as string | undefined;
    if (!userId || !googleSub) return null;
    return { userId, googleSub };
  } catch {
    return null;
  }
}

export async function getOwnerSessionFromRequest(
  req: NextRequest
): Promise<OwnerSessionPayload | null> {
  const token = req.cookies.get(OWNER_SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifyOwnerSessionToken(token);
}

export function ownerSessionCookieBase(req: NextRequest) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: shouldUseSecureCookie(req),
    path: "/",
    maxAge: SESSION_MAX_AGE_SEC,
  };
}

export function attachOwnerSessionCookie(
  res: NextResponse,
  jwt: string,
  req: NextRequest
) {
  res.cookies.set(OWNER_SESSION_COOKIE, jwt, ownerSessionCookieBase(req));
}

export function clearOwnerSessionCookie(res: NextResponse, req: NextRequest) {
  res.cookies.set(OWNER_SESSION_COOKIE, "", {
    ...ownerSessionCookieBase(req),
    maxAge: 0,
  });
}

export async function requireOwnerSession(
  req: NextRequest
): Promise<
  | { session: OwnerSessionPayload }
  | { response: NextResponse }
> {
  try {
    const session = await getOwnerSessionFromRequest(req);
    if (!session) {
      return {
        response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      };
    }
    return { session };
  } catch (err) {
    console.error("Session misconfigured or invalid", err);
    return {
      response: NextResponse.json(
        { error: "Server misconfigured" },
        { status: 500 }
      ),
    };
  }
}
