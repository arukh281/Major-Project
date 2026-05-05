import {
  resolveActiveSubjectBucketIds,
  type SubjectBucketId,
} from "@/lib/bucketIntelligence";
import { prisma } from "@/lib/prisma";

export async function resolveAnalyticsBucketsForOwner(
  ownerId: string
): Promise<SubjectBucketId[]> {
  const row = await prisma.business.findFirst({
    where: { ownerId },
    select: { analyticsSubjectBucketIds: true },
  });
  return resolveActiveSubjectBucketIds(row?.analyticsSubjectBucketIds);
}
