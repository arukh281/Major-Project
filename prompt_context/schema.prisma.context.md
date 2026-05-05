# Context: prisma/schema.prisma

## What it does
Defines PostgreSQL models: in-app **`Review`** (rating, userReview, three AI string fields, timestamps); **`GoogleAccountLink`** (tokens, `userId`, email optional); **`GoogleLocation`** (linked to GBP sync); **`ExternalReview`** (Google-imported reviews tied to `GoogleLocation`). No multi-tenant Business entity.

## Exports / Public surface
- **Prisma models**: `Review`, `GoogleAccountLink`, `GoogleLocation`, `ExternalReview`, enum `ExternalReviewPlatform` (GOOGLE only).

## What it does NOT do
- No `Business`, `Location` (app-owned), logo URL, QR slug, review session, or link between `Review` and a business/location/admin user.
- `Review` has no foreign keys to Google models or any tenant.

## Constraints and edge cases
- `Review` fields `aiResponse`, `aiSummary`, `aiActions` are required strings at create time (enforced by app, not nullable in schema).
- `GoogleLocation` uniqueness `(linkId, locationName)`.

## Last read
2026-05-04 — prisma/schema.prisma
