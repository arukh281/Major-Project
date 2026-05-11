# Context: src/lib/bucketIntelligence.ts

## What it does
Deterministic "subject bucket" layer on top of lexical `THEME_BUCKETS`. Maps each review (comment + aiSummary) to zero-or-many `SubjectBucketId`s via `THEME_TO_SUBJECT_BUCKETS` plus `SUBJECT_DIRECT_KEYWORDS`. `buildBucketIntelligencePayload(reviews, windows, range, activeBucketIds?)` produces `bucketInsights` (per-bucket health/priority/snippets), `bucketTrend` (per-day per-bucket count/avg/health), `bucketByLocation` (per-location bucket cells), and `bucketMetricsMeta`. Powers the "Review topics (tagged)" section in the admin analytics page.

## Exports / Public surface
- `SubjectBucketId` union: `staff_service | food_drinks | cleanliness_ambience | stock_items_orders | pricing_trust | delivery_ops`
- `BUCKET_DEFINITIONS` — id/label/description for each bucket
- `subjectBucketsForReview(comment, aiSummary)` → `SubjectBucketId[]` (deduped). Returns `[]` if no theme name and no direct keyword matches.
- `resolveActiveSubjectBucketIds(stored)` — `[]` means all buckets; subset filters
- `normalizeIncomingAnalyticsBucketIds(raw)` — validates API input
- `filterTopThemesByActiveSubjects(themes, activeBucketIds)`
- `formatAnalyticsBucketSuggestionSummary(ids)`
- `resolveMetricsWindow`, `parseAnalyticsRange`, `metricsWindowEndExclusive`
- `healthScoreFromRatings`, `bandFromHealth`, `trendMultiplierFromHealths`, `priorityScore`
- `computeWorstLocationsForWindow`
- `buildBucketIntelligencePayload(reviews, windows, range, activeBucketIds?)` — the main aggregation entry point
- Types: `BucketInsightRow`, `BucketTrendRow`, `BucketByLocationRow`, `BucketMetricsMeta`, `NormalizedBlendedReview`

## What it does NOT do
- No "Other" / "Untagged" bucket — reviews whose text matches no theme name and no direct keyword are completely dropped from all counts and snippets.
- No fallback by rating alone — a 1★ review with empty/short text or vocabulary outside the keyword lists is invisible to this layer.
- No per-review tagged/untagged status returned — there's no way for the UI to show "X reviews not tagged".
- Hard cap `MAX_BUCKET_EXAMPLES = 3` on snippets per global bucket card; per-location snippets capped at 2.
- Hard cap `MAX_LOCATIONS = 24` on `bucketByLocation` — locations beyond top-24 by tagged volume are dropped.
- No multi-select for severity filter in UI; only `"all" | "red" | "amber"` (green/neutral hidden when red/amber selected).
- `activeBucketIds` filtering happens before tagging (line 607) — if a review only matched buckets the owner has disabled, its subjects collapse to `[]` and the review is treated as untagged for this run.
- No ML / embeddings / sentiment — pure word-boundary regex on hardcoded keyword lists.

## Constraints and edge cases
- `THEME_TO_SUBJECT_BUCKETS` keyword list is hospitality/retail-leaning; some verticals (e.g. salons, music tutoring) will under-tag.
- `subjectBucketsForReview` lowercases combined text once; word-boundary regex via `\b` means partial words like "rudely" won't match "rude" (it would, since `\brude\b` matches before "ly"? actually `\brude\b` requires a word boundary AFTER "rude", and "rudely" has no boundary there — so it would NOT match). Multi-word phrases like "rip off" use space which is a word boundary, fine.
- Empty `comment` and `aiSummary` ⇒ `subjectBucketsForReview` returns `[]`.
- `exampleSnippets` are sorted by rating ascending (worst first), then sliced; ties are stable in iteration order.
- `bucketByLocation` ranks locations by total tagged volume in window, not by health.
- `priorityScore = round(taggedCountWindow * (100-health)/100 * trendMultiplier * 100) / 100`; `trendMultiplier` requires ≥3 prior-window samples to engage.

## Last read
2026-05-08 — src/lib/bucketIntelligence.ts
