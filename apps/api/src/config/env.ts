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

const optionalStringSchema = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() === "" ? undefined : value,
  z.string().trim().min(1).optional()
);

const optionalUrlSchema = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() === "" ? undefined : value,
  z.string().trim().url().optional()
);

const envSchema = z
  .object({
    APP_NAME: z.string().trim().min(1).default("ThreadSync"),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    PORT: z.coerce.number().int().positive().max(65535).default(3000),
    CLIENT_ORIGIN: z.string().url().default("http://localhost:5173"),
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(0),
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
    DEMO_USER_PASSWORD: z.string().min(12).max(128),
    UPSTASH_REDIS_REST_URL: optionalUrlSchema,
    UPSTASH_REDIS_REST_TOKEN: optionalStringSchema
  })
  .superRefine((value, context) => {
    // Tests inject local stores; real app runs should fail fast without Redis limits.
    if (value.NODE_ENV === "test") {
      return;
    }

    if (!value.UPSTASH_REDIS_REST_URL) {
      context.addIssue({
        code: "custom",
        path: ["UPSTASH_REDIS_REST_URL"],
        message: "Required"
      });
    }

    if (!value.UPSTASH_REDIS_REST_TOKEN) {
      context.addIssue({
        code: "custom",
        path: ["UPSTASH_REDIS_REST_TOKEN"],
        message: "Required"
      });
    }
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
const isProduction = parsedEnv.NODE_ENV === "production";

export const env = {
  ...parsedEnv,
  SESSION_COOKIE_SECURE: isProduction
    ? true
    : (parsedEnv.SESSION_COOKIE_SECURE ?? false)
};
