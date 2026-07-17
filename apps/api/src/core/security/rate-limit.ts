import { createHmac } from "node:crypto";

import rateLimit from "express-rate-limit";
import type { Request } from "express";
import type { Store } from "express-rate-limit";

import { env } from "../../config/env.js";
import { HttpError } from "../errors/http-error.js";
import { logger } from "../logging/logger.js";
import { createUpstashRateLimitStore } from "./upstash-rate-limit-store.js";

const rateLimitMessage = "Too many attempts. Try again later.";

type AuthRateLimiterName =
  "login" | "loginAccountBurst" | "loginAccountSustained" | "logout" | "signup";

type AuthRateLimitConfig = {
  limit: number;
  prefix: string;
  skipSuccessfulRequests?: boolean;
  windowMs: number;
};

export type AuthRateLimitStoreFactory = (prefix: string) => Store;

export type AuthRateLimiters = {
  loginAccountBurstRateLimiter: ReturnType<typeof rateLimit>;
  loginAccountSustainedRateLimiter: ReturnType<typeof rateLimit>;
  loginRateLimiter: ReturnType<typeof rateLimit>;
  logoutRateLimiter: ReturnType<typeof rateLimit>;
  signupRateLimiter: ReturnType<typeof rateLimit>;
};

export type AuthRateLimiterOptions = {
  limitOverrides?: Partial<Record<AuthRateLimiterName, number>>;
  storeFactory?: AuthRateLimitStoreFactory;
};

const authRateLimitConfigs: Record<AuthRateLimiterName, AuthRateLimitConfig> = {
  login: {
    windowMs: 15 * 60 * 1000,
    limit: 30,
    prefix: "loresafe:rl:auth:login:",
    // Successful logins are decremented after finish, leaving a failed-attempt bucket.
    skipSuccessfulRequests: true
  },
  loginAccountBurst: {
    windowMs: 60 * 1000,
    limit: 5,
    prefix: "loresafe:rl:auth:login-account-burst:v1:",
    skipSuccessfulRequests: true
  },
  loginAccountSustained: {
    windowMs: 15 * 60 * 1000,
    limit: 12,
    prefix: "loresafe:rl:auth:login-account-sustained:v1:",
    skipSuccessfulRequests: true
  },
  logout: {
    windowMs: 60 * 1000,
    limit: 90,
    prefix: "loresafe:rl:auth:logout:"
  },
  signup: {
    windowMs: 60 * 60 * 1000,
    limit: 60,
    prefix: "loresafe:rl:auth:signup:"
  }
};

export const createAuthRateLimiters = ({
  limitOverrides = {},
  storeFactory = createUpstashRateLimitStore
}: AuthRateLimiterOptions = {}): AuthRateLimiters => ({
  loginAccountBurstRateLimiter: createLoginAccountRateLimiter(
    "loginAccountBurst",
    authRateLimitConfigs.loginAccountBurst,
    storeFactory,
    limitOverrides.loginAccountBurst
  ),
  loginAccountSustainedRateLimiter: createLoginAccountRateLimiter(
    "loginAccountSustained",
    authRateLimitConfigs.loginAccountSustained,
    storeFactory,
    limitOverrides.loginAccountSustained
  ),
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

const createLoginAccountRateLimiter = (
  name: "loginAccountBurst" | "loginAccountSustained",
  config: AuthRateLimitConfig,
  storeFactory: AuthRateLimitStoreFactory,
  limitOverride?: number
) =>
  rateLimit({
    windowMs: config.windowMs,
    limit: limitOverride ?? config.limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    store: storeFactory(config.prefix),
    identifier: `auth-${name}`,
    keyGenerator: (req) => createLoginAccountBucket(req),
    handler: (req, res, next) => {
      logger.warn("Credential stuffing throttle triggered", {
        limitScope: name,
        requestId: res.locals.requestId,
        sourceIp: req.ip
      });
      next(new HttpError(429, "TOO_MANY_REQUESTS", rateLimitMessage));
    }
  });

export const createLoginAccountBucket = (req: Pick<Request, "body">) => {
  const rawEmail =
    req.body && typeof req.body === "object" && "email" in req.body
      ? req.body.email
      : "";
  const normalizedEmail =
    typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";

  return createHmac("sha256", env.JWT_SECRET)
    .update(normalizedEmail || "invalid-login-identifier")
    .digest("hex");
};

export const {
  loginAccountBurstRateLimiter,
  loginAccountSustainedRateLimiter,
  loginRateLimiter,
  logoutRateLimiter,
  signupRateLimiter
} = createAuthRateLimiters();

export const profileUpdateRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 60,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  store: createUpstashRateLimitStore("loresafe:rl:users:profile-update:"),
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
  store: createUpstashRateLimitStore("loresafe:rl:users:account-delete:"),
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
  store: createUpstashRateLimitStore("loresafe:rl:uploads:public-assets:"),
  identifier: "uploads-public-assets",
  handler: (_req, _res, next) => {
    next(new HttpError(429, "TOO_MANY_REQUESTS", rateLimitMessage));
  }
});

export const postImageUploadRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 60,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  store: createUpstashRateLimitStore("loresafe:rl:uploads:post-images:"),
  identifier: "uploads-post-images",
  handler: (_req, _res, next) => {
    next(new HttpError(429, "TOO_MANY_REQUESTS", rateLimitMessage));
  }
});

