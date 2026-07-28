import { timingSafeEqual } from "node:crypto";
import type { RequestHandler } from "express";

import type { AppEnv } from "../../config/env.js";

export const createRequireOperationsToken =
  (appEnv: AppEnv): RequestHandler =>
  (req, res, next) => {
    const configuredToken = appEnv.OPERATIONS_BEARER_TOKEN;
    const suppliedToken = req.get("authorization")?.replace(/^Bearer\s+/i, "");

    if (
      configuredToken &&
      suppliedToken &&
      tokensMatch(configuredToken, suppliedToken)
    ) {
      next();
      return;
    }

    res.status(404).json({
      error: {
        code: "NOT_FOUND",
        message: "Route not found",
        requestId: res.locals.requestId
      }
    });
  };

const tokensMatch = (expected: string, actual: string) => {
  const expectedBytes = Buffer.from(expected);
  const actualBytes = Buffer.from(actual);

  return (
    expectedBytes.length === actualBytes.length &&
    timingSafeEqual(expectedBytes, actualBytes)
  );
};
