import { NextResponse } from "next/server";

/**
 * Anonymous review submission without a business token is no longer supported.
 * Customers must use the shareable link: /review/[token]
 */
export async function POST() {
  return NextResponse.json(
    {
      error:
        "This endpoint is disabled. Please submit your review using the link provided by the business.",
    },
    { status: 410 }
  );
}
