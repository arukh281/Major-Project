# Context: src/app/api/admin/analytics/strategy/route.ts

## What it does
Owner-authenticated POST loads **only** `ExternalReview` rows for the owner, runs `analyzeThemesAndAlerts`, builds `OrgSynthesisGrounding` via `OrgSynthesisGroundingSchema.parse`, calls `callLlama` with a JSON-only prompt, validates output with `parseOrgSynthesisFromLlm` (`OrgSynthesisSchema`), returns `{ success, synthesis, grounding }` or validation error 502. Empty external corpus returns `emptyCorpusSynthesis` + `emptyGrounding` with `success: true`.

## Exports / Public surface
- `POST(req)` — no request body required for core flow; uses `callLlama(prompt, { temperature: 0.35 })`

## What it does NOT do
- Does **not** include internal `Review` rows in facts, grounding, or LLM context (still Google-imported corpus only)
- No structured bucket health / 0–100 scores in response

## Constraints and edge cases
- Grounding: top 6 themes, all non-zero risk alerts as `riskKeywords`
- Invalid JSON from model → 502 with message to retry Generate overview

## Last read
2026-05-05 — src/app/api/admin/analytics/strategy/route.ts
