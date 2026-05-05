# Context: src/lib/googleAuth.ts

## What it does
Google OAuth **token** utilities: encrypt/decrypt tokens (AES-256-GCM when `ENCRYPTION_KEY` set), read OAuth client config from env, default scope `https://www.googleapis.com/auth/business.manage`, `exchangeCodeForTokens`, `refreshAccessToken`, `getValidAccessToken` against `GoogleAccountLink` rows in Prisma.

## Exports / Public surface
- **`encryptToken` / `decryptToken`**, **`getGoogleOAuthScopes`**, **`exchangeCodeForTokens`**, **`refreshAccessToken`**, **`getValidAccessToken`**

## What it does NOT do
- Not a NextAuth or "Sign in with Google" session for the admin UI; it supports linking/storing **Business Profile API** credentials.
- Does not create app users or business records.

## Constraints and edge cases
- Production requires `ENCRYPTION_KEY` length ≥32 (throws in prod when refreshing if misconfigured path hits encryption).

## Last read
2026-05-04 — src/lib/googleAuth.ts
