import type { NextRequest } from "next/server";

/**
 * Use Secure cookies only when the request is HTTPS. Production builds
 * (`next start`) on http://localhost still see NODE_ENV=production; marking
 * cookies Secure would make the browser drop them on HTTP and break OAuth.
 */
export function shouldUseSecureCookie(req: NextRequest): boolean {
  if (process.env.NODE_ENV !== "production") return false;
  return req.nextUrl.protocol === "https:";
}
