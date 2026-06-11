import rateLimit from "express-rate-limit";

import { HttpError } from "../errors/http-error.js";

// Password hashing is intentionally expensive, so signup gets a cheap guard first.
export const signupRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(
      new HttpError(
        429,
        "TOO_MANY_REQUESTS",
        "Too many signup attempts. Try again later."
      )
    );
  }
});
