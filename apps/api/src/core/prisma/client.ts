import { PrismaPg } from "@prisma/adapter-pg";

import { env } from "../../config/env.js";
import { PrismaClient } from "../../generated/prisma/client.js";

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
};
let prismaClient: PrismaClient | undefined;

const createPrismaClient = () =>
  new PrismaClient({
    adapter: new PrismaPg(env.DATABASE_URL)
  });

const getPrismaClient = () => {
  const client = globalForPrisma.prisma ?? prismaClient ?? createPrismaClient();

  prismaClient = client;

  if (env.NODE_ENV !== "production") {
    globalForPrisma.prisma = client;
  }

  return client;
};

export const isPrismaClientInitialized = () => Boolean(prismaClient);

export const prisma = new Proxy({} as PrismaClient, {
  get: (_target, property) => {
    const client = getPrismaClient();
    const value = Reflect.get(client, property, client) as unknown;

    return typeof value === "function" ? value.bind(client) : value;
  }
});
