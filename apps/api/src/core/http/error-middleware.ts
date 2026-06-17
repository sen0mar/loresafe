import type { ErrorRequestHandler, Request, RequestHandler } from "express";

import { env } from "../../config/env.js";
import { HttpError } from "../errors/http-error.js";
import { logger, sanitizeError, sanitizePath } from "../logging/logger.js";
import { Sentry } from "../monitoring/sentry.js";

export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(new HttpError(404, "NOT_FOUND", "Route not found"));
};

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  const isHttpError = error instanceof HttpError;
  const statusCode = isHttpError ? error.statusCode : 500;
  const code = isHttpError ? error.code : "INTERNAL_SERVER_ERROR";
  const message = isHttpError ? error.message : "Internal server error";
  const requestId = String(res.locals.requestId ?? "");

  if (!isHttpError && env.NODE_ENV !== "test") {
    const requestContext = getSafeRequestContext(req, requestId, statusCode);

    Sentry.withScope((scope) => {
      scope.setTag("request_id", requestId);
      scope.setTag("http.status_code", String(statusCode));
      scope.setContext("request", requestContext);
      Sentry.captureException(error);
    });

    logger.error("Unhandled request error", {
      ...requestContext,
      error: sanitizeError(error)
    });
  }

  res.status(statusCode).json({
    error: {
      code,
      message,
      requestId
    }
  });
};

const getSafeRequestContext = (
  req: Request,
  requestId: string,
  statusCode: number
) => {
  return {
    requestId,
    method: req.method,
    path: sanitizePath(getRequestPath(req)),
    statusCode
  };
};

const getRequestPath = (req: Request) => req.originalUrl.split("?")[0] ?? req.path;
