-- CreateEnum
CREATE TYPE "ExternalReviewPlatform" AS ENUM ('GOOGLE');

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "userReview" TEXT NOT NULL,
    "aiResponse" TEXT NOT NULL,
    "aiSummary" TEXT NOT NULL,
    "aiActions" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoogleAccountLink" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "googleAccountEmail" TEXT,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "tokenExpiry" TIMESTAMP(3) NOT NULL,
    "scope" TEXT NOT NULL,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoogleAccountLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoogleLocation" (
    "id" TEXT NOT NULL,
    "linkId" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "locationName" TEXT NOT NULL,
    "locationTitle" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoogleLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalReview" (
    "id" TEXT NOT NULL,
    "platform" "ExternalReviewPlatform" NOT NULL,
    "externalReviewId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "reviewerName" TEXT,
    "createTime" TIMESTAMP(3) NOT NULL,
    "updateTime" TIMESTAMP(3),
    "replyText" TEXT,
    "replyUpdateTime" TIMESTAMP(3),
    "sourceUrl" TEXT,
    "aiSummary" TEXT,
    "aiActions" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GoogleLocation_linkId_locationName_key" ON "GoogleLocation"("linkId", "locationName");

-- CreateIndex
CREATE INDEX "ExternalReview_platform_externalReviewId_idx" ON "ExternalReview"("platform", "externalReviewId");

-- CreateIndex
CREATE INDEX "ExternalReview_locationId_createTime_idx" ON "ExternalReview"("locationId", "createTime");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalReview_platform_externalReviewId_locationId_key" ON "ExternalReview"("platform", "externalReviewId", "locationId");

-- AddForeignKey
ALTER TABLE "GoogleLocation" ADD CONSTRAINT "GoogleLocation_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "GoogleAccountLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalReview" ADD CONSTRAINT "ExternalReview_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "GoogleLocation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
