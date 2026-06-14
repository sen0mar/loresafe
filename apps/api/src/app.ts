import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";

import { env } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./core/http/error-middleware.js";
import { requestIdMiddleware } from "./core/http/request-id.js";
import {
  clubCreateRateLimiter,
  clubInviteCreateRateLimiter,
  clubJoinRateLimiter,
  clubMilestoneCreateRateLimiter,
  clubProgressUpdateRateLimiter,
  inviteAcceptRateLimiter,
  loginRateLimiter,
  logoutRateLimiter,
  profileUpdateRateLimiter,
  signupRateLimiter
} from "./core/security/rate-limit.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { clubsRouter } from "./modules/clubs/clubs.routes.js";
import { healthRouter } from "./modules/health/health.routes.js";
import {
  clubInvitesRouter,
  invitesRouter
} from "./modules/invites/invites.routes.js";
import { milestonesRouter } from "./modules/milestones/milestones.routes.js";
import { postsRouter } from "./modules/posts/posts.routes.js";
import { progressRouter } from "./modules/progress/progress.routes.js";
import { usersRouter } from "./modules/users/users.routes.js";

const localDevOrigins = [env.CLIENT_ORIGIN, "http://localhost:5174"];

export const createApp = () => {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", env.TRUST_PROXY_HOPS);

  app.use(requestIdMiddleware);
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
  app.post("/api/clubs/:slug/milestones", clubMilestoneCreateRateLimiter);
  app.post(
    "/api/clubs/:slug/milestones/templates",
    clubMilestoneCreateRateLimiter
  );
  app.patch("/api/clubs/:slug/progress", clubProgressUpdateRateLimiter);
  app.post("/api/clubs/:slug/progress/next", clubProgressUpdateRateLimiter);
  app.post("/api/invites/:token/accept", inviteAcceptRateLimiter);
  app.patch("/api/users/me", profileUpdateRateLimiter);
  app.use(express.json({ limit: "64kb" }));
  app.use(cookieParser());

  app.use("/api/health", healthRouter);
  app.use("/api/auth", authRouter);
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
