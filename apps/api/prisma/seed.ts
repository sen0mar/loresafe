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
    return existingUser;
  }

  const passwordHash = await hashPassword(env.DEMO_USER_PASSWORD);

  const demoUser = await prisma.user.create({
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
  return demoUser;
};

const seedDemoClub = async (ownerId: string) => {
  const demoClub = await prisma.club.upsert({
    where: {
      slug: "the-first-law-book-club"
    },
    update: {
      title: "The First Law Book Club",
      description: "Abercrombie fans discussing the books one chapter at a time.",
      category: "Fantasy",
      visibility: "PUBLIC"
    },
    create: {
      title: "The First Law Book Club",
      slug: "the-first-law-book-club",
      description: "Abercrombie fans discussing the books one chapter at a time.",
      category: "Fantasy",
      visibility: "PUBLIC"
    },
    select: {
      id: true
    }
  });

  await prisma.clubMembership.upsert({
    where: {
      userId_clubId: {
        userId: ownerId,
        clubId: demoClub.id
      }
    },
    update: {
      role: "OWNER"
    },
    create: {
      userId: ownerId,
      clubId: demoClub.id,
      role: "OWNER"
    },
    select: {
      id: true
    }
  });

  console.log("Demo club seed completed.");
};

const seed = async () => {
  const demoUser = await seedDemoUser();
  await seedDemoClub(demoUser.id);
};

seed()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown seed error";
    console.error(`Seed failed: ${message}`);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
