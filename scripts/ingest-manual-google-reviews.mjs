#!/usr/bin/env node
/**
 * Load DATABASE_URL (+ DIRECT_URL) from .env_supabase only, then upsert
 * ExternalReview rows from a JSON file. Does not touch Next.js or other env.
 *
 * Usage:
 *   npm run ingest:manual-google
 *   npm run ingest:manual-google -- --reviews ./my-reviews.json --owner-email you@x.com
 *
 * .env_supabase (gitignored via .env*) should contain at least:
 *   DATABASE_URL=postgresql://...   (Supabase pooler URL if you use one)
 *   DIRECT_URL=postgresql://...     (session/direct for Prisma)
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

import { loadEnvFile } from "./lib/load-env-file.mjs";
import {
  ensureGoogleLocationForOwner,
  resolveOwner,
} from "./lib/ensure-google-location-for-owner.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const args = {
    envFile: ".env_supabase",
    reviewsFile: path.join(__dirname, "reviews/manual-google-reviews.json"),
    ownerEmail: null,
    ownerId: null,
    locationTitle: "Google reviews (manual)",
    locationName: "accounts/manual-import/locations/primary",
    accountName: "accounts/manual-import",
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];

    if (arg === "--env-file" && next) {
      args.envFile = next;
      i += 1;
      continue;
    }
    if (arg === "--reviews" && next) {
      args.reviewsFile = path.resolve(process.cwd(), next);
      i += 1;
      continue;
    }
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
    if (arg === "--location-title" && next) {
      args.locationTitle = next;
      i += 1;
      continue;
    }
  }

  return args;
}

function parseIsoDate(value, label, index) {
  if (value == null || value === "") return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid ${label} at index ${index}: ${value}`);
  }
  return d;
}

function normalizeReviewEntry(raw, index) {
  if (!raw || typeof raw !== "object") {
    throw new Error(`Review at index ${index} must be an object`);
  }
  const externalReviewId = raw.externalReviewId;
  if (typeof externalReviewId !== "string" || !externalReviewId.trim()) {
    throw new Error(
      `Review at index ${index}: "externalReviewId" is required (string)`
    );
  }
  const rating = Number(raw.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new Error(
      `Review at index ${index}: "rating" must be an integer 1–5`
    );
  }

  const comment =
    raw.comment === undefined || raw.comment === null
      ? null
      : String(raw.comment);
  const reviewerName =
    raw.reviewerName === undefined || raw.reviewerName === null
      ? null
      : String(raw.reviewerName);
  const replyText =
    raw.replyText === undefined || raw.replyText === null
      ? null
      : String(raw.replyText);
  const sourceUrl =
    raw.sourceUrl === undefined || raw.sourceUrl === null
      ? null
      : String(raw.sourceUrl);

  const createTime =
    parseIsoDate(raw.createTime, "createTime", index) ??
    new Date(Date.now() - index * 60 * 60 * 1000);
  const updateTime =
    parseIsoDate(raw.updateTime, "updateTime", index) ?? createTime;
  const replyUpdateTime = parseIsoDate(
    raw.replyUpdateTime,
    "replyUpdateTime",
    index
  );

  return {
    externalReviewId: externalReviewId.trim(),
    rating,
    comment,
    reviewerName,
    createTime,
    updateTime,
    replyText,
    replyUpdateTime: replyText ? replyUpdateTime ?? updateTime : null,
    sourceUrl,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const envPath = path.resolve(process.cwd(), args.envFile);
  loadEnvFile(envPath);

  if (!process.env.DATABASE_URL) {
    throw new Error(
      `${args.envFile} must define DATABASE_URL (and DIRECT_URL for Prisma)`
    );
  }
  if (!process.env.DIRECT_URL) {
    throw new Error(
      `${args.envFile} must define DIRECT_URL (required by prisma/schema.prisma)`
    );
  }

  if (!fs.existsSync(args.reviewsFile)) {
    throw new Error(
      `Reviews file missing: ${args.reviewsFile}\n` +
        `Copy scripts/reviews/manual-google-reviews.example.json to scripts/reviews/manual-google-reviews.json and edit.`
    );
  }

  const parsed = JSON.parse(fs.readFileSync(args.reviewsFile, "utf8"));
  if (!Array.isArray(parsed)) {
    throw new Error("Reviews JSON must be an array of objects");
  }

  const prisma = new PrismaClient();
  try {
    const owner = await resolveOwner(prisma, {
      ownerId: args.ownerId,
      ownerEmail: args.ownerEmail,
    });
    if (!owner) {
      throw new Error(
        "No owner user found. Sign in once against this same database (or pass --owner-email / --owner-id)."
      );
    }

    const { location } = await ensureGoogleLocationForOwner(prisma, {
      owner,
      locationTitle: args.locationTitle,
      locationName: args.locationName,
      accountName: args.accountName,
    });

    let upserts = 0;
    const seen = new Set();

    for (let i = 0; i < parsed.length; i += 1) {
      const row = normalizeReviewEntry(parsed[i], i);
      if (seen.has(row.externalReviewId)) {
        throw new Error(
          `Duplicate externalReviewId in file: ${row.externalReviewId}`
        );
      }
      seen.add(row.externalReviewId);

      await prisma.externalReview.upsert({
        where: {
          platform_externalReviewId_locationId: {
            platform: "GOOGLE",
            externalReviewId: row.externalReviewId,
            locationId: location.id,
          },
        },
        create: {
          platform: "GOOGLE",
          externalReviewId: row.externalReviewId,
          locationId: location.id,
          rating: row.rating,
          comment: row.comment,
          reviewerName: row.reviewerName,
          createTime: row.createTime,
          updateTime: row.updateTime,
          replyText: row.replyText,
          replyUpdateTime: row.replyUpdateTime,
          sourceUrl: row.sourceUrl,
          aiSummary: null,
          aiActions: null,
        },
        update: {
          rating: row.rating,
          comment: row.comment,
          reviewerName: row.reviewerName,
          createTime: row.createTime,
          updateTime: row.updateTime,
          replyText: row.replyText,
          replyUpdateTime: row.replyUpdateTime,
          sourceUrl: row.sourceUrl,
        },
      });
      upserts += 1;
    }

    console.log("Manual Google-style reviews ingested.");
    console.log(`Env file: ${envPath}`);
    console.log(`Owner: ${owner.email ?? owner.id}`);
    console.log(`Location: ${location.locationTitle} (${location.id})`);
    console.log(`Rows upserted: ${upserts}`);
    console.log("");
    console.log("Open /admin → Google review tab; use Generate AI if needed.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
