import { randomBytes } from "crypto";

/** URL-safe opaque token for /review/[token] */
export function generateReviewTokenString(): string {
  return randomBytes(24).toString("base64url");
}
