import { NextResponse } from "next/server";
import { BUCKET_DEFINITIONS } from "@/lib/bucketIntelligence";

/**
 * Public catalog of analytics subject buckets (IDs match persisted `analyticsSubjectBucketIds`).
 */
export async function GET() {
  return NextResponse.json({
    buckets: BUCKET_DEFINITIONS.map((b) => ({
      id: b.id,
      label: b.label,
      description: b.description,
    })),
  });
}
