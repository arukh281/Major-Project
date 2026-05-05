# Context: src/app/api/admin/external-reviews/insights/route.ts

## What it does
Owner-authenticated GET returns time-windowed aggregates and the same theme/alert analysis as analytics, optionally per Google `locationId`, merging external Google reviews with internal `Review` rows when appropriate.

## Exports / Public surface
- `GET(req: NextRequest)` — query `days` (default 7), optional `locationId` (must belong to owner); returns JSON: `locationId`, `days`, `since`, `totalReviews`, `avgRating`, `negativeCount`, `topThemes`, `alerts`

## What it does NOT do
- Not used by the analytics Recharts page (consumed by admin hub “Window insights” tab)
- Does not return rating histogram, trend series, or by-location breakdown

## Constraints and edge cases
- Unknown/forbidden `locationId` → 403
- If owner has locations: aggregates external (since window) + internal (createdAt window); weighted average rating when both present
- If owner has no locations: internal-only window
- If `locationId` set: external-only for that location in window

## Last read
2026-05-04 — src/app/api/admin/external-reviews/insights/route.ts
