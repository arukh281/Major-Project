**Fynd — Task 2: Owner-first reviews + Google Business Profile**

A Next.js app where **business owners** sign in with Google, manage **one business profile** per account (with locations and a review link), and optionally connect **Google Business Profile** to import public reviews. Customers submit feedback only at **`/review/[token]`** (shareable URL + QR); there is no global anonymous review form on `/`.

**Features Overview**

- **Owner Google sign-in (OIDC):** `openid email profile` → session cookie (`SESSION_SECRET` + signed JWT). Home at `/` is the owner entry point.
- **Business:** One profile per owner — display name, logo URL, free-text **locations** (customer picks one at review time), **mint / rotate** opaque review tokens.
- **Customer review flow:** `/review/[token]` loads branding + locations; `POST /api/review-by-token` runs the same parallel LLM triage as before (`aiResponse`, `aiSummary`, `aiActions`) and stores a scoped `Review` row.
- **Google Business Profile (optional, second step):** After sign-in, **Connect Google Business** hits `/api/google/oauth/start` (requires session). Tokens stay encrypted (`ENCRYPTION_KEY`); sync behavior unchanged but scoped to the signed-in owner’s `GoogleAccountLink`.
- **Operations console (`/admin`):** Internal reviews (token-scoped), imported Google reviews, insights, analytics — all gated by the owner session (no `ADMIN_SECRET` in the browser).

**System Architecture**

- **Next.js 16** App Router, React 19, Tailwind 4, Prisma 5 + PostgreSQL.
- **LLM:** OpenRouter `meta-llama/llama-3.1-8b-instruct` ([`src/lib/llm.ts`](src/lib/llm.ts)).

**Environment variables**

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `OPENROUTER_API_KEY` | OpenRouter API key |
| `SESSION_SECRET` | **Required** (32+ chars). Signs the owner session cookie |
| `GOOGLE_CLIENT_ID` | OAuth web client ID (shared for app sign-in + GBP) |
| `GOOGLE_CLIENT_SECRET` | OAuth client secret |
| `APP_GOOGLE_REDIRECT_URI` | e.g. `http://localhost:3000/api/auth/google/callback` — **owner OIDC** redirect |
| `GOOGLE_REDIRECT_URI` | e.g. `http://localhost:3000/api/google/oauth/callback` — **Google Business** redirect |
| `GOOGLE_OAUTH_SCOPES` | Optional; default `https://www.googleapis.com/auth/business.manage` for GBP only |
| `ENCRYPTION_KEY` | Optional in dev; ≥32 chars; **required in production** for Google token encryption |

`ADMIN_SECRET` is **no longer used** by this app for browser or API auth. Remove it from env when migrating.

**Google Cloud Console**

1. OAuth consent screen (External / Testing as needed).
2. OAuth client (Web): add **both** authorized redirect URIs:
   - `…/api/auth/google/callback` (owner sign-in)
   - `…/api/google/oauth/callback` (Business Profile)
3. Test users: add accounts you will sign in with while in Testing mode.

**Local setup**

```bash
cd task_2
npm install
# set .env — see table above
npx prisma migrate deploy   # or migrate dev
npm run dev
```

- Open **`/`** → **Sign in with Google** → redirected to **`/admin`**.
- **Business** tab: set up once — name, locations (one per line), **Mint review link**, copy URL / QR; customers use `/review/[token]`. Connect Google Business separately to sync imported reviews (many GBP locations are fine).
- **Connect Google Business** (same tab): completes GBP OAuth; then **Google** tab → **Sync now**.

**Seed mock Google reviews (no real GBP account)**

If you want to test the Google review UI/filters/AI flows without a real Google Business Profile:

```bash
# Uses most recently created owner if no args are passed
npm run seed:google-mock

# Or target a specific owner account
npm run seed:google-mock -- --owner-email you@example.com --count 20
```

What this script does:
- Creates/updates a `GoogleAccountLink` for the owner.
- Creates/updates one mock `GoogleLocation`.
- Upserts mock `ExternalReview` rows (`platform=GOOGLE`) so `/admin` → **Google review** has test data.

**API summary**

- `GET /api/auth/google/start` — Owner OIDC redirect  
- `GET /api/auth/google/callback` — Sets session cookie  
- `POST /api/auth/logout` — Clears session  
- `GET /api/google/oauth/start` — GBP OAuth (requires owner session)  
- `GET /api/google/oauth/callback` — Links `GoogleAccountLink` to session user  
- `GET /api/owner/me`, `GET/POST /api/owner/businesses`, … — Owner CRUD (session)  
- `GET /api/public/review/[token]` — Public branding + locations  
- `POST /api/review-by-token` — Customer submit (body: `token`, `businessLocationId`, `rating`, `review`)  
- `POST /api/submit-review` — **Disabled (410)**; superseded by token flow  
- Admin analytics / reviews / external routes — **session cookie**, data scoped to owner  

**File references**

- Session: [`src/lib/ownerSession.ts`](src/lib/ownerSession.ts)  
- Owner scope helpers: [`src/lib/ownerScope.ts`](src/lib/ownerScope.ts)  
- Prisma schema: [`prisma/schema.prisma`](prisma/schema.prisma)  
- Middleware: [`src/middleware.ts`](src/middleware.ts) (protects `/admin`)
