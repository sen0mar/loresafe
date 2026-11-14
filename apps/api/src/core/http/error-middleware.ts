import type { ErrorRequestHandler, Request, RequestHandler } from "express";

import { env } from "../../config/env.js";
import { HttpError } from "../errors/http-error.js";
import { logger, sanitizeError, sanitizePath } from "../logging/logger.js";
import { Sentry } from "../monitoring/sentry.js";

export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(new HttpError(404, "NOT_FOUND", "Route not found"));
};

// express.json() rejects malformed or oversized bodies with plain errors that
// carry a body-parser `type`. They are client mistakes, not server faults.
const toBodyParserHttpError = (error: unknown): HttpError | null => {
  if (
    typeof error !== "object" ||
    error === null ||
    !("type" in error) ||
    typeof error.type !== "string" ||
    !("status" in error) ||
    typeof error.status !== "number" ||
    error.status < 400 ||
    error.status >= 500
  ) {
    return null;
  }

  return error.type === "entity.too.large"
    ? new HttpError(413, "PAYLOAD_TOO_LARGE", "Request body is too large")
    : new HttpError(400, "BAD_REQUEST", "Request body could not be parsed");
};

export const errorHandler: ErrorRequestHandler = (
  rawError,
  req,
  res,
  _next
) => {
  const error = toBodyParserHttpError(rawError) ?? rawError;
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

const getRequestPath = (req: Request) =>
  req.originalUrl.split("?")[0] ?? req.path;
