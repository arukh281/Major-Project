-- Legacy GoogleAccountLink rows used string userId (e.g. "default") with no User row.
-- Remove them so ownerId can reference User. Owners must reconnect Google Business Profile.

DELETE FROM "ExternalReview";
DELETE FROM "GoogleLocation";
DELETE FROM "GoogleAccountLink";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "googleSub" TEXT NOT NULL,
    "email" TEXT,
    "name" TEXT,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Business" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "logoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Business_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessLocation" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_googleSub_key" ON "User"("googleSub");

-- CreateIndex
CREATE INDEX "Business_ownerId_idx" ON "Business"("ownerId");

-- CreateIndex
CREATE INDEX "BusinessLocation_businessId_idx" ON "BusinessLocation"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewToken_token_key" ON "ReviewToken"("token");

-- CreateIndex
CREATE INDEX "ReviewToken_businessId_idx" ON "ReviewToken"("businessId");

-- AlterTable Review
ALTER TABLE "Review" ADD COLUMN     "businessId" TEXT,
ADD COLUMN "businessLocationId" TEXT;

-- AlterTable GoogleAccountLink
ALTER TABLE "GoogleAccountLink" DROP COLUMN "userId",
ADD COLUMN     "ownerId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "GoogleAccountLink_ownerId_idx" ON "GoogleAccountLink"("ownerId");

-- CreateIndex
CREATE INDEX "Review_businessId_idx" ON "Review"("businessId");

-- CreateIndex
CREATE INDEX "Review_businessLocationId_idx" ON "Review"("businessLocationId");

-- AddForeignKey
ALTER TABLE "Business" ADD CONSTRAINT "Business_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessLocation" ADD CONSTRAINT "BusinessLocation_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewToken" ADD CONSTRAINT "ReviewToken_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_businessLocationId_fkey" FOREIGN KEY ("businessLocationId") REFERENCES "BusinessLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoogleAccountLink" ADD CONSTRAINT "GoogleAccountLink_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
