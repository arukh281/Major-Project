#!/usr/bin/env node

import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { loadEnvFile } from "./lib/load-env-file.mjs";

function parseArgs(argv) {
  const args = {
    envFile: null,
    email: null,
    fullReset: false,
    useCurrentEnv: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];

    if (arg === "--env-file" && next) {
      args.envFile = next;
      i += 1;
      continue;
    }
    if (arg === "--email" && next) {
      args.email = next.trim().toLowerCase();
      i += 1;
      continue;
    }
    if (arg === "--full-reset") {
      args.fullReset = true;
      continue;
    }
    if (arg === "--use-current-env") {
      args.useCurrentEnv = true;
      continue;
    }
  }

  return args;
}

async function findUserByEmail(tx, email) {
  const rows = await tx.$queryRaw`
    SELECT "id", "email"
    FROM "User"
    WHERE lower("email") = lower(${email})
    LIMIT 1
  `;
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.email) {
    console.error("Missing --email");
    process.exit(1);
  }

  if (args.envFile) {
    loadEnvFile(path.resolve(process.cwd(), args.envFile));
  } else if (!args.useCurrentEnv) {
    console.error("Provide --env-file <path> or --use-current-env");
    process.exit(1);
  }

  if (!process.env.DATABASE_URL || !process.env.DIRECT_URL) {
    console.error("DATABASE_URL and DIRECT_URL must be available");
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const result = await prisma.$transaction(async (tx) => {
      const user = await findUserByEmail(tx, args.email);
      if (!user) {
        return { user: null };
      }

      const businesses = await tx.business.findMany({
        where: { ownerId: user.id },
        select: { id: true },
      });
      const businessIds = businesses.map((b) => b.id);

      let reviewsDeleted = 0;
      if (businessIds.length > 0) {
        const reviewDelete = await tx.review.deleteMany({
          where: { businessId: { in: businessIds } },
        });
        reviewsDeleted = reviewDelete.count;
      }

      // Clear Google-linked data owned by this user (locations + external reviews
      // are removed via cascade from GoogleAccountLink).
      const externalReviewsCount = await tx.externalReview.count({
        where: {
          location: {
            link: {
              ownerId: user.id,
            },
          },
        },
      });
      const googleLinksDelete = await tx.googleAccountLink.deleteMany({
        where: { ownerId: user.id },
      });

      const businessDelete = await tx.business.deleteMany({
        where: { ownerId: user.id },
      });

      let userDeleted = 0;
      if (args.fullReset) {
        await tx.user.delete({ where: { id: user.id } });
        userDeleted = 1;
      }

      return {
        user: { id: user.id, email: user.email },
        businessesDeleted: businessDelete.count,
        reviewsDeleted,
        googleLinksDeleted: googleLinksDelete.count,
        externalReviewsDeleted: externalReviewsCount,
        userDeleted,
        mode: args.fullReset ? "full" : "business-only",
      };
    });

    if (!result.user) {
      console.error(`Owner not found for email: ${args.email}`);
      process.exit(2);
    }

    console.log(`Reset complete (${result.mode}).`);
    console.log(`Owner: ${result.user.email ?? result.user.id}`);
    console.log(`Businesses deleted: ${result.businessesDeleted}`);
    console.log(`Internal reviews deleted: ${result.reviewsDeleted}`);
    console.log(`Google links deleted: ${result.googleLinksDeleted}`);
    console.log(`External reviews deleted: ${result.externalReviewsDeleted}`);
    if (result.userDeleted === 1) {
      console.log("User row deleted: yes");
    } else {
      console.log("User row deleted: no");
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
