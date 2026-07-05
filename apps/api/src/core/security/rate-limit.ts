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
    limit: 60,
    prefix: "threadsync:rl:auth:login:",
    // Successful logins are decremented after finish, leaving a failed-attempt bucket.
    skipSuccessfulRequests: true
  },
  logout: {
    windowMs: 60 * 1000,
    limit: 90,
    prefix: "threadsync:rl:auth:logout:"
  },
  passwordReset: {
    windowMs: 60 * 60 * 1000,
    limit: 9,
    prefix: "threadsync:rl:auth:password-reset:"
  },
  signup: {
    windowMs: 60 * 60 * 1000,
    limit: 60,
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
  limit: 60,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  store: createUpstashRateLimitStore("threadsync:rl:users:profile-update:"),
  identifier: "users-profile-update",
  handler: (_req, _res, next) => {
    next(new HttpError(429, "TOO_MANY_REQUESTS", rateLimitMessage));
  }
});

export const accountDeleteRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 6,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  store: createUpstashRateLimitStore("threadsync:rl:users:account-delete:"),
  identifier: "users-account-delete",
  handler: (_req, _res, next) => {
    next(new HttpError(429, "TOO_MANY_REQUESTS", rateLimitMessage));
  }
});

export const publicAssetUploadRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 90,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  store: createUpstashRateLimitStore("threadsync:rl:uploads:public-assets:"),
  identifier: "uploads-public-assets",
  handler: (_req, _res, next) => {
    next(new HttpError(429, "TOO_MANY_REQUESTS", rateLimitMessage));
  }
});

export const clubCreateRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 45,
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
  limit: 90,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  store: createUpstashRateLimitStore("threadsync:rl:clubs:join:"),
  identifier: "clubs-join",
  handler: (_req, _res, next) => {
    next(new HttpError(429, "TOO_MANY_REQUESTS", rateLimitMessage));
  }
});

export const clubInviteCreateRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 60,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  store: createUpstashRateLimitStore("threadsync:rl:clubs:invites:create:"),
  identifier: "clubs-invites-create",
  handler: (_req, _res, next) => {
    next(new HttpError(429, "TOO_MANY_REQUESTS", rateLimitMessage));
  }
});

export const clubMemberManagementRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 180,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  store: createUpstashRateLimitStore("threadsync:rl:clubs:members:manage:"),
  identifier: "clubs-members-manage",
  handler: (_req, _res, next) => {
    next(new HttpError(429, "TOO_MANY_REQUESTS", rateLimitMessage));
  }
});

export const clubMilestoneCreateRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 90,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  store: createUpstashRateLimitStore("threadsync:rl:clubs:milestones:create:"),
  identifier: "clubs-milestones-create",
  handler: (_req, _res, next) => {
    next(new HttpError(429, "TOO_MANY_REQUESTS", rateLimitMessage));
  }
});

export const clubPostCreateRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 90,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  store: createUpstashRateLimitStore("threadsync:rl:clubs:posts:create:"),
  identifier: "clubs-posts-create",
  handler: (_req, _res, next) => {
    next(new HttpError(429, "TOO_MANY_REQUESTS", rateLimitMessage));
  }
});

export const postCommentCreateRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 120,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  store: createUpstashRateLimitStore("threadsync:rl:posts:comments:create:"),
  identifier: "posts-comments-create",
  handler: (_req, _res, next) => {
    next(new HttpError(429, "TOO_MANY_REQUESTS", rateLimitMessage));
  }
});

export const postReactionToggleRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 240,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  store: createUpstashRateLimitStore("threadsync:rl:posts:reactions:toggle:"),
  identifier: "posts-reactions-toggle",
  handler: (_req, _res, next) => {
    next(new HttpError(429, "TOO_MANY_REQUESTS", rateLimitMessage));
  }
});

export const reportCreateRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  store: createUpstashRateLimitStore("threadsync:rl:reports:create:"),
  identifier: "reports-create",
  handler: (_req, _res, next) => {
    next(new HttpError(429, "TOO_MANY_REQUESTS", rateLimitMessage));
  }
});

export const searchRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 360,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  store: createUpstashRateLimitStore("threadsync:rl:search:"),
  identifier: "search",
  handler: (_req, _res, next) => {
    next(new HttpError(429, "TOO_MANY_REQUESTS", rateLimitMessage));
  }
});

export const moderationActionRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 180,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  store: createUpstashRateLimitStore("threadsync:rl:moderation:actions:"),
  identifier: "moderation-actions",
  handler: (_req, _res, next) => {
    next(new HttpError(429, "TOO_MANY_REQUESTS", rateLimitMessage));
  }
});

export const commentReactionToggleRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 240,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  store: createUpstashRateLimitStore(
    "threadsync:rl:comments:reactions:toggle:"
  ),
  identifier: "comments-reactions-toggle",
  handler: (_req, _res, next) => {
    next(new HttpError(429, "TOO_MANY_REQUESTS", rateLimitMessage));
  }
});

export const clubProgressUpdateRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 120,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  store: createUpstashRateLimitStore("threadsync:rl:clubs:progress:update:"),
  identifier: "clubs-progress-update",
  handler: (_req, _res, next) => {
    next(new HttpError(429, "TOO_MANY_REQUESTS", rateLimitMessage));
  }
});

export const inviteAcceptRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 90,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  store: createUpstashRateLimitStore("threadsync:rl:invites:accept:"),
  identifier: "invites-accept",
  handler: (_req, _res, next) => {
    next(new HttpError(429, "TOO_MANY_REQUESTS", rateLimitMessage));
  }
});
