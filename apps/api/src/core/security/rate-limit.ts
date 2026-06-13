import rateLimit from "express-rate-limit";
import type { Store } from "express-rate-limit";

import { HttpError } from "../errors/http-error.js";
import { createUpstashRateLimitStore } from "./upstash-rate-limit-store.js";

const rateLimitMessage = "Too many attempts. Try again later.";

type AuthRateLimiterName = "login" | "logout" | "passwordReset" | "signup";

type AuthRateLimitConfig = {
  limit: number;
  prefix: string;
  skipSuccessfulRequests?: boolean;
  windowMs: number;
};

export type AuthRateLimitStoreFactory = (prefix: string) => Store;

export type AuthRateLimiters = {
  loginRateLimiter: ReturnType<typeof rateLimit>;
  logoutRateLimiter: ReturnType<typeof rateLimit>;
  passwordResetRateLimiter: ReturnType<typeof rateLimit>;
  signupRateLimiter: ReturnType<typeof rateLimit>;
};

export type AuthRateLimiterOptions = {
  limitOverrides?: Partial<Record<AuthRateLimiterName, number>>;
  storeFactory?: AuthRateLimitStoreFactory;
};

const authRateLimitConfigs: Record<AuthRateLimiterName, AuthRateLimitConfig> = {
  login: {
    windowMs: 15 * 60 * 1000,
    limit: 5,
    prefix: "threadsync:rl:auth:login:",
    // Successful logins are decremented after finish, leaving a failed-attempt bucket.
    skipSuccessfulRequests: true
  },
  logout: {
    windowMs: 60 * 1000,
    limit: 30,
    prefix: "threadsync:rl:auth:logout:"
  },
  passwordReset: {
    windowMs: 60 * 60 * 1000,
    limit: 3,
    prefix: "threadsync:rl:auth:password-reset:"
  },
  signup: {
    windowMs: 60 * 60 * 1000,
    limit: 3,
    prefix: "threadsync:rl:auth:signup:"
  }
};

export const createAuthRateLimiters = ({
  limitOverrides = {},
  storeFactory = createUpstashRateLimitStore
}: AuthRateLimiterOptions = {}): AuthRateLimiters => ({
  loginRateLimiter: createAuthRateLimiter(
    "login",
    authRateLimitConfigs.login,
    storeFactory,
    limitOverrides.login
  ),
  logoutRateLimiter: createAuthRateLimiter(
    "logout",
    authRateLimitConfigs.logout,
    storeFactory,
    limitOverrides.logout
  ),
  passwordResetRateLimiter: createAuthRateLimiter(
    "passwordReset",
    authRateLimitConfigs.passwordReset,
    storeFactory,
    limitOverrides.passwordReset
  ),
  signupRateLimiter: createAuthRateLimiter(
    "signup",
    authRateLimitConfigs.signup,
    storeFactory,
    limitOverrides.signup
  )
});

const createAuthRateLimiter = (
  name: AuthRateLimiterName,
  config: AuthRateLimitConfig,
  storeFactory: AuthRateLimitStoreFactory,
  limitOverride?: number
) =>
  rateLimit({
    windowMs: config.windowMs,
    limit: limitOverride ?? config.limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skipSuccessfulRequests: config.skipSuccessfulRequests ?? false,
    store: storeFactory(config.prefix),
    identifier: `auth-${name}`,
    handler: (_req, _res, next) => {
      next(new HttpError(429, "TOO_MANY_REQUESTS", rateLimitMessage));
    }
  });

export const {
  loginRateLimiter,
  logoutRateLimiter,
  passwordResetRateLimiter,
  signupRateLimiter
} = createAuthRateLimiters();

export const profileUpdateRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  store: createUpstashRateLimitStore("threadsync:rl:users:profile-update:"),
  identifier: "users-profile-update",
  handler: (_req, _res, next) => {
    next(new HttpError(429, "TOO_MANY_REQUESTS", rateLimitMessage));
  }
});

export const clubCreateRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 15,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  store: createUpstashRateLimitStore("threadsync:rl:clubs:create:"),
  identifier: "clubs-create",
  handler: (_req, _res, next) => {
    next(new HttpError(429, "TOO_MANY_REQUESTS", rateLimitMessage));
  }
});

export const clubJoinRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  store: createUpstashRateLimitStore("threadsync:rl:clubs:join:"),
  identifier: "clubs-join",
  handler: (_req, _res, next) => {
    next(new HttpError(429, "TOO_MANY_REQUESTS", rateLimitMessage));
  }
});