export const eventConnectionRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  // Closed healthy streams should not consume the reconnect budget for the
  // entire window; concurrent limits are enforced by eventsService.
  skipSuccessfulRequests: true,
  store: createUpstashRateLimitStore("loresafe:rl:events:connections:v2:"),
  identifier: "events-connections",
  handler: (_req, _res, next) => {
    next(new HttpError(429, "TOO_MANY_REQUESTS", rateLimitMessage));
  }
});

export const clubCreateRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 45,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  store: createUpstashRateLimitStore("loresafe:rl:clubs:create:"),
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
  store: createUpstashRateLimitStore("loresafe:rl:clubs:join:"),
  identifier: "clubs-join",
  handler: (_req, _res, next) => {
    next(new HttpError(429, "TOO_MANY_REQUESTS", rateLimitMessage));
  }
});

export const clubLeaveRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  store: createUpstashRateLimitStore("loresafe:rl:clubs:leave:"),
  identifier: "clubs-leave",
  handler: (_req, _res, next) => {
    next(new HttpError(429, "TOO_MANY_REQUESTS", rateLimitMessage));
  }
});

export const clubInviteCreateRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 60,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  store: createUpstashRateLimitStore("loresafe:rl:clubs:invites:create:"),
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
  store: createUpstashRateLimitStore("loresafe:rl:clubs:members:manage:"),
  identifier: "clubs-members-manage",
  handler: (_req, _res, next) => {
    next(new HttpError(429, "TOO_MANY_REQUESTS", rateLimitMessage));
  }
});

export const clubSettingsUpdateRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 120,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  store: createUpstashRateLimitStore("loresafe:rl:clubs:settings:update:"),
  identifier: "clubs-settings-update",
  handler: (_req, _res, next) => {
    next(new HttpError(429, "TOO_MANY_REQUESTS", rateLimitMessage));
  }
});

export const clubMilestoneCreateRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 90,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  store: createUpstashRateLimitStore("loresafe:rl:clubs:milestones:create:"),
  identifier: "clubs-milestones-create",
  handler: (_req, _res, next) => {
    next(new HttpError(429, "TOO_MANY_REQUESTS", rateLimitMessage));
  }
});

export const clubMilestoneMutationRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 120,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  store: createUpstashRateLimitStore("loresafe:rl:clubs:milestones:mutate:"),
  identifier: "clubs-milestones-mutate",
  handler: (_req, _res, next) => {
    next(new HttpError(429, "TOO_MANY_REQUESTS", rateLimitMessage));
  }
});

export const clubPostCreateRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 90,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  store: createUpstashRateLimitStore("loresafe:rl:clubs:posts:create:"),
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
  store: createUpstashRateLimitStore("loresafe:rl:posts:comments:create:"),
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
  store: createUpstashRateLimitStore("loresafe:rl:posts:reactions:toggle:"),
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
  store: createUpstashRateLimitStore("loresafe:rl:reports:create:"),
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
  store: createUpstashRateLimitStore("loresafe:rl:search:"),
  identifier: "search",
  handler: (_req, _res, next) => {
    next(new HttpError(429, "TOO_MANY_REQUESTS", rateLimitMessage));
  }
});

export const expensiveReadRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 240,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  store: createUpstashRateLimitStore("loresafe:rl:reads:expensive:"),
  identifier: "reads-expensive",
  handler: (_req, _res, next) => {
    next(new HttpError(429, "TOO_MANY_REQUESTS", rateLimitMessage));
  }
});

export const publicSeoReadRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 600,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  store: createUpstashRateLimitStore("loresafe:rl:public-seo:read:"),
  identifier: "public-seo-read",
  handler: (_req, _res, next) => {
    next(new HttpError(429, "TOO_MANY_REQUESTS", rateLimitMessage));
  }
});

export const moderationActionRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 180,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  store: createUpstashRateLimitStore("loresafe:rl:moderation:actions:"),
  identifier: "moderation-actions",
  handler: (_req, _res, next) => {
    next(new HttpError(429, "TOO_MANY_REQUESTS", rateLimitMessage));
  }
});

export const contentRevealRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 120,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  store: createUpstashRateLimitStore("loresafe:rl:content:reveal:"),
  identifier: "content-reveal",
  handler: (_req, _res, next) => {
    next(new HttpError(429, "TOO_MANY_REQUESTS", rateLimitMessage));
  }
});

export const notificationMutationRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 180,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  store: createUpstashRateLimitStore("loresafe:rl:notifications:mutate:"),
  identifier: "notifications-mutate",
  handler: (_req, _res, next) => {
    next(new HttpError(429, "TOO_MANY_REQUESTS", rateLimitMessage));
  }
});

export const commentReactionToggleRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 240,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  store: createUpstashRateLimitStore("loresafe:rl:comments:reactions:toggle:"),
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
  store: createUpstashRateLimitStore("loresafe:rl:clubs:progress:update:"),
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
  store: createUpstashRateLimitStore("loresafe:rl:invites:accept:"),
  identifier: "invites-accept",
  handler: (_req, _res, next) => {
    next(new HttpError(429, "TOO_MANY_REQUESTS", rateLimitMessage));
  }
});
