import { existsSync } from "node:fs";
import { isIP } from "node:net";
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

const normalizeOrigin = (origin: string) => origin.replace(/\/+$/, "");

const trustedProxyNames = new Set(["linklocal", "loopback", "uniquelocal"]);

const isValidTrustedProxy = (value: string) => {
  if (trustedProxyNames.has(value)) {
    return true;
  }

  const [address, prefix, ...extraParts] = value.split("/");
  const ipVersion = isIP(address ?? "");

  if (extraParts.length > 0 || ipVersion === 0) {
    return false;
  }

  if (prefix === undefined) {
    return true;
  }

  const numericPrefix = Number(prefix);
  const maxPrefix = ipVersion === 4 ? 32 : 128;

  return (
    Number.isInteger(numericPrefix) &&
    numericPrefix >= 0 &&
    numericPrefix <= maxPrefix
  );
};

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
    APP_NAME: z.string().trim().min(1).default("LoreSafe"),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    PORT: z.coerce.number().int().positive().max(65535).default(3000),
    CLIENT_ORIGIN: optionalUrlSchema,
    CLIENT_ORIGINS: optionalStringSchema,
    PUBLIC_SITE_ORIGIN: optionalUrlSchema,
    TRUST_PROXY_CIDRS: optionalStringSchema,
    DATABASE_URL: z.string().trim().min(1),
    JWT_SECRET: z.string().min(32),
    JWT_PREVIOUS_SECRET: optionalStringSchema.pipe(
      z.string().min(32).optional()
    ),
    JWT_ISSUER: z.string().trim().min(1).default("loresafe-api"),
    JWT_AUDIENCE: z.string().trim().min(1).default("loresafe-web"),
    SESSION_COOKIE_NAME: z.string().trim().min(1).default("loresafe_session"),
    SESSION_COOKIE_SECURE: booleanStringSchema.optional(),
    SESSION_TTL_SECONDS: z.coerce
      .number()
      .int()
      .positive()
      .default(60 * 60 * 24 * 30),
    SESSION_ACCESS_TTL_SECONDS: z.coerce
      .number()
      .int()
      .positive()
      .max(60 * 60)
      .default(60 * 15),
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
    R2_CONNECTION_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .positive()
      .max(30_000)
      .default(3_000),
    R2_REQUEST_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .positive()
      .max(60_000)
      .default(15_000),
    SERVER_HEADERS_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .positive()
      .max(120_000)
      .default(15_000),
    SERVER_REQUEST_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .positive()
      .max(120_000)
      .default(30_000),
    SERVER_KEEP_ALIVE_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .positive()
      .max(30_000)
      .default(5_000),
    OPERATIONS_BEARER_TOKEN: optionalStringSchema.pipe(
      z.string().min(32).optional()
    ),
    SENTRY_DSN: optionalUrlSchema,
    SENTRY_ENVIRONMENT: optionalStringSchema,
    SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0),
    SENTRY_ENABLE_DEBUG_ROUTE: booleanStringSchema.default(false)
  })
  .superRefine((value, context) => {
    if (value.SERVER_HEADERS_TIMEOUT_MS <= value.SERVER_KEEP_ALIVE_TIMEOUT_MS) {
      context.addIssue({
        code: "custom",
        path: ["SERVER_HEADERS_TIMEOUT_MS"],
        message: "Must be greater than SERVER_KEEP_ALIVE_TIMEOUT_MS"
      });
    }

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
      "SENTRY_DSN",
      "OPERATIONS_BEARER_TOKEN"
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

    const trustedProxies = parseOriginList(value.TRUST_PROXY_CIDRS);

    if (trustedProxies.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["TRUST_PROXY_CIDRS"],
        message:
          "Explicit trusted proxy addresses or subnets are required in production"
      });
    }

    for (const trustedProxy of trustedProxies) {
      if (!isValidTrustedProxy(trustedProxy)) {
        context.addIssue({
          code: "custom",
          path: ["TRUST_PROXY_CIDRS"],
          message: `Invalid trusted proxy address or subnet: ${trustedProxy}`
        });
      }
    }
  });

type ParsedEnv = z.infer<typeof envSchema>;

export type AppEnv = Omit<ParsedEnv, "CLIENT_ORIGIN" | "TRUST_PROXY_CIDRS"> & {
  CLIENT_ORIGIN: string;
  CLIENT_ORIGIN_ALLOWLIST: string[];
  PUBLIC_SITE_ORIGIN: string;
  SESSION_COOKIE_SECURE: boolean;
  TRUST_PROXY_CIDRS: string[];
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
    PUBLIC_SITE_ORIGIN: normalizeOrigin(
      parsedEnv.PUBLIC_SITE_ORIGIN ?? "https://www.loresafe.org"
    ),
    TRUST_PROXY_CIDRS: parseOriginList(parsedEnv.TRUST_PROXY_CIDRS),
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
