# Context: src/app/api/admin/analytics/route.ts

## What it does
Owner-authenticated GET builds a JSON snapshot over **both** imported Google `ExternalReview` rows (`externalReviewsOwnedByWhere`) and internal token-flow `Review` rows (`ownedInternalReviewsWhere`): blended totals, merged daily **trend** from `trendSince` (aligned with the selected range), combined rating histogram, unified `byLocation` list (Google + internal with prefixed ids), `topThemes` / `alerts` from `analyzeThemesAndAlerts` on merged `ThemeInsightRow[]`, and **bucket intelligence** (`bucketDefinitions`, `bucketInsights`, `bucketTrend`, `bucketByLocation`, `bucketMetricsMeta`) from `buildBucketIntelligencePayload` using the same `range` window.

## Exports / Public surface
- `GET(req)` — query `range`: `week` | `month` | `year` | `all` (default `month`). Helpers `toDayKey`, `mergeDailyTrend(ext,int)`; returns JSON with `generatedAt`, `range`, `trendSince`, `totals`, `ratingHistogram`, `trend`, `byLocation`, `topThemes`, `alerts`, plus bucket fields.

## What it does NOT do
- Theme/alert analysis uses **full** scoped corpora for ext + int; **trend** and **bucket window metrics** use the same `[trendSince, now]` window derived from `range` (`all` = full corpus dates).

## Constraints and edge cases
- Google daily trend query runs only when `locationIds.length > 0`; internal trend always runs via raw SQL on `Review` joined to `Business` by `ownerId`
- `byLocation` entries: Google `locationId` like `g:<uuid>`, internal `i:<id>` or `i:none` for null `businessLocationId`; internal titles suffixed `· internal`
- Errors → 500 `{ error: "Failed to build analytics snapshot" }`

## Last read
2026-05-05 — src/app/api/admin/analytics/route.ts
