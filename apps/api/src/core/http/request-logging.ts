import type { RequestHandler } from "express";

import { logger, sanitizePath } from "../logging/logger.js";

export const requestLoggingMiddleware: RequestHandler = (req, res, next) => {
  const startedAt = performance.now();

  res.on("finish", () => {
    logger.info("HTTP request completed", {
      requestId: res.locals.requestId,
      method: req.method,
      path: sanitizePath(req.originalUrl.split("?")[0] ?? req.path),
      statusCode: res.statusCode,
      durationMs: Math.round(performance.now() - startedAt)
    });
  });

  next();
};
