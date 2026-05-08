# Local + Supabase Review Ingest (Simple)

Use this as a direct checklist. No extras.

---

## 1) One-time local initialization

Run from project root:

```bash
createdb fynd
cp scripts/reviews/manual-google-reviews.example.json scripts/reviews/manual-google-reviews.json
npx prisma migrate deploy
```

Then start app and sign in once with your Gmail (creates owner row in local DB):

```bash
npm run dev
```

One-command ops menu (recommended):

```bash
bash scripts/ops/run.sh
```

or:

```bash
npm run ops
```

---

## 2) Bootstrap LOCAL database

Run:

```bash
bash scripts/ops/local.sh
```

What it does:

- verifies local PostgreSQL is running on `localhost:5432`
- creates DB if missing (default `fynd`)
- runs Prisma migrations
- prints the local DB URLs

Optional:

```bash
bash scripts/ops/local.sh --with-dev
```

This also starts `npm run dev` after DB setup.

---

## 3) Ingest reviews into LOCAL database

Run:

```bash
bash scripts/ops/ingest.sh --target local
```

Prompts:

- **Gmail** -> choose from listed registered owner emails (or enter manually)
- **Reviews file** -> press Enter (uses `scripts/reviews/manual-google-reviews.json`)
- **Local DB URL** -> press Enter unless you need custom URL
- To ingest a different dataset, enter a specific file path at the **Reviews file** prompt (for example: `scripts/reviews/manual-google-reviews-primary-school.json`).

Important:

- At reviews prompt, do **not** type `y`.
- If you type `y`, script treats it as filename `y` and fails.

---

## 4) Ingest reviews into SUPABASE database

Make sure `.env_supabase` has:

```env
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."
```

Then run:

```bash
bash scripts/ops/ingest.sh --target supabase
```

Prompts:

- **Gmail** -> choose from listed registered owner emails (or enter manually)
- **Reviews file** -> press Enter for default file
- To ingest a different dataset, enter a specific file path at the **Reviews file** prompt (for example: `scripts/reviews/manual-google-reviews-movie-theater.json`).

If Gmail is not present in Supabase DB:

- temporarily run app against Supabase
- sign in once
- run `bash scripts/ops/ingest.sh --target supabase` again

Optional interactive target picker:

```bash
bash scripts/ops/ingest.sh
```

## 5) Reset ONE user (script)

### Local DB reset

```bash
bash scripts/ops/delete-local.sh
```

Prompts:

- Gmail
- Local DB URL (press Enter for default)
- Mode:
  - `1` business-only (recommended)
  - `2` full reset (also deletes User row)

### Supabase DB reset

```bash
bash scripts/ops/delete-supabase.sh
```

Prompts:

- Gmail
- Mode:
  - `1` business-only (recommended)
  - `2` full reset (also deletes User row)

Business-only now clears:

- `Business` rows
- internal `Review` rows linked to that owner's business
- `GoogleAccountLink` rows
- cascaded `GoogleLocation` and `ExternalReview` rows

You will see counts in output:

- `Businesses deleted`
- `Internal reviews deleted`
- `Google links deleted`
- `External reviews deleted`
- `User row deleted`

---

## 6) If something fails

- `public.User does not exist` -> run `npx prisma migrate deploy`
- `Owner not found` -> sign in once in that same DB
- `Reviews file not found` -> run:

```bash
cp scripts/reviews/manual-google-reviews.example.json scripts/reviews/manual-google-reviews.json
```

- Reset showed `0` deletions -> that email has no rows in that selected DB, or data was already deleted

---

## 7) Reset WHOLE database (all users, all data)

Run:

```bash
bash scripts/ops/reset-db.sh
```

Prompts:

- target: `1` local or `2` supabase
- confirmation: type `RESET`
- for local: optional DB URL (press Enter for default)

This clears all app tables:

- `User`
- `Business`
- `BusinessLocation`
- `ReviewToken`
- `Review`
- `GoogleAccountLink`
- `GoogleLocation`
- `ExternalReview`
