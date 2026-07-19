import { MemoryStore } from "express-rate-limit";

import type { AppEnv } from "../../config/env.js";
import { createRateLimiters, type RateLimiters } from "./rate-limit.js";

type RuntimeRateLimitEnv = Pick<
  AppEnv,
  "NODE_ENV" | "UPSTASH_REDIS_REST_TOKEN" | "UPSTASH_REDIS_REST_URL"
>;

export const createRuntimeRateLimiters = (
  appEnv: RuntimeRateLimitEnv
): RateLimiters => {
  const isIsolatedTestRuntime =
    appEnv.NODE_ENV === "test" &&
    !appEnv.UPSTASH_REDIS_REST_URL &&
    !appEnv.UPSTASH_REDIS_REST_TOKEN;

  if (isIsolatedTestRuntime) {
    return createRateLimiters({ storeFactory: () => new MemoryStore() });
  }

  return createRateLimiters();
};
