import type { AppEnv } from "./env.js";

const localDevFallbackOrigins = ["http://localhost:5174"];

export const getAllowedCorsOrigins = (env: AppEnv) => {
  if (env.NODE_ENV === "production") {
    return env.CLIENT_ORIGIN_ALLOWLIST.length > 0
      ? env.CLIENT_ORIGIN_ALLOWLIST
      : [env.CLIENT_ORIGIN];
  }

  return [...new Set([env.CLIENT_ORIGIN, ...localDevFallbackOrigins])];
};
