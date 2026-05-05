import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { randomBytes, createCipheriv, createDecipheriv } from "crypto";

const APP_GOOGLE_CALLBACK_PATH = "/api/auth/google/callback";

/**
 * Google requires redirect_uri to match across authorize, callback, and token exchange.
 * In development, derive it from the request origin so sign-in works when the app is
 * opened on a LAN hostname as well as localhost; a fixed APP_GOOGLE_REDIRECT_URI would
 * otherwise send the browser to a different host and the OAuth state cookie would not
 * be sent.
 *
 * Google Cloud Console does not allow redirect URIs that use a raw IP (e.g. 192.168.x.x).
 * For phone/LAN testing, use a DNS name that resolves to that IP, e.g.
 * http://192.168.0.128.nip.io:3000 (see https://nip.io) and register that callback URL.
 */
export function getAppGoogleRedirectUri(req: NextRequest): string {
  if (process.env.NODE_ENV !== "production") {
    return new URL(APP_GOOGLE_CALLBACK_PATH, req.nextUrl.origin).toString();
  }
  const configured = process.env.APP_GOOGLE_REDIRECT_URI?.trim();
  if (configured) {
    return configured;
  }
  return new URL(APP_GOOGLE_CALLBACK_PATH, req.nextUrl.origin).toString();
}

const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
const IV_LENGTH = 12; // AES-GCM recommended IV size

function getEncryptionKey(): Buffer | null {
  const isProd = process.env.NODE_ENV === "production";
  if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length < 32) {
    if (isProd) {
      throw new Error(
        "ENCRYPTION_KEY must be set and at least 32 characters long in production"
      );
    }
    // Fallback to plain-text storage only in non-production
    return null;
  }
  return Buffer.from(ENCRYPTION_KEY.slice(0, 32));
}

export function encryptToken(token: string): string {
  const key = getEncryptionKey();
  if (!key) return token;

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  // Store as base64(iv | tag | ciphertext)
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function decryptToken(stored: string): string {
  const key = getEncryptionKey();
  if (!key) return stored;

  try {
    const data = Buffer.from(stored, "base64");
    const iv = data.subarray(0, IV_LENGTH);
    const tag = data.subarray(IV_LENGTH, IV_LENGTH + 16);
    const text = data.subarray(IV_LENGTH + 16);

    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(text), decipher.final()]);
    return decrypted.toString("utf8");
  } catch (err) {
    console.error("Failed to decrypt token, falling back to raw string", err);
    return stored;
  }
}

export function getGoogleClientCredentials(): {
  clientId: string;
  clientSecret: string;
} {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set");
  }
  return { clientId, clientSecret };
}

function getBusinessOAuthConfig() {
  const { clientId, clientSecret } = getGoogleClientCredentials();
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  const scopeEnv = process.env.GOOGLE_OAUTH_SCOPES;

  if (!redirectUri) {
    throw new Error("GOOGLE_REDIRECT_URI must be set for Google Business OAuth");
  }

  const scopes =
    scopeEnv && scopeEnv.trim().length > 0
      ? scopeEnv
      : "https://www.googleapis.com/auth/business.manage";

  return { clientId, clientSecret, redirectUri, scopes };
}

export function getGoogleOAuthScopes(): string {
  const scopeEnv = process.env.GOOGLE_OAUTH_SCOPES;
  return scopeEnv && scopeEnv.trim().length > 0
    ? scopeEnv
    : "https://www.googleapis.com/auth/business.manage";
}

export type GoogleTokenResponse = {
  access_token: string;
  id_token?: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
  token_type: string;
};

export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string
): Promise<GoogleTokenResponse> {
  const { clientId, clientSecret } = getGoogleClientCredentials();

  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  const res = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("Failed to exchange code for tokens", res.status, text);
    throw new Error("Failed to exchange code for tokens");
  }

  return (await res.json()) as GoogleTokenResponse;
}

export async function exchangeBusinessCodeForTokens(
  code: string
): Promise<GoogleTokenResponse> {
  const { redirectUri } = getBusinessOAuthConfig();
  return exchangeCodeForTokens(code, redirectUri);
}

export async function refreshAccessToken(linkId: string): Promise<{
  accessToken: string;
  tokenExpiry: Date;
}> {
  const { clientId, clientSecret } = getGoogleClientCredentials();

  const link = await prisma.googleAccountLink.findUnique({
    where: { id: linkId },
  });

  if (!link) {
    throw new Error(`GoogleAccountLink not found for id=${linkId}`);
  }

  const refreshToken = decryptToken(link.refreshToken);

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const res = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("Failed to refresh access token", res.status, text);
    throw new Error("Failed to refresh access token");
  }

  const data = (await res.json()) as GoogleTokenResponse;

  const expiresAt = new Date(Date.now() + data.expires_in * 1000);
  const encryptedAccessToken = encryptToken(data.access_token);

  await prisma.googleAccountLink.update({
    where: { id: linkId },
    data: {
      accessToken: encryptedAccessToken,
      tokenExpiry: expiresAt,
      // Some refresh flows may rotate the refresh token
      ...(data.refresh_token
        ? { refreshToken: encryptToken(data.refresh_token) }
        : {}),
      scope: data.scope ?? link.scope,
    },
  });

  return { accessToken: data.access_token, tokenExpiry: expiresAt };
}

export async function getValidAccessToken(linkId: string): Promise<string> {
  const link = await prisma.googleAccountLink.findUnique({
    where: { id: linkId },
  });

  if (!link) {
    throw new Error(`GoogleAccountLink not found for id=${linkId}`);
  }

  const now = new Date();
  const expiry = link.tokenExpiry;

  // Refresh a little early to avoid edge cases
  if (!expiry || expiry.getTime() - now.getTime() < 60_000) {
    const { accessToken } = await refreshAccessToken(linkId);
    return accessToken;
  }

  return decryptToken(link.accessToken);
}

