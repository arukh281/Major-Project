#!/usr/bin/env node

import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { loadEnvFile } from "./lib/load-env-file.mjs";

function parseArgs(argv) {
  const args = {
    envFile: null,
    useCurrentEnv: false,
    limit: 50,
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
    if (arg === "--limit" && next) {
      const parsed = Number.parseInt(next, 10);
      if (Number.isInteger(parsed) && parsed > 0) {
        args.limit = parsed;
      }
      i += 1;
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
    const owners = await prisma.user.findMany({
      where: {
        email: {
          not: null,
        },
      },
      select: {
        email: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: args.limit,
    });

    for (const owner of owners) {
      if (owner.email) {
        console.log(owner.email);
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
