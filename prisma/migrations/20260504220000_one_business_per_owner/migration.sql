-- Keep one Business row per owner (oldest by createdAt). Drops extras and related rows via FK cascades.
DELETE FROM "Business" b
WHERE b.id IN (
  SELECT id FROM (
    SELECT id,
      ROW_NUMBER() OVER (PARTITION BY "ownerId" ORDER BY "createdAt" ASC) AS rn
    FROM "Business"
  ) sub
  WHERE rn > 1
);

-- Unique index replaces the non-unique ownerId index for lookups.
DROP INDEX IF EXISTS "Business_ownerId_idx";

CREATE UNIQUE INDEX "Business_ownerId_key" ON "Business"("ownerId");
