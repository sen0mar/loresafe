import "dotenv/config";

import { z } from "zod";

const envSchema = z.object({
  APP_NAME: z.string().trim().min(1).default("ThreadSync"),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().max(65535).default(3000),
  CLIENT_ORIGIN: z.string().url().default("http://localhost:5173")
});

const envResult = envSchema.safeParse(process.env);

if (!envResult.success) {
  const issues = envResult.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("\n");

  console.error(`Invalid environment configuration:\n${issues}`);
  process.exit(1);
}

export const env = envResult.data;
