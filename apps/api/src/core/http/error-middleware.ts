import type { ErrorRequestHandler, RequestHandler } from "express";

import { env } from "../../config/env.js";
import { HttpError } from "../errors/http-error.js";

export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(new HttpError(404, "NOT_FOUND", "Route not found"));
};

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  const isHttpError = error instanceof HttpError;
  const statusCode = isHttpError ? error.statusCode : 500;
  const code = isHttpError ? error.code : "INTERNAL_SERVER_ERROR";
  const message = isHttpError ? error.message : "Internal server error";
  const requestId = String(res.locals.requestId ?? "");

  if (!isHttpError && env.NODE_ENV !== "test") {
    const detail = error instanceof Error ? error.message : "Unknown error";
    console.error(`[${requestId}] ${detail}`);
  }

  res.status(statusCode).json({
    error: {
      code,
      message,
      requestId
    }
  });
};
