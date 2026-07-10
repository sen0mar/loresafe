import { PrismaPg } from "@prisma/adapter-pg";

import {
  normalizeNameReservationKey,
  normalizeUsername
} from "../src/core/identity/user-names.js";
import { hashPassword } from "../src/core/security/password.js";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { loadDemoSeedEnv } from "../scripts/demo-seed-env.js";

const seedEnv = loadDemoSeedEnv();
const prisma = new PrismaClient({
  adapter: new PrismaPg(seedEnv.DEMO_SEED_DATABASE_URL)
});

const seedDemoUser = async () => {
  const email = seedEnv.DEMO_USER_EMAIL;
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

  const passwordHash = await hashPassword(seedEnv.DEMO_USER_PASSWORD);
  const username = toDemoUsername(seedEnv.DEMO_USER_DISPLAY_NAME);
  const reservationKeys = Array.from(
    new Set([
      normalizeNameReservationKey(username),
      normalizeNameReservationKey(seedEnv.DEMO_USER_DISPLAY_NAME)
    ])
  );

  const demoUser = await prisma.user.create({
    data: {
      email,
      displayName: seedEnv.DEMO_USER_DISPLAY_NAME,
      username,
      passwordHash,
      nameReservations: {
        create: reservationKeys.map((normalizedName) => ({
          normalizedName
        }))
      }
    },
    select: {
      id: true
    }
  });

  console.log("Demo user seed completed.");
  return demoUser;
};

const toDemoUsername = (displayName: string) => {
  const username = normalizeUsername(displayName)
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return username.length >= 3 ? username.slice(0, 30) : "demo_user";
};

const seedDemoClub = async (ownerId: string) => {
  const demoClub = await prisma.club.upsert({
    where: {
      linkName: "the-first-law-book-club"
    },
    update: {
      title: "The First Law Book Club",
      description: "Abercrombie fans discussing the books one chapter at a time.",
      category: "BOOKS",
      visibility: "PUBLIC"
    },
    create: {
      title: "The First Law Book Club",
      linkName: "the-first-law-book-club",
      description: "Abercrombie fans discussing the books one chapter at a time.",
      category: "BOOKS",
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

  await seedDemoMilestones(demoClub.id);
  await seedDemoProgress(ownerId, demoClub.id);
  await seedDemoPosts(ownerId, demoClub.id);

  console.log("Demo club seed completed.");
};

const seedDemoMilestones = async (clubId: string) => {
  const demoMilestones = [
    {
      position: 1,
      safeTitle: "Opening chapters",
      fullTitle: "The Blade Itself: opening chapters",
      description: "Start the timeline with first impressions and early character setup.",
      spoilerName: false
    },
    {
      position: 2,
      safeTitle: "Northern journey",
      fullTitle: "The Blade Itself: northern journey",
      description: "Discussion checkpoint for early travels and shifting alliances.",
      spoilerName: false
    },
    {
      position: 3,
      safeTitle: "Named revelation",
      fullTitle: "The Bloody-Nine",
      description:
        "A name-sensitive checkpoint; use only the spoiler free title in locked views.",
      spoilerName: true
    },
    {
      position: 4,
      safeTitle: "Book one finale",
      fullTitle: "The Blade Itself finale",
      description: "Wrap-up checkpoint for the first book.",
      spoilerName: false
    }
  ];

  for (const milestone of demoMilestones) {
    await prisma.milestone.upsert({
      where: {
        clubId_position: {
          clubId,
          position: milestone.position
        }
      },
      update: {
        safeTitle: milestone.safeTitle,
        fullTitle: milestone.fullTitle,
        description: milestone.description,
        spoilerName: milestone.spoilerName
      },
      create: {
        clubId,
        ...milestone
      },
      select: {
        id: true
      }
    });
  }
};

const seedDemoProgress = async (userId: string, clubId: string) => {
  const currentMilestone = await prisma.milestone.findUnique({
    where: {
      clubId_position: {
        clubId,
        position: 2
      }
    },
    select: {
      id: true
    }
  });

  await prisma.clubProgress.upsert({
    where: {
      userId_clubId: {
        userId,
        clubId
      }
    },
    update: {
      currentMilestoneId: currentMilestone?.id ?? null,
      mode: "STRICT"
    },
    create: {
      userId,
      clubId,
      currentMilestoneId: currentMilestone?.id ?? null,
      mode: "STRICT"
    },
    select: {
      id: true
    }
  });
};

const seedDemoPosts = async (authorId: string, clubId: string) => {
  const milestones = await prisma.milestone.findMany({
    where: {
      clubId
    },
    orderBy: {
      position: "asc"
    },
    select: {
      id: true,
      position: true
    }
  });
  const milestoneByPosition = new Map(
    milestones.map((milestone) => [milestone.position, milestone.id])
  );
  const demoPosts = [
    {
      type: "DISCUSSION" as const,
      title: "First impressions without future hints",
      body: "What did everyone make of the opening tone and the way the first point-of-view chapters establish the world?",
      requiredMilestonePosition: 1
    },
    {
      type: "QUESTION" as const,
      title: "Northern journey check-in",
      body: "The early travel chapters make the world feel wider without needing finale context. Which detail stood out most?",
      requiredMilestonePosition: 2
    },
    {
      type: "THEORY" as const,
      title: "After the named revelation",
      body: "LOCKED_DEMO_SECRET_BODY_DO_NOT_LEAK: later readers can discuss the full implications of the name reveal here.",
      requiredMilestonePosition: 3
    },
    {
      type: "REVIEW" as const,
      title: "Book one finale reactions",
      body: "LOCKED_FINALE_SECRET_BODY_DO_NOT_LEAK: finale readers can compare the ending against the opening promises here.",
      requiredMilestonePosition: 4
    }
  ];

  for (const post of demoPosts) {
    const requiredMilestoneId = milestoneByPosition.get(
      post.requiredMilestonePosition
    );

    if (!requiredMilestoneId) {
      continue;
    }

    const existingPost = await prisma.post.findFirst({
      where: {
        clubId,
        title: post.title,
        deletedAt: null
      },
      select: {
        id: true
      }
    });

    if (existingPost) {
      await prisma.post.update({
        where: {
          id: existingPost.id
        },
        data: {
          authorId,
          type: post.type,
          body: post.body,
          requiredMilestoneId,
          status: "VISIBLE"
        },
        select: {
          id: true
        }
      });
      continue;
    }

    await prisma.post.create({
      data: {
        clubId,
        authorId,
        type: post.type,
        title: post.title,
        body: post.body,
        requiredMilestoneId,
        status: "VISIBLE"
      },
      select: {
        id: true
      }
    });
  }
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
