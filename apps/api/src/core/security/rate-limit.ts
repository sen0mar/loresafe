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
    // These stacked account buckets have independent stores and namespaces;
    // express-rate-limit cannot prove that separation from the request alone.
    validate: { singleCount: false },
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

type StandardRateLimitConfig = {
  identifier: string;
  limit: number;
  prefix: string;
  skipSuccessfulRequests?: boolean;
  windowMs: number;
};

const createStandardRateLimitConfig = (
  windowMinutes: number,
  limit: number,
  identifier: string,
  prefix: string
): StandardRateLimitConfig => ({
  windowMs: windowMinutes * 60 * 1000,
  limit,
  identifier,
  prefix
});

const standardRateLimitConfigs = {
  profileUpdateRateLimiter: createStandardRateLimitConfig(
    10,
    60,
    "users-profile-update",
    "loresafe:rl:users:profile-update:"
  ),
  accountDeleteRateLimiter: createStandardRateLimitConfig(
    60,
    6,
    "users-account-delete",
    "loresafe:rl:users:account-delete:"
  ),
  publicAssetUploadRateLimiter: createStandardRateLimitConfig(
    10,
    90,
    "uploads-public-assets",
    "loresafe:rl:uploads:public-assets:"
  ),
  postImageUploadRateLimiter: createStandardRateLimitConfig(
    10,
    60,
    "uploads-post-images",
    "loresafe:rl:uploads:post-images:"
  ),
  eventConnectionRateLimiter: {
    ...createStandardRateLimitConfig(
      10,
      30,
      "events-connections",
      "loresafe:rl:events:connections:v2:"
    ),
    // Closed healthy streams should not consume the reconnect budget for the
    // entire window; concurrent limits are enforced by eventsService.
    skipSuccessfulRequests: true
  },
  clubCreateRateLimiter: createStandardRateLimitConfig(
    10,
    45,
    "clubs-create",
    "loresafe:rl:clubs:create:"
  ),
  clubJoinRateLimiter: createStandardRateLimitConfig(
    10,
    90,
    "clubs-join",
    "loresafe:rl:clubs:join:"
  ),
  clubLeaveRateLimiter: createStandardRateLimitConfig(
    10,
    30,
    "clubs-leave",
    "loresafe:rl:clubs:leave:"
  ),
  clubInviteCreateRateLimiter: createStandardRateLimitConfig(
    10,
    60,
    "clubs-invites-create",
    "loresafe:rl:clubs:invites:create:"
  ),
  clubMemberManagementRateLimiter: createStandardRateLimitConfig(
    10,
    180,
    "clubs-members-manage",
    "loresafe:rl:clubs:members:manage:"
  ),
  clubSettingsUpdateRateLimiter: createStandardRateLimitConfig(
    10,
    120,
    "clubs-settings-update",
    "loresafe:rl:clubs:settings:update:"
  ),
  clubMilestoneCreateRateLimiter: createStandardRateLimitConfig(
    10,
    90,
    "clubs-milestones-create",
    "loresafe:rl:clubs:milestones:create:"
  ),
  clubMilestoneMutationRateLimiter: createStandardRateLimitConfig(
    10,
    120,
    "clubs-milestones-mutate",
    "loresafe:rl:clubs:milestones:mutate:"
  ),
  clubPostCreateRateLimiter: createStandardRateLimitConfig(
    10,
    90,
    "clubs-posts-create",
    "loresafe:rl:clubs:posts:create:"
  ),
  postCommentCreateRateLimiter: createStandardRateLimitConfig(
    10,
    120,
    "posts-comments-create",
    "loresafe:rl:posts:comments:create:"
  ),
  postReactionToggleRateLimiter: createStandardRateLimitConfig(
    10,
    240,
    "posts-reactions-toggle",
    "loresafe:rl:posts:reactions:toggle:"
  ),
  reportCreateRateLimiter: createStandardRateLimitConfig(
    10,
    30,
    "reports-create",
    "loresafe:rl:reports:create:"
  ),
  searchRateLimiter: createStandardRateLimitConfig(
    10,
    360,
    "search",
    "loresafe:rl:search:"
  ),
  expensiveReadRateLimiter: createStandardRateLimitConfig(
    10,
    240,
    "reads-expensive",
    "loresafe:rl:reads:expensive:"
  ),
  publicSeoReadRateLimiter: createStandardRateLimitConfig(
    10,
    600,
    "public-seo-read",
    "loresafe:rl:public-seo:read:"
  ),
  moderationActionRateLimiter: createStandardRateLimitConfig(
    10,
    180,
    "moderation-actions",
    "loresafe:rl:moderation:actions:"
  ),
  contentRevealRateLimiter: createStandardRateLimitConfig(
    10,
    120,
    "content-reveal",
    "loresafe:rl:content:reveal:"
  ),
  notificationMutationRateLimiter: createStandardRateLimitConfig(
    10,
    180,
    "notifications-mutate",
    "loresafe:rl:notifications:mutate:"
  ),
  commentReactionToggleRateLimiter: createStandardRateLimitConfig(
    10,
    240,
    "comments-reactions-toggle",
    "loresafe:rl:comments:reactions:toggle:"
  ),
  clubProgressUpdateRateLimiter: createStandardRateLimitConfig(
    10,
    120,
    "clubs-progress-update",
    "loresafe:rl:clubs:progress:update:"
  ),
  inviteAcceptRateLimiter: createStandardRateLimitConfig(
    10,
    90,
    "invites-accept",
    "loresafe:rl:invites:accept:"
  )
} satisfies Record<string, StandardRateLimitConfig>;

type StandardRateLimiters = {
  [Name in keyof typeof standardRateLimitConfigs]: ReturnType<typeof rateLimit>;
};

export type RateLimiters = AuthRateLimiters & StandardRateLimiters;

export const createRateLimiters = (
  options: AuthRateLimiterOptions = {}
): RateLimiters => {
  const storeFactory = options.storeFactory ?? createUpstashRateLimitStore;
  const standardRateLimiters = Object.fromEntries(
    Object.entries(standardRateLimitConfigs).map(([name, limiterConfig]) => [
      name,
      createStandardRateLimiter(limiterConfig, storeFactory)
    ])
  ) as StandardRateLimiters;

  return {
    ...createAuthRateLimiters(options),
    ...standardRateLimiters
  };
};

const createStandardRateLimiter = (
  limiterConfig: StandardRateLimitConfig,
  storeFactory: AuthRateLimitStoreFactory
) =>
  rateLimit({
    windowMs: limiterConfig.windowMs,
    limit: limiterConfig.limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skipSuccessfulRequests: limiterConfig.skipSuccessfulRequests,
    store: storeFactory(limiterConfig.prefix),
    identifier: limiterConfig.identifier,
    handler: (_req, _res, next) => {
      next(new HttpError(429, "TOO_MANY_REQUESTS", rateLimitMessage));
    }
  });
