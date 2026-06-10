import { randomUUID } from "node:crypto";

import type { RequestHandler } from "express";

export const requestIdMiddleware: RequestHandler = (req, res, next) => {
  const headerRequestId = req.header("x-request-id")?.trim();
  const requestId = headerRequestId || randomUUID();

  res.locals.requestId = requestId;
  res.setHeader("x-request-id", requestId);

  next();
};
