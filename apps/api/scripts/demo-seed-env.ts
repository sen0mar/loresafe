import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { config as loadEnv } from "dotenv";
import { z } from "zod";

const confirmation = "I_UNDERSTAND_THIS_WRITES_DEMO_DATA";

const seedEnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test"]),
    DATABASE_URL: z.string().trim().url(),
    DEMO_SEED_DATABASE_URL: z.string().trim().url(),
    DEMO_SEED_CONFIRM: z.literal(confirmation),
    DEMO_USER_EMAIL: z.string().trim().toLowerCase().email(),
    DEMO_USER_DISPLAY_NAME: z.string().trim().min(1).max(80),
    DEMO_USER_PASSWORD: z.string().min(12).max(128)
  })
  .superRefine((value, context) => {
    if (value.DATABASE_URL !== value.DEMO_SEED_DATABASE_URL) {
      context.addIssue({
        code: "custom",
        path: ["DEMO_SEED_DATABASE_URL"],
        message: "Must exactly match DATABASE_URL to approve this seed target"
      });
    }
  });

export type DemoSeedEnv = z.infer<typeof seedEnvSchema>;

export const parseDemoSeedEnv = (input: NodeJS.ProcessEnv): DemoSeedEnv => {
  if (input.NODE_ENV === "production") {
    throw new Error("Demo seeding is forbidden when NODE_ENV=production.");
  }

  return seedEnvSchema.parse(input);
};

export const loadDemoSeedEnv = (cwd = process.cwd()) => {
  for (const envPath of [resolve(cwd, ".env"), resolve(cwd, "../../.env")]) {
    if (existsSync(envPath)) {
      loadEnv({ path: envPath, override: false, quiet: true });
    }
  }

  return parseDemoSeedEnv(process.env);
};
