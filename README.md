# Fynd

Owner-first review management app built with Next.js, Prisma, and PostgreSQL.
Business owners sign in with Google, generate tokenized public review links, and optionally sync Google Business Profile reviews.

## Live deployment

- Production: [https://major-project-fynd.vercel.app](https://major-project-fynd.vercel.app)
- Stack: Next.js 16 (App Router), React 19, Prisma 5, PostgreSQL, Tailwind 4

## Quick start

```bash
npm install
npx prisma migrate deploy
npm run dev
```

Open `http://localhost:3000`, sign in with Google, then continue in `/admin`.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `DIRECT_URL` | Direct database URL required by Prisma schema |
| `OPENROUTER_API_KEY` | OpenRouter API key for LLM features |
| `SESSION_SECRET` | Required (32+ chars), signs owner session cookie |
| `GOOGLE_CLIENT_ID` | OAuth web client ID |
| `GOOGLE_CLIENT_SECRET` | OAuth client secret |
| `APP_GOOGLE_REDIRECT_URI` | Owner login callback (e.g. `/api/auth/google/callback`) |
| `GOOGLE_REDIRECT_URI` | Google Business callback (e.g. `/api/google/oauth/callback`) |
| `GOOGLE_OAUTH_SCOPES` | Optional, defaults to GBP scope |
| `ENCRYPTION_KEY` | Required in production, encrypts linked Google tokens |

## Core workflows

### 1) Owner flow

- Sign in with Google at `/`
- Create business and locations in `/admin`
- Mint review link token
- Share `/review/[token]` with customers

### 2) Google Business (optional)

- Connect account from `/admin`
- Sync imported reviews
- Analyze both internal + external reviews in admin dashboards

### 3) Manual local/Supabase ingest operations

- Main runbook: `docs/runbooks/local-and-supabase-ingest.md`
- One-command interactive ops menu: `bash scripts/ops/run.sh` (or `npm run ops`)
- Interactive scripts are in `scripts/ops/`:
  - `scripts/ops/run.sh` (single menu for all ops actions)
  - `scripts/ops/local.sh` (bootstrap local DB)
  - `scripts/ops/ingest.sh` (unified local/Supabase ingest)
  - `scripts/ops/delete-local.sh`
  - `scripts/ops/delete-supabase.sh`
  - `scripts/ops/reset-db.sh`

## NPM scripts

- `npm run dev` - start local dev server
- `npm run build` - prisma migrate deploy + prisma generate + next build
- `npm run start` - start production server
- `npm run lint` - run Next.js lint checks
- `npm run seed:google-mock` - seed mock Google reviews
- `npm run ingest:manual-google` - ingest manual Google review JSON

## Project structure

- `src/` - app routes, API handlers, shared libraries
- `prisma/` - schema and database model definitions
- `scripts/` - operational and ingest tooling
- `scripts/reviews/` - manual review JSON datasets for ingest
- `scripts/ops/` - shell wrappers for local/Supabase data workflows
- `docs/` - operational docs and runbooks
- `report/` - academic report assets and generated LaTeX outputs

## Key paths

- Session handling: `src/lib/ownerSession.ts`
- Owner data scoping: `src/lib/ownerScope.ts`
- Prisma schema: `prisma/schema.prisma`
- Route protection: `src/middleware.ts`
- Ingest runbook: `docs/runbooks/local-and-supabase-ingest.md`
