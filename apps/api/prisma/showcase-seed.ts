import { PrismaPg } from "@prisma/adapter-pg";

import { hashPassword } from "../src/core/security/password.js";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { loadShowcaseSeedEnv } from "../scripts/showcase-seed-env.js";
import { validateShowcaseFixtures } from "./showcase/showcase.validation.js";
import { writeShowcaseData } from "./showcase/showcase.writer.js";

const runShowcaseSeed = async () => {
  const env = loadShowcaseSeedEnv();
  const summary = validateShowcaseFixtures();
  const passwordHash = await hashPassword(env.SHOWCASE_USER_PASSWORD);
  const prisma = new PrismaClient({
    adapter: new PrismaPg(env.showcaseDatabaseUrl)
  });

  try {
    await prisma.$transaction(
      (transaction) =>
        writeShowcaseData(transaction, {
          inviteToken: env.SHOWCASE_INVITE_TOKEN,
          passwordHash,
          recruiterEmail: env.SHOWCASE_RECRUITER_EMAIL,
          seededAt: new Date()
        }),
      {
        isolationLevel: "Serializable",
        maxWait: 10_000,
        timeout: 60_000
      }
    );
  } finally {
    await prisma.$disconnect();
  }

  console.log(
    `Showcase seed completed with ${summary.users} users, ${summary.clubs} clubs, ${summary.milestones} milestones, ${summary.posts} posts, and ${summary.comments} comments.`
  );
  console.log(`Recruiter login email: ${env.SHOWCASE_RECRUITER_EMAIL}`);
  console.log(`Lord of the Rings invite token: ${env.SHOWCASE_INVITE_TOKEN}`);
};

runShowcaseSeed().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown seed error";
  console.error(`Showcase seed failed: ${message}`);
  process.exit(1);
});
