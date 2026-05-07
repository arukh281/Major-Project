#!/usr/bin/env node

import { PrismaClient } from "@prisma/client";
import path from "node:path";
import { loadEnvFile } from "./lib/load-env-file.mjs";

function parseArgs(argv) {
  const args = {
    envFile: null,
    email: null,
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
    if (arg === "--use-current-env") {
      args.useCurrentEnv = true;
      continue;
    }
  }

  return args;
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
    const owner = await prisma.user.findFirst({
      where: { email: args.email },
      select: { id: true, email: true },
    });

    if (!owner) {
      console.error(`Owner not found for email: ${args.email}`);
      process.exit(2);
    }

    console.log(`Owner found: ${owner.email ?? owner.id}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
