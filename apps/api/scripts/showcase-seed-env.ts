import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { config as loadEnv } from "dotenv";
import { z } from "zod";

import { readMatchingNeonDatabaseTarget } from "./neon-database-target.js";

const showcaseSeedConfirmation =
  "I_UNDERSTAND_THIS_WRITES_SHOWCASE_DATA_TO_AN_EMPTY_DATABASE";
const retiredShowcaseInviteTokenHash =
  "e938275967201eb7ba4e42fb761922b5e73e829f807fd0d7cf9bcf80af8db642";

const estimateEntropyBits = (value: string) => {
  const characterCounts = new Map<string, number>();

  for (const character of value) {
    characterCounts.set(character, (characterCounts.get(character) ?? 0) + 1);
  }

  return [...characterCounts.values()].reduce((entropy, count) => {
    const probability = count / value.length;
    return entropy - count * Math.log2(probability);
  }, 0);
};

const showcaseInviteTokenSchema = z
  .string()
  .trim()
  .length(43, "Must be a 32-byte base64url token")
  .regex(/^[A-Za-z0-9_-]+$/, "Must be a base64url token")
  .refine(
    (value) => estimateEntropyBits(value) >= 160,
    "Must be a strongly random token with at least 160 bits of estimated entropy"
  )
  .refine(
    (value) =>
      createHash("sha256").update(value).digest("hex") !==
      retiredShowcaseInviteTokenHash,
    "Must not reuse the retired showcase invite token"
  );

const showcaseSeedEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "production"]),
  DATABASE_URL: z.string().trim().url(),
  DIRECT_URL: z.string().trim().url(),
  SHOWCASE_SEED_CONFIRM: z.literal(showcaseSeedConfirmation),
  SHOWCASE_SEED_NEON_ENDPOINT_ID: z
    .string()
    .trim()
    .regex(/^ep-[a-z0-9-]+$/),
  SHOWCASE_INVITE_TOKEN: showcaseInviteTokenSchema,
  SHOWCASE_RECRUITER_EMAIL: z.string().trim().toLowerCase().email(),
  SHOWCASE_USER_PASSWORD: z.string().min(12).max(128)
});

export type ShowcaseSeedEnv = z.infer<typeof showcaseSeedEnvSchema> & {
  showcaseDatabaseUrl: string;
};

export const parseShowcaseSeedEnv = (
  input: NodeJS.ProcessEnv
): ShowcaseSeedEnv => {
  const parsed = showcaseSeedEnvSchema.parse(input);
  const target = readMatchingNeonDatabaseTarget({
    directUrl: parsed.DIRECT_URL,
    expectedEndpointId: parsed.SHOWCASE_SEED_NEON_ENDPOINT_ID,
    runtimeUrl: parsed.DATABASE_URL
  });

  return {
    ...parsed,
    showcaseDatabaseUrl: target.directUrl
  };
};

export const loadShowcaseSeedEnv = (cwd = process.cwd()) => {
  for (const envPath of [resolve(cwd, ".env"), resolve(cwd, "../../.env")]) {
    if (existsSync(envPath)) {
      loadEnv({ path: envPath, override: false, quiet: true });
    }
  }

  return parseShowcaseSeedEnv(process.env);
};
