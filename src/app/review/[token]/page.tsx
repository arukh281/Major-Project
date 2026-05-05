import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ReviewClient } from "./ReviewClient";

function isTokenActive(row: {
  revokedAt: Date | null;
  expiresAt: Date | null;
}): boolean {
  if (row.revokedAt) return false;
  if (row.expiresAt && row.expiresAt.getTime() <= Date.now()) return false;
  return true;
}

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!token) notFound();

  const row = await prisma.reviewToken.findUnique({
    where: { token },
    include: {
      business: {
        include: {
          locations: { orderBy: { sortOrder: "asc" } },
        },
      },
    },
  });

  if (!row || !isTokenActive(row)) {
    notFound();
  }

  return (
    <ReviewClient
      token={token}
      business={{
        displayName: row.business.displayName,
        logoUrl: row.business.logoUrl,
      }}
      locations={row.business.locations.map((l) => ({
        id: l.id,
        name: l.name,
      }))}
    />
  );
}
