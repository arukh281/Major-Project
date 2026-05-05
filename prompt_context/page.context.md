# Context: src/app/page.tsx

## What it does
Public home route renders a generic star-rating + text review form; submits to `/api/submit-review` with `{ rating, review }` and shows only the returned `aiResponse` to the customer. Includes a text link to `/admin`.

## Exports / Public surface
- **default export `Home`** (page component): no props. Client state: `rating`, `review`, `loading`, `error`, `aiResponse`. `submitReview()` POSTs JSON to `/api/submit-review`, on success clears review and sets `aiResponse` from `data.data.aiResponse`.

## What it does NOT do
- No login, Google auth, or admin gate on `/`.
- No business name, logo, location picker, QR, or session/token in the URL or body.
- No per-business or per-location branding.

## Constraints and edge cases
- Unauthenticated public access.
- Errors surfaced from API `data.error` or generic network error.

## Last read
2026-05-04 — src/app/page.tsx
