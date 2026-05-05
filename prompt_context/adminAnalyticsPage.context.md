# Context: src/app/admin/analytics/page.tsx

## What it does
Client `AnalyticsPage` loads `/api/admin/analytics?range=week|month|year|all` (default month; no `x-admin-secret` header). Renders KPIs, merged trend area chart, composition strips, histogram, location bar chart (Google vs internal titles), lexical + risk panels, **subject buckets** (health, priority, trend chart, by-location), and **Org synthesis**: POST `/api/admin/analytics/strategy` with JSON `{ range }` then shows `OrgGroundTruthStrip` (`OrgSynthesisGrounding`) plus `OrgSynthesisOverview` (`OrgSynthesis` patterns + nextSteps with keyword/detail).

## Exports / Public surface
- default export `AnalyticsPage`
- Local `AnalyticsPayload` type matching GET response
- `OrgGroundTruthStrip`, `OrgSynthesisOverview`, `Kpi`, `ChartPanel`, `AbstractStrip`

## What it does NOT do
- No admin secret prompt; relies on session-backed routes
- No separate trend-days vs bucket-preset controls; single **Time range** select

## Constraints and edge cases
- Strategy errors shown in `synthesisError`; invalid response shape handled
- Ground truth strip reflects **blended** corpus (Google + internal), aligned with strategy route

## Last read
2026-05-05 — src/app/admin/analytics/page.tsx
