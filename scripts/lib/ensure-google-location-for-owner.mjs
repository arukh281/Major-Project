/**
 * Ensures a GoogleAccountLink + GoogleLocation exist for manual / mock data,
 * matching the shape expected by GBP sync and ExternalReview FKs.
 */
export async function ensureGoogleLocationForOwner(prisma, {
  owner,
  locationTitle = "Imported location",
  locationName = "accounts/manual-import/locations/primary",
  accountName = "accounts/manual-import",
}) {
  let link = await prisma.googleAccountLink.findFirst({
    where: { ownerId: owner.id },
  });

  if (!link) {
    link = await prisma.googleAccountLink.create({
      data: {
        ownerId: owner.id,
        googleAccountEmail: owner.email ?? "manual-import@local",
        accessToken: "manual_import_placeholder_access",
        refreshToken: "manual_import_placeholder_refresh",
        tokenExpiry: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365),
        scope: "https://www.googleapis.com/auth/business.manage",
      },
    });
  }

  const location = await prisma.googleLocation.upsert({
    where: {
      linkId_locationName: {
        linkId: link.id,
        locationName,
      },
    },
    create: {
      linkId: link.id,
      accountName,
      locationName,
      locationTitle,
    },
    update: {
      accountName,
      locationTitle,
    },
  });

  return { link, location };
}

export async function resolveOwner(prisma, { ownerId, ownerEmail }) {
  if (ownerId) {
    return prisma.user.findUnique({ where: { id: ownerId } });
  }
  if (ownerEmail) {
    return prisma.user.findFirst({ where: { email: ownerEmail } });
  }
  return prisma.user.findFirst({ orderBy: { createdAt: "desc" } });
}
