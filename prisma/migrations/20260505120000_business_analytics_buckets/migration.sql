-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "businessDescription" TEXT,
ADD COLUMN     "analyticsSubjectBucketIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
