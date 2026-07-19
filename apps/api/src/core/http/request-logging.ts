import type { RequestHandler } from "express";

import { logger, sanitizePath } from "../logging/logger.js";
import { operationsMetrics } from "../monitoring/operations-metrics.js";

export const requestLoggingMiddleware: RequestHandler = (req, res, next) => {
  const startedAt = performance.now();

  res.on("finish", () => {
    const durationMs = Math.round(performance.now() - startedAt);
    const path = sanitizePath(req.originalUrl.split("?")[0] ?? req.path);
    operationsMetrics.recordHttpRequest(
      req.method,
      path,
      res.statusCode,
      durationMs
    );
    logger.info("HTTP request completed", {
      requestId: res.locals.requestId,
      method: req.method,
      path,
      statusCode: res.statusCode,
      durationMs
    });
  });

  next();
};
