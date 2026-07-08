import type { RequestHandler } from "express";

export const noindexApiResponses: RequestHandler = (_req, res, next) => {
  res.set("X-Robots-Tag", "noindex, nofollow");
  next();
};
