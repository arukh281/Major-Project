# Fynd Task 2 — codebase context

Quick reference. Product + env details: [README.md](./README.md).

## What this app is

- **Public home (`/`):** Owner sign-in with Google (OIDC). Signed-in users are redirected to `/admin`.
- **Customer reviews:** Only at **`/review/[token]`** — opaque server-issued token → one `Business`; customer picks a `BusinessLocation`, submits rating + text; `POST /api/review-by-token` persists `Review` with LLM fields (same shape as before).
- **Console (`/admin`):** Middleware + session cookie. Tabs: **Businesses** (CRUD, locations, mint/rotate token, link + QR, Connect Google Business), **Internal**, **Google**, **Insights**. Polling for internal reviews unchanged.
- **Google Business Profile:** Optional second OAuth (`/api/google/oauth/*`) after owner session exists; `GoogleAccountLink.ownerId` → `User`. Sync only that owner’s links.

## Stack

| Layer | Choice |
|--------|--------|
| Framework | Next.js 16 (App Router), React 19 |
| Styling | Tailwind CSS 4, `src/app/globals.css` |
| DB | PostgreSQL + Prisma 5 |
| LLM | OpenRouter `meta-llama/llama-3.1-8b-instruct` ([`src/lib/llm.ts`](src/lib/llm.ts)) |
| Session | `jose` JWT in httpOnly cookie ([`src/lib/ownerSession.ts`](src/lib/ownerSession.ts)) |
| Google | [`src/lib/googleAuth.ts`](src/lib/googleAuth.ts), [`src/lib/googleBusinessProfile.ts`](src/lib/googleBusinessProfile.ts) |

## Source layout (high signal)

- [`src/middleware.ts`](src/middleware.ts) — protects `/admin/*` (JWT cookie).
- [`src/app/api/auth/google/`](src/app/api/auth/google/) — owner OIDC start/callback.
- [`src/app/api/google/oauth/`](src/app/api/google/oauth/) — GBP connect (session required on start).
- [`src/app/api/owner/`](src/app/api/owner/) — businesses, locations, tokens.
- [`src/app/api/public/review/[token]/route.ts`](src/app/api/public/review/[token]/route.ts) — public GET context.
- [`src/app/api/review-by-token/route.ts`](src/app/api/review-by-token/route.ts) — public POST submit.
- [`src/app/review/[token]/`](src/app/review/[token]/) — customer UI.

## Data model (Prisma)

- **`User`** — `googleSub` unique; owner identity from OIDC.
- **`Business`** — `ownerId`, `displayName`, `logoUrl`.
- **`BusinessLocation`** — `businessId`, `name`, `sortOrder`.
- **`ReviewToken`** — opaque `token`, `businessId`, optional `expiresAt` / `revokedAt`.
- **`Review`** — optional `businessId`, `businessLocationId` (nullable for legacy rows; console lists owned businesses only).
- **`GoogleAccountLink`** — `ownerId` → `User` (legacy `userId: "default"` removed; old links cleared in migration).

## HTTP API (auth)

| Area | Auth |
|------|------|
| `/api/admin/*`, `/api/google/sync`, `/api/owner/*` | Owner session cookie (401 if missing) |
| `/api/auth/google/*` | OAuth state cookies |
| `/api/google/oauth/start` | Owner session (redirect `/` if absent) |
| `/api/review-by-token`, `GET /api/public/review/[token]` | None (token is the capability) |
| `POST /api/submit-review` | **410** — disabled |

## Environment variables

See README table: `SESSION_SECRET`, `APP_GOOGLE_REDIRECT_URI`, `GOOGLE_REDIRECT_URI`, `GOOGLE_*`, `DATABASE_URL`, `OPENROUTER_API_KEY`, `ENCRYPTION_KEY`.

## Security / ops reminders

- Never expose `SESSION_SECRET`, `GOOGLE_CLIENT_SECRET`, or `OPENROUTER_API_KEY` to the client.
- GBP OAuth callback expects an **owner session cookie** set in the same browser session.
- Rate-limit `POST /api/review-by-token` in production if exposed publicly.
