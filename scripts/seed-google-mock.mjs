#!/usr/bin/env node

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function parseArgs(argv) {
  const args = {
    ownerEmail: null,
    ownerId: null,
    count: 12,
    locationTitle: "Mock Downtown Branch",
    locationName: "accounts/mock-account/locations/mock-downtown",
    accountName: "accounts/mock-account",
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];

    if (arg === "--owner-email" && next) {
      args.ownerEmail = next;
      i += 1;
      continue;
    }
    if (arg === "--owner-id" && next) {
      args.ownerId = next;
      i += 1;
      continue;
    }
    if (arg === "--count" && next) {
      const parsed = Number.parseInt(next, 10);
      if (Number.isFinite(parsed) && parsed > 0) args.count = parsed;
      i += 1;
      continue;
    }
    if (arg === "--location-title" && next) {
      args.locationTitle = next;
      i += 1;
      continue;
    }
  }

  return args;
}

function pickComment(index) {
  const samples = [
    "Great service and quick turnaround. Staff was polite and helpful.",
    "The wait time was longer than expected, but the final result was good.",
    "Clean place, friendly team, and transparent pricing.",
    "I had an issue with billing and support resolved it within a day.",
    "Not satisfied with communication. Had to call multiple times for updates.",
    "Excellent experience. Will definitely return and recommend to friends.",
    "Average overall. Nothing bad, but nothing exceptional either.",
    "Very professional team. The quality was consistent and reliable.",
    "The product was fine but checkout and pickup process felt slow.",
    "Fantastic customer care. They followed up after the visit as well.",
    // Stock, items & order accuracy
    "Ordered three items; two were right but one size was wrong. They fixed it the same day.",
    "My bag was missing a paid add-on. Staff apologized and refunded without hassle.",
    "App said in stock, but at pickup they said it was backordered. Wasted a trip.",
    "Order was accurate, picked and packed well—no mix-ups on the receipt either.",
    "Second time the wrong item was in my bag. Great store otherwise, but double-check packing.",
    // Cleanliness & ambience
    "Dining area was spotless and the music was at a nice level. Comfortable to stay a while.",
    "Tables were sticky and the floor near the counter needed a mop. Food was still fine.",
    "Calm lighting and uncluttered layout. Very pleasant for a quick lunch with a friend.",
    "Smell near the back was off-putting; food was good but the space needs a deep clean.",
    // Product & food quality
    "Food was hot, well seasoned, and portions felt fair for what we paid.",
    "Main was overcooked and sides were cold. Disappointing given the online photos.",
    "You can tell the ingredients are fresh—tastes better than the chain down the road.",
    "Dessert was the highlight: moist cake, not too sweet, exactly as described.",
    "Same dish I loved last month tasted bland and underseasoned this time—quality slipped.",
    // Delivery & packaging
    "Delivery arrived on time; food was still warm and the bag was sealed properly.",
    "Box arrived dented and one container had leaked. Driver was polite, but packaging failed.",
    "Minimal, eco-friendly packaging; nothing tipped or spilled in transit.",
    // Pricing & trust
    "Prices matched the menu and the receipt had no surprise fees. Felt fair.",
    "Charged more than the online menu showed; had to ask for a manager to sort it out.",
    "Loyalty discount applied as promised on a big order. I trust them for repeat business.",
  ];

  return samples[index % samples.length];
}

function pickRating(index) {
  const ratings = [
    5, 4, 5, 4, 2, 5, 3, 4, 3, 5, 1, 2,
    4, 5, 2, 5, 3, 4, 3, 5, 4, 2, 5, 4, 3, 5, 2, 4, 3, 5,
  ];
  return ratings[index % ratings.length];
}

/**
 * Simulates varied GBP public replies. For mock data we always return text so
 * the admin list looks consistent; real Google sync still uses null when
 * there is no reply on the profile.
 */
function pickPublicReply(comment, rating, index) {
  const t = (comment || "").toLowerCase();

  if (rating >= 5) {
    const lines = [
      "Thank you—we're thrilled you had a great experience!",
      "We really appreciate you taking the time to share this!",
      "Thanks so much; feedback like yours keeps our team motivated.",
    ];
    return lines[index % lines.length];
  }
  if (rating === 4) {
    const lines = [
      "Thanks for visiting—we're glad things went well overall.",
      "We appreciate the feedback and hope to see you again soon.",
      "Thank you for the review; we're happy we could help.",
    ];
    return lines[index % lines.length];
  }
  if (rating === 3) {
    const lines = [
      "Thanks for sharing this—we're reading every detail and working to improve.",
      "We appreciate the honest feedback and will use it to tune our service.",
      "Thank you; we're sorry we didn't fully wow you and we'll keep pushing.",
    ];
    return lines[index % lines.length];
  }

  const lowStarFallback = [
    "We're sorry this missed the mark. We've shared your notes with the team and take this seriously.",
    "Thank you for telling us—we're following up internally and want every visit to feel easy.",
    "We apologize for the frustration. Please ask for a manager on your next visit so we can make this right.",
    "Thanks for the candid feedback; we're reviewing what happened and how we can improve.",
    "We're sorry you had this experience. Your review helps us train and fix weak spots.",
    "We hear you and apologize. We're addressing this with staff and appreciate you reaching out.",
  ];

  if (/\b(bag|pack|packed|packing|wrong item|mix-up|missing add-on|add-on|order accuracy)\b/.test(t)) {
    return "We're sorry your order wasn't packed correctly—that isn't okay with us. We're tightening our pick-and-pack checks and appreciate you flagging it.";
  }
  if (/\b(billing|charged|receipt|refund|fee|price)\b/.test(t)) {
    return "We're sorry for the billing confusion. We've looped in our front desk to ensure pricing matches what you see online.";
  }
  if (/\b(wait|slow|longer than|queue|line)\b/.test(t)) {
    return "Thanks for your patience—we're staffing better at peak times so waits stay shorter.";
  }
  if (/\b(sticky|dirty|smell|clean|mop|spotless|floor)\b/.test(t)) {
    return "Thank you for the heads-up on the space—we've stepped up our cleaning rotation for dining areas.";
  }
  if (/\b(food|taste|cooked|cold|hot|menu|dish|portion)\b/.test(t)) {
    return "We're sorry the food didn't match what you expected; we're talking with the kitchen about consistency.";
  }
  if (/\b(delivery|driver|box|leaked|transit|sealed)\b/.test(t)) {
    return "We're sorry packaging or delivery let you down—we're reviewing how we pack and hand off orders.";
  }
  if (/\b(communication|call|update|response)\b/.test(t)) {
    return "We're sorry we weren't easier to reach. We're tightening how we keep customers updated.";
  }

  return lowStarFallback[index % lowStarFallback.length];
}

