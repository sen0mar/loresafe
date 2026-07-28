import { z } from "zod";

import { prisma } from "../src/core/prisma/client.js";

const browserAccountEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email()
  .refine((email) => email.endsWith("@example.com"));

const verifyBrowserTestAccount = async () => {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("Browser account verification is test-only.");
  }

  const email = browserAccountEmailSchema.parse(process.argv[2]);
  const verified = await prisma.user.updateMany({
    where: {
      email,
      deletedAt: null,
      emailVerifiedAt: null
    },
    data: { emailVerifiedAt: new Date() }
  });

  if (verified.count !== 1) {
    throw new Error("Expected one unverified browser test account.");
  }
};

verifyBrowserTestAccount()
  .catch((error: unknown) => {
    const message =
      error instanceof Error ? error.message : "Unknown verification error";
    console.error(`Browser test account verification failed: ${message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
