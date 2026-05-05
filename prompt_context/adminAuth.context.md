# Context: src/lib/adminAuth.ts

## What it does
`requireAdminSecret(req)` returns `null` if `x-admin-secret` header matches `process.env.ADMIN_SECRET`; otherwise JSON 401/500. Used by admin and Google sync API routes.

## Exports / Public surface
- **`requireAdminSecret(NextRequest): NextResponse | null`**

## What it does NOT do
- No OAuth, JWT, sessions, or per-user admin roles.
- No integration with Google identity for authorization.

## Constraints and edge cases
- Missing `ADMIN_SECRET` env → 500 "Server misconfigured".

## Last read
2026-05-04 — src/lib/adminAuth.ts
