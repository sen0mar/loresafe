import { Router } from "express";

import { env } from "../../config/env.js";

export const debugRouter = Router();

if (
  env.NODE_ENV !== "production" &&
  env.NODE_ENV !== "test" &&
  env.SENTRY_ENABLE_DEBUG_ROUTE
) {
  debugRouter.get("/sentry-error", () => {
    throw new Error("Controlled Sentry backend verification error");
  });
}
