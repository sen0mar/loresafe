import type { RequestHandler } from "express";

import type { AppEnv } from "../../config/env.js";
import { getAllowedCorsOrigins } from "../../config/cors.js";
import { HttpError } from "../errors/http-error.js";

const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);

export const createTrustedOriginMiddleware = (
  appEnv: AppEnv
): RequestHandler => {
  const trustedOrigins = new Set(getAllowedCorsOrigins(appEnv));

  return (req, _res, next) => {
    if (safeMethods.has(req.method)) {
      next();
      return;
    }

    const origin = req.get("origin");
    const isProduction = appEnv.NODE_ENV === "production";

    if (
      (origin && !trustedOrigins.has(origin)) ||
      (!origin && isProduction)
    ) {
      next(new HttpError(403, "FORBIDDEN", "Invalid request origin"));
      return;
    }

    next();
  };
};
