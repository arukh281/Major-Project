import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** External reviews whose Google location belongs to this owner. */
export function externalReviewsOwnedByWhere(
  ownerId: string
): Prisma.ExternalReviewWhereInput {
  return {
    location: {
      link: {
        ownerId,
      },
    },
  };
}

export async function getGoogleLocationIdsForOwner(
  ownerId: string
): Promise<string[]> {
  const links = await prisma.googleAccountLink.findMany({
    where: { ownerId },
    select: { id: true },
  });
  if (links.length === 0) return [];
  const linkIds = links.map((l) => l.id);
  const locs = await prisma.googleLocation.findMany({
    where: { linkId: { in: linkIds } },
    select: { id: true },
  });
  return locs.map((l) => l.id);
}

/** Customer-facing locations on the owner's Business profile (review form picks). */
export async function getBusinessLocationIdsForOwner(
  ownerId: string
): Promise<string[]> {
  const locs = await prisma.businessLocation.findMany({
    where: { business: { ownerId } },
    select: { id: true },
  });
  return locs.map((l) => l.id);
}

export function ownedInternalReviewsWhere(
  ownerId: string
): Prisma.ReviewWhereInput {
  return {
    business: {
      ownerId,
    },
  };
}