async function resolveOwner(ownerId, ownerEmail) {
  if (ownerId) {
    return prisma.user.findUnique({ where: { id: ownerId } });
  }

  if (ownerEmail) {
    return prisma.user.findFirst({ where: { email: ownerEmail } });
  }

  return prisma.user.findFirst({ orderBy: { createdAt: "desc" } });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const owner = await resolveOwner(args.ownerId, args.ownerEmail);

  if (!owner) {
    throw new Error(
      "No owner user found. Sign in once to create a user, then rerun this seed."
    );
  }

  let link = await prisma.googleAccountLink.findFirst({
    where: { ownerId: owner.id },
  });

  if (!link) {
    link = await prisma.googleAccountLink.create({
      data: {
        ownerId: owner.id,
        googleAccountEmail: owner.email ?? "mock-owner@example.com",
        accessToken: "mock_encrypted_access_token",
        refreshToken: "mock_encrypted_refresh_token",
        tokenExpiry: new Date(Date.now() + 1000 * 60 * 60 * 24 * 90),
        scope: "https://www.googleapis.com/auth/business.manage",
      },
    });
  } else {
    link = await prisma.googleAccountLink.update({
      where: { id: link.id },
      data: {
        googleAccountEmail: link.googleAccountEmail ?? owner.email,
        tokenExpiry: new Date(Date.now() + 1000 * 60 * 60 * 24 * 90),
      },
    });
  }

  const location = await prisma.googleLocation.upsert({
    where: {
      linkId_locationName: {
        linkId: link.id,
        locationName: args.locationName,
      },
    },
    create: {
      linkId: link.id,
      accountName: args.accountName,
      locationName: args.locationName,
      locationTitle: args.locationTitle,
    },
    update: {
      accountName: args.accountName,
      locationTitle: args.locationTitle,
    },
  });

  let upserts = 0;
  const now = Date.now();

  for (let i = 0; i < args.count; i += 1) {
    const ageDays = i * 2;
    const createdAt = new Date(now - ageDays * 24 * 60 * 60 * 1000);
    const updatedAt = new Date(createdAt.getTime() + 2 * 60 * 60 * 1000);
    const rating = pickRating(i);
    const comment = pickComment(i);
    const publicReply = pickPublicReply(comment, rating, i);

    const id = `mock-google-review-${i + 1}`;
    await prisma.externalReview.upsert({
      where: {
        platform_externalReviewId_locationId: {
          platform: "GOOGLE",
          externalReviewId: id,
          locationId: location.id,
        },
      },
      create: {
        platform: "GOOGLE",
        externalReviewId: id,
        locationId: location.id,
        rating,
        comment,
        reviewerName: `Mock User ${i + 1}`,
        createTime: createdAt,
        updateTime: updatedAt,
        replyText: publicReply,
        replyUpdateTime: publicReply ? updatedAt : null,
        sourceUrl: "https://maps.google.com/?cid=mock",
        aiSummary: null,
        aiActions: null,
      },
      update: {
        rating,
        comment,
        reviewerName: `Mock User ${i + 1}`,
        createTime: createdAt,
        updateTime: updatedAt,
        replyText: publicReply,
        replyUpdateTime: publicReply ? updatedAt : null,
      },
    });

    upserts += 1;
  }

  const mockRows = await prisma.externalReview.findMany({
    where: { externalReviewId: { startsWith: "mock-google-review-" } },
  });
  for (const row of mockRows) {
    const n = Number.parseInt(
      String(row.externalReviewId).replace("mock-google-review-", ""),
      10
    );
    const idx = Number.isFinite(n) && n > 0 ? n - 1 : 0;
    const comment = row.comment?.trim() || pickComment(idx);
    const publicReply = pickPublicReply(comment, row.rating, idx);
    const ts = row.updateTime ?? new Date();
    await prisma.externalReview.update({
      where: { id: row.id },
      data: {
        replyText: publicReply,
        replyUpdateTime: publicReply ? ts : null,
      },
    });
  }
  console.log(
    `Refreshed public reply on ${mockRows.length} mock Google review row(s) (all IDs).`
  );

  console.log("Mock Google reviews seeded.");
  console.log(`Owner: ${owner.email ?? owner.id}`);
  console.log(`Location: ${location.locationTitle}`);
  console.log(`Reviews upserted: ${upserts}`);
  console.log("");
  console.log("Next steps:");
  console.log("1) Open /admin");
  console.log("2) Go to Google review tab");
  console.log("3) Click 'Generate AI for missing' to populate AI fields");
}

main()
  .catch((err) => {
    console.error("Failed to seed mock Google reviews.");
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
