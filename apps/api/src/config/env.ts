import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { config as loadEnv } from "dotenv";
import { z } from "zod";

const envPaths = [
  resolve(process.cwd(), ".env"),
  resolve(process.cwd(), "../../.env")
];

for (const envPath of envPaths) {
  if (existsSync(envPath)) {
    loadEnv({ path: envPath, override: false, quiet: true });
  }
}

const booleanStringSchema = z
  .enum(["true", "false"])
  .transform((value) => value === "true");

const envSchema = z.object({
  APP_NAME: z.string().trim().min(1).default("ThreadSync"),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().max(65535).default(3000),
  CLIENT_ORIGIN: z.string().url().default("http://localhost:5173"),
  DATABASE_URL: z.string().trim().min(1),
  JWT_SECRET: z.string().min(32),
  SESSION_COOKIE_NAME: z
    .string()
    .trim()
    .min(1)
    .default("threadsync_session"),
  SESSION_COOKIE_SECURE: booleanStringSchema.optional(),
  SESSION_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(60 * 60 * 24 * 7),
  DEMO_USER_EMAIL: z.string().trim().toLowerCase().email(),
  DEMO_USER_DISPLAY_NAME: z.string().trim().min(1).max(80),
  DEMO_USER_PASSWORD: z.string().min(12).max(128)
});

const envResult = envSchema.safeParse(process.env);

if (!envResult.success) {
  const issues = envResult.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("\n");

  console.error(`Invalid environment configuration:\n${issues}`);
  process.exit(1);
}

const parsedEnv = envResult.data;

export const env = {
  ...parsedEnv,
  SESSION_COOKIE_SECURE:
    parsedEnv.SESSION_COOKIE_SECURE ?? parsedEnv.NODE_ENV === "production"
};
