# Context: src/app/admin/page.tsx

## What it does
Client admin dashboard at `/admin`: tabs **Internal** (in-app `Review` rows), **Google** (`ExternalReview` + filters + sync/generate AI), **Window insights** (keyword/theme rollups via insights API). Uses `ensureAdminSecret()` → `window.prompt` + `localStorage` key `adminSecret`, sends `x-admin-secret` on fetches. Header links to `/admin/analytics`.

## Exports / Public surface
- **default export `AdminPage`**: orchestrates `fetchReviews`, `fetchExternalReviews`, `fetchInsights`, `syncGoogleNow`, `generateAiForMissing`; polling internal reviews every 5s.

## What it does NOT do
- No Google Sign-In UI for admin identity; auth is shared secret only.
- No QR code generation, shareable review links, or business CRUD UI.
- No sessioned/customer-scoped review flow beyond what APIs return.

## Constraints and edge cases
- Without `adminSecret`, APIs are not called meaningfully after prompt cancel.
- Google tab location dropdown is populated from external-reviews API `locations` (synced `GoogleLocation` data), not owner-defined arbitrary locations.

## Last read
2026-05-04 — src/app/admin/page.tsx
