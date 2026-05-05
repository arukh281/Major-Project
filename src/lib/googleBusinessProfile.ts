import { prisma } from "@/lib/prisma";
import { getValidAccessToken } from "./googleAuth";

const GBP_BASE_URL = "https://mybusiness.googleapis.com/v4";

type GoogleAccount = {
  name: string;
  accountName?: string;
};

type GoogleLocationApi = {
  name: string;
  title?: string;
};

type GoogleReviewApi = {
  name?: string;
  reviewId?: string;
  reviewer?: {
    displayName?: string;
  };
  starRating?: string | number;
  comment?: string;
  createTime?: string;
  updateTime?: string;
  reviewReply?: {
    comment?: string;
    updateTime?: string;
  };
};

export async function listAccounts(accessToken: string): Promise<GoogleAccount[]> {
  const res = await fetch(`${GBP_BASE_URL}/accounts`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("Failed to list Google accounts", res.status, text);
    throw new Error("Failed to list Google accounts");
  }

  const data = (await res.json()) as { accounts?: GoogleAccount[] };
  return data.accounts ?? [];
}

export async function listLocations(
  accessToken: string,
  accountName: string
): Promise<GoogleLocationApi[]> {
  const res = await fetch(
    `${GBP_BASE_URL}/${encodeURIComponent(accountName)}/locations`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!res.ok) {
    const text = await res.text();
    console.error(
      "Failed to list Google locations",
      accountName,
      res.status,
      text
    );
    throw new Error("Failed to list Google locations");
  }

  const data = (await res.json()) as { locations?: GoogleLocationApi[] };
  return data.locations ?? [];
}

export async function listReviews(
  accessToken: string,
  locationName: string,
  pageSize = 50,
  pageToken?: string
): Promise<{ reviews: GoogleReviewApi[]; nextPageToken?: string }> {
  const url = new URL(
    `${GBP_BASE_URL}/${encodeURIComponent(locationName)}/reviews`
  );
  url.searchParams.set("pageSize", String(pageSize));
  if (pageToken) url.searchParams.set("pageToken", pageToken);

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(
      "Failed to list Google reviews",
      locationName,
      res.status,
      text
    );
    throw new Error("Failed to list Google reviews");
  }

  const data = (await res.json()) as {
    reviews?: GoogleReviewApi[];
    nextPageToken?: string;
  };

  return {
    reviews: data.reviews ?? [],
    nextPageToken: data.nextPageToken,
  };
}

export async function syncLocationsForLink(linkId: string) {
  const accessToken = await getValidAccessToken(linkId);

  const accounts = await listAccounts(accessToken);

  let locationsSynced = 0;

  for (const account of accounts) {
    const accountName = account.name;
    if (!accountName) continue;

    const locations = await listLocations(accessToken, accountName);

    for (const loc of locations) {
      if (!loc.name) continue;

      await prisma.googleLocation.upsert({
        where: {
          linkId_locationName: {
            linkId,
            locationName: loc.name,
          },
        },
        create: {
          linkId,
          accountName,
          locationName: loc.name,
          locationTitle: loc.title ?? loc.name,
        },
        update: {
          accountName,
          locationTitle: loc.title ?? loc.name,
        },
      });

      locationsSynced += 1;
    }
  }

  return { locationsSynced };
}

export async function syncReviewsForLink(
  linkId: string,
  options?: { fromDate?: Date }
) {
  const accessToken = await getValidAccessToken(linkId);

  const locations = await prisma.googleLocation.findMany({
    where: { linkId },
  });

  let reviewsUpserted = 0;

  for (const loc of locations) {
    let pageToken: string | undefined;

    do {
      const { reviews, nextPageToken } = await listReviews(
        accessToken,
        loc.locationName,
        50,
        pageToken
      );

      for (const r of reviews) {
        const externalId =
          r.reviewId ??
          r.name?.split("/").pop() ??
          `${loc.id}-${r.createTime ?? ""}`;

        const rating =
          typeof r.starRating === "string"
            ? parseInt(r.starRating, 10)
            : r.starRating ?? 0;

        if (!r.createTime) {
          // Skip malformed reviews without timestamps
          continue;
        }
        const createTime = new Date(r.createTime);
        if (Number.isNaN(createTime.getTime())) {
          continue;
        }
        if (options?.fromDate && createTime < options.fromDate) {
          continue;
        }

        await prisma.externalReview.upsert({
          where: {
            platform_externalReviewId_locationId: {
              platform: "GOOGLE",
              externalReviewId: externalId,
              locationId: loc.id,
            },
          },
          create: {
            platform: "GOOGLE",
            externalReviewId: externalId,
            locationId: loc.id,
            rating,
            comment: r.comment ?? null,
            reviewerName: r.reviewer?.displayName ?? null,
            createTime,
            updateTime: r.updateTime ? new Date(r.updateTime) : null,
            replyText: r.reviewReply?.comment ?? null,
            replyUpdateTime: r.reviewReply?.updateTime
              ? new Date(r.reviewReply.updateTime)
              : null,
            sourceUrl: null,
          },
          update: {
            rating,
            comment: r.comment ?? null,
            reviewerName: r.reviewer?.displayName ?? null,
            createTime,
            updateTime: r.updateTime ? new Date(r.updateTime) : null,
            replyText: r.reviewReply?.comment ?? null,
            replyUpdateTime: r.reviewReply?.updateTime
              ? new Date(r.reviewReply.updateTime)
              : null,
          },
        });

        reviewsUpserted += 1;
      }

      pageToken = nextPageToken;
    } while (pageToken);
  }

  return { reviewsUpserted };
}

