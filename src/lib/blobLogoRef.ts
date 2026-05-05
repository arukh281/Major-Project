/** Stored in DB when the Vercel Blob store is private-only; served via app proxy routes. */
export const BLOB_LOGO_PRIVATE_PREFIX = "blobp:" as const;

export function isPrivateBlobLogoRef(
  logoUrl: string | null | undefined
): boolean {
  return Boolean(logoUrl?.startsWith(BLOB_LOGO_PRIVATE_PREFIX));
}

export function privateBlobPathname(logoUrl: string): string | null {
  if (!isPrivateBlobLogoRef(logoUrl)) return null;
  return logoUrl.slice(BLOB_LOGO_PRIVATE_PREFIX.length);
}

export function makePrivateBlobLogoRef(pathname: string): string {
  return `${BLOB_LOGO_PRIVATE_PREFIX}${pathname}`;
}

/** Relative URL safe for <img src> on the public review page. */
export function reviewLogoImgSrc(
  logoUrl: string | null,
  reviewToken: string
): string | null {
  if (!logoUrl) return null;
  if (isPrivateBlobLogoRef(logoUrl)) {
    return `/api/public/review/${encodeURIComponent(reviewToken)}/logo-blob`;
  }
  return logoUrl;
}

/** Relative URL for owner UI (session cookie sent). */
export function ownerLogoImgSrc(logoUrl: string | null): string | null {
  if (!logoUrl) return null;
  if (isPrivateBlobLogoRef(logoUrl)) {
    return `/api/owner/logo-blob?ref=${encodeURIComponent(logoUrl)}`;
  }
  return logoUrl;
}
