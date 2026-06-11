import { PrismaPg } from "@prisma/adapter-pg";

import { env } from "../../config/env.js";
import { PrismaClient } from "../../generated/prisma/client.js";

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
};

const adapter = new PrismaPg(env.DATABASE_URL);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter
  });

if (env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
