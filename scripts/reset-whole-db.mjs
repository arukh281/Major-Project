#!/usr/bin/env node

import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { loadEnvFile } from "./lib/load-env-file.mjs";

function parseArgs(argv) {
  const args = {
    envFile: null,
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
    if (arg === "--use-current-env") {
      args.useCurrentEnv = true;
      continue;
    }
  }

  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

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
    const counts = await prisma.$transaction(async (tx) => {
      // Keep order explicit to avoid FK issues across optional relations.
      const review = await tx.review.deleteMany({});
      const externalReview = await tx.externalReview.deleteMany({});
      const googleLocation = await tx.googleLocation.deleteMany({});
      const googleAccountLink = await tx.googleAccountLink.deleteMany({});
      const reviewToken = await tx.reviewToken.deleteMany({});
      const businessLocation = await tx.businessLocation.deleteMany({});
      const business = await tx.business.deleteMany({});
      const user = await tx.user.deleteMany({});

      return {
        review: review.count,
        externalReview: externalReview.count,
        googleLocation: googleLocation.count,
        googleAccountLink: googleAccountLink.count,
        reviewToken: reviewToken.count,
        businessLocation: businessLocation.count,
        business: business.count,
        user: user.count,
      };
    });

    console.log("Whole DB reset complete (app tables emptied).");
    console.log(`User deleted: ${counts.user}`);
    console.log(`Business deleted: ${counts.business}`);
    console.log(`BusinessLocation deleted: ${counts.businessLocation}`);
    console.log(`ReviewToken deleted: ${counts.reviewToken}`);
    console.log(`Review deleted: ${counts.review}`);
    console.log(`GoogleAccountLink deleted: ${counts.googleAccountLink}`);
    console.log(`GoogleLocation deleted: ${counts.googleLocation}`);
    console.log(`ExternalReview deleted: ${counts.externalReview}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
