-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "analyticsBucketComputeStatus" TEXT NOT NULL DEFAULT 'idle',
ADD COLUMN     "analyticsBucketLastComputedAt" TIMESTAMP(3),
ADD COLUMN     "analyticsBucketMode" TEXT NOT NULL DEFAULT 'manual',
ADD COLUMN     "analyticsBucketScheduleCron" TEXT;
