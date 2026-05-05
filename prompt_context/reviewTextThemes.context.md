# Context: reviewTextThemes.ts

## What it does
Deterministic text mining on review bodies: merges `comment` and `aiSummary`, buckets substring/keyword hits into named operational themes, and separately counts “severe” risk keywords with example snippets.

## Exports / Public surface
- `ThemeInsightRow` — shape: `id`, `rating`, `comment | null`, `aiSummary | null`, `locationTitle: string`
- `THEME_BUCKETS` — not exported (internal); drives theme labels
- `SEVERE_KEYWORDS` — exported const list used for alert detection
- `snippetFrom(text, maxLen)` — trims/normalizes whitespace, truncates with ellipsis
- `ThemeTop` — `{ theme, count }`
- `ThemeAlert` — `{ keyword, count, examples[] }` where examples have `id`, `rating`, `locationTitle`, `snippet`
- `analyzeThemesAndAlerts(reviews: ThemeInsightRow[])` — returns `{ topThemes, alerts }`; themes sorted by count, top 12; alerts only keywords with count > 0, sorted by count; theme matching uses word-boundary regex on keywords; severe keywords use simple `includes` (substring)

## What it does NOT do
- No ML/embeddings/topic modeling beyond fixed keyword lists
- No sentiment beyond what’s implied by which bucket matched
- No per-location or time-series theme breakdown inside this module
- No deduplication if one review matches multiple themes (each bucket can increment independently for the same review)

## Constraints and edge cases
- Empty combined text skips theme iteration for that review
- Alert examples capped at 3 per severe keyword (first hits in iteration order)
- Theme list is restaurant/ops-oriented (food, cleanliness, refunds, etc.) — not domain-generic

## Last read
2026-05-04 — reviewTextThemes.ts
