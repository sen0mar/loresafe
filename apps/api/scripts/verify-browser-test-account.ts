import { z } from "zod";

import { prisma } from "../src/core/prisma/client.js";
import { pendingSignupRepository } from "../src/modules/auth/pending-signup.repository.js";

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
  const pending = await prisma.pendingSignup.findUnique({
    where: { email },
    select: { tokenHash: true }
  });

  if (!pending) {
    throw new Error("Expected one pending browser test signup.");
  }

  // Same confirmation path as the emailed link; tests never see raw tokens.
  const result = await pendingSignupRepository.completePendingSignup({
    tokenHash: pending.tokenHash,
    now: new Date()
  });

  if (result.status !== "CREATED") {
    throw new Error(`Browser test signup was not created: ${result.status}`);
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
