import { randomUUID } from "node:crypto";

import type { RequestHandler } from "express";

const requestIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;

export const requestIdMiddleware: RequestHandler = (req, res, next) => {
  const headerRequestId = req.header("x-request-id");
  const requestId = isValidRequestId(headerRequestId)
    ? headerRequestId
    : randomUUID();

  res.locals.requestId = requestId;
  res.setHeader("x-request-id", requestId);

  next();
};

const isValidRequestId = (requestId: string | undefined): requestId is string =>
  requestId !== undefined && requestIdPattern.test(requestId);
