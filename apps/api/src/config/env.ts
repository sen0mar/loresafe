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

const parseOriginList = (value: string | undefined) =>
  value
    ?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean) ?? [];

const isValidUrl = (value: string) => {
  try {
    new URL(value);

    return true;
  } catch {
    return false;
  }
};

const envSchema = z
  .object({
    APP_NAME: z.string().trim().min(1).default("ThreadSync"),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    PORT: z.coerce.number().int().positive().max(65535).default(3000),
    CLIENT_ORIGIN: optionalUrlSchema,
    CLIENT_ORIGINS: optionalStringSchema,
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).optional(),
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
    UPSTASH_REDIS_REST_TOKEN: optionalStringSchema,
    R2_ACCOUNT_ID: optionalStringSchema,
    R2_ACCESS_KEY_ID: optionalStringSchema,
    R2_SECRET_ACCESS_KEY: optionalStringSchema,
    R2_BUCKET_NAME: optionalStringSchema,
    R2_PUBLIC_BASE_URL: optionalUrlSchema,
    R2_PRESIGNED_URL_TTL_SECONDS: z.coerce
      .number()
      .int()
      .positive()
      .max(3600)
      .default(300),
    SENTRY_DSN: optionalUrlSchema,
    SENTRY_ENVIRONMENT: optionalStringSchema,
    SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0),
    SENTRY_ENABLE_DEBUG_ROUTE: booleanStringSchema.default(false)
  })
  .superRefine((value, context) => {
    if (value.NODE_ENV !== "production") {
      return;
    }

    if (value.SESSION_COOKIE_SECURE === false) {
      context.addIssue({
        code: "custom",
        path: ["SESSION_COOKIE_SECURE"],
        message: "Must not be false in production"
      });
    }

    const productionRequiredFields = [
      "DATABASE_URL",
      "JWT_SECRET",
      "UPSTASH_REDIS_REST_URL",
      "UPSTASH_REDIS_REST_TOKEN",
      "R2_ACCOUNT_ID",
      "R2_ACCESS_KEY_ID",
      "R2_SECRET_ACCESS_KEY",
      "R2_BUCKET_NAME",
      "R2_PUBLIC_BASE_URL",
      "SENTRY_DSN"
    ] as const;

    for (const field of productionRequiredFields) {
      if (!value[field]) {
        context.addIssue({
          code: "custom",
          path: [field],
          message: "Required in production"
        });
      }
    }

    const clientOrigins = parseOriginList(value.CLIENT_ORIGINS);

    if (clientOrigins.length === 0 && !value.CLIENT_ORIGIN) {
      context.addIssue({
        code: "custom",
        path: ["CLIENT_ORIGINS"],
        message: "At least one production client origin is required"
      });
    }

    for (const origin of clientOrigins) {
      if (!isValidUrl(origin)) {
        context.addIssue({
          code: "custom",
          path: ["CLIENT_ORIGINS"],
          message: `Invalid origin: ${origin}`
        });
      }
    }
  });

type ParsedEnv = z.infer<typeof envSchema>;

export type AppEnv = Omit<ParsedEnv, "CLIENT_ORIGIN"> & {
  CLIENT_ORIGIN: string;
  CLIENT_ORIGIN_ALLOWLIST: string[];
  SESSION_COOKIE_SECURE: boolean;
  TRUST_PROXY_HOPS: number;
};

export const formatEnvIssues = (error: z.ZodError) =>
  error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("\n");

export const parseEnv = (input: NodeJS.ProcessEnv): AppEnv => {
  const parsedEnv = envSchema.parse(input);
  const isProduction = parsedEnv.NODE_ENV === "production";

  return {
    ...parsedEnv,
    CLIENT_ORIGIN: parsedEnv.CLIENT_ORIGIN ?? "http://localhost:5173",
    CLIENT_ORIGIN_ALLOWLIST: parseOriginList(parsedEnv.CLIENT_ORIGINS),
    TRUST_PROXY_HOPS: parsedEnv.TRUST_PROXY_HOPS ?? (isProduction ? 1 : 0),
    SESSION_COOKIE_SECURE: isProduction
      ? true
      : (parsedEnv.SESSION_COOKIE_SECURE ?? false)
  };
};

export const loadValidatedEnv = (input: NodeJS.ProcessEnv): AppEnv => {
  try {
    return parseEnv(input);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error(
        `Invalid environment configuration:\n${formatEnvIssues(error)}`
      );
      process.exit(1);
    }

    throw error;
  }
};

export const env = loadValidatedEnv(process.env);
