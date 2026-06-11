import { env } from "../src/config/env.js";
import { prisma } from "../src/core/prisma/client.js";
import { hashPassword } from "../src/core/security/password.js";

const seedDemoUser = async () => {
  const email = env.DEMO_USER_EMAIL.toLowerCase();
  const existingUser = await prisma.user.findFirst({
    where: {
      email,
      deletedAt: null
    },
    select: {
      id: true
    }
  });

  if (existingUser) {
    console.log("Demo user seed skipped; active demo user already exists.");
    return;
  }

  const passwordHash = await hashPassword(env.DEMO_USER_PASSWORD);

  await prisma.user.create({
    data: {
      email,
      displayName: env.DEMO_USER_DISPLAY_NAME,
      passwordHash
    },
    select: {
      id: true
    }
  });

  console.log("Demo user seed completed.");
};

seedDemoUser()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown seed error";
    console.error(`Seed failed: ${message}`);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
