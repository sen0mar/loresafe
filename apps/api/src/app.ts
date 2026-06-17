import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";

import { env } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./core/http/error-middleware.js";
import { requestLoggingMiddleware } from "./core/http/request-logging.js";
import { requestIdMiddleware } from "./core/http/request-id.js";
import {
  clubCreateRateLimiter,
  clubInviteCreateRateLimiter,
  clubJoinRateLimiter,
  clubMemberManagementRateLimiter,
  clubMilestoneCreateRateLimiter,
  clubPostCreateRateLimiter,
  clubProgressUpdateRateLimiter,
  commentReactionToggleRateLimiter,
  inviteAcceptRateLimiter,
  loginRateLimiter,
  logoutRateLimiter,
  moderationActionRateLimiter,
  postCommentCreateRateLimiter,
  postReactionToggleRateLimiter,
  profileUpdateRateLimiter,
  publicAssetUploadRateLimiter,
  reportCreateRateLimiter,
  searchRateLimiter,
  signupRateLimiter
} from "./core/security/rate-limit.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { clubsRouter } from "./modules/clubs/clubs.routes.js";
import { dashboardRouter } from "./modules/dashboard/dashboard.routes.js";
import {
  commentReactionsRouter,
  commentsRouter
} from "./modules/comments/comments.routes.js";
import { debugRouter } from "./modules/debug/debug.routes.js";
import { eventsRouter } from "./modules/events/events.routes.js";
import { healthRouter } from "./modules/health/health.routes.js";
import {
  clubInvitesRouter,
  invitesRouter
} from "./modules/invites/invites.routes.js";
import { milestonesRouter } from "./modules/milestones/milestones.routes.js";
import { notificationsRouter } from "./modules/notifications/notifications.routes.js";
import {
  postDetailsRouter,
  postsRouter
} from "./modules/posts/posts.routes.js";
import { progressRouter } from "./modules/progress/progress.routes.js";
import {
  clubReportsRouter,
  reportsRouter
} from "./modules/reports/reports.routes.js";
import { searchRouter } from "./modules/search/search.routes.js";
import { uploadsRouter } from "./modules/uploads/uploads.routes.js";
import { usersRouter } from "./modules/users/users.routes.js";

const localDevOrigins = [env.CLIENT_ORIGIN, "http://localhost:5174"];

export const createApp = () => {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", env.TRUST_PROXY_HOPS);

  app.use(requestIdMiddleware);
  app.use(requestLoggingMiddleware);
  app.use(
    cors({
      origin:
        env.NODE_ENV === "production" ? env.CLIENT_ORIGIN : localDevOrigins,
      credentials: true
    })
  );

  // Keep auth limiters before JSON parsing so blocked requests avoid expensive auth work.
  app.use("/api/auth/login", loginRateLimiter);
  app.use("/api/auth/logout", logoutRateLimiter);
  app.use("/api/auth/signup", signupRateLimiter);
  app.post("/api/clubs", clubCreateRateLimiter);
  app.post("/api/clubs/:slug/invites", clubInviteCreateRateLimiter);
  app.post("/api/clubs/:slug/join", clubJoinRateLimiter);
  app.patch(
    "/api/clubs/:slug/members/:membershipId/role",
    clubMemberManagementRateLimiter
  );
  app.post(
    "/api/clubs/:slug/members/:membershipId/ban",
    clubMemberManagementRateLimiter
  );
  app.post(
    "/api/clubs/:slug/members/:membershipId/unban",
    clubMemberManagementRateLimiter
  );
  app.post("/api/clubs/:slug/milestones", clubMilestoneCreateRateLimiter);
  app.post(
    "/api/clubs/:slug/milestones/templates",
    clubMilestoneCreateRateLimiter
  );
  app.post("/api/clubs/:slug/posts", clubPostCreateRateLimiter);
  app.post("/api/posts/:postId/comments", postCommentCreateRateLimiter);
  app.post(
    "/api/comments/:commentId/reactions/toggle",
    commentReactionToggleRateLimiter
  );
  app.post(
    "/api/posts/:postId/reactions/toggle",
    postReactionToggleRateLimiter
  );
  app.post("/api/reports", reportCreateRateLimiter);
  app.get("/api/search", searchRateLimiter);
  app.patch(
    "/api/clubs/:slug/moderation/reports/:reportId/required-milestone",
    moderationActionRateLimiter
  );
  app.post(
    "/api/clubs/:slug/moderation/reports/:reportId/hide",
    moderationActionRateLimiter
  );
  app.post(
    "/api/clubs/:slug/moderation/reports/:reportId/delete",
    moderationActionRateLimiter
  );
  app.post(
    "/api/clubs/:slug/moderation/reports/:reportId/warn",
    moderationActionRateLimiter
  );
  app.post(
    "/api/clubs/:slug/moderation/reports/:reportId/ban",
    moderationActionRateLimiter
  );
  app.patch(
    "/api/clubs/:slug/moderation/reports/:reportId/resolve",
    moderationActionRateLimiter
  );
  app.patch("/api/clubs/:slug/progress", clubProgressUpdateRateLimiter);
  app.post("/api/clubs/:slug/progress/next", clubProgressUpdateRateLimiter);
  app.post("/api/invites/:token/accept", inviteAcceptRateLimiter);
  app.patch("/api/users/me", profileUpdateRateLimiter);
  app.post("/api/uploads/public-assets", publicAssetUploadRateLimiter);
  app.post("/api/uploads/:assetId/complete", publicAssetUploadRateLimiter);
  app.use(express.json({ limit: "64kb" }));
  app.use(cookieParser());

  app.use("/api/health", healthRouter);
  app.use("/api/debug", debugRouter);
  app.use("/api/auth", authRouter);
  app.use("/api/events", eventsRouter);
  app.use("/api/uploads", uploadsRouter);
  app.use("/api/notifications", notificationsRouter);
  app.use("/api/search", searchRouter);
  app.use("/api/reports", reportsRouter);
  app.use("/api/clubs", clubReportsRouter);
  app.use("/api/posts", commentsRouter);
  app.use("/api/comments", commentReactionsRouter);
  app.use("/api/posts", postDetailsRouter);
  app.use("/api/clubs", dashboardRouter);
  app.use("/api/clubs", progressRouter);
  app.use("/api/clubs", postsRouter);
  app.use("/api/clubs", milestonesRouter);
  app.use("/api/clubs", clubsRouter);
  app.use("/api/clubs", clubInvitesRouter);
  app.use("/api/invites", invitesRouter);
  app.use("/api/users", usersRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};

export const app = createApp();
