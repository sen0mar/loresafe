import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";

import { getAllowedCorsOrigins } from "./config/cors.js";
import { env } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./core/http/error-middleware.js";
import { noindexApiResponses } from "./core/http/seo-headers.js";
import { requestLoggingMiddleware } from "./core/http/request-logging.js";
import { requestIdMiddleware } from "./core/http/request-id.js";
import { registerRateLimiters } from "./core/security/rate-limit-routes.js";
import { createTrustedOriginMiddleware } from "./core/security/trusted-origin.js";
import { configureTrustedProxy } from "./core/security/trusted-proxy.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import {
  clubsRouter,
  publicClubsRouter
} from "./modules/clubs/clubs.routes.js";
import { dashboardRouter } from "./modules/dashboard/dashboard.routes.js";
import {
  commentReactionsRouter,
  commentsRouter
} from "./modules/comments/comments.routes.js";
import { debugRouter } from "./modules/debug/debug.routes.js";
import { eventsRouter } from "./modules/events/events.routes.js";
import { createHealthRouter } from "./modules/health/health.routes.js";
import type { ReadinessDependencies } from "./modules/health/readiness.service.js";
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
import { createSitemapRouter } from "./modules/seo/sitemap.routes.js";
import { uploadsRouter } from "./modules/uploads/uploads.routes.js";
import { usersRouter } from "./modules/users/users.routes.js";

export const createApp = (
  appEnv = env,
  readinessDependencies?: ReadinessDependencies
) => {
  const app = express();

  app.disable("x-powered-by");
  configureTrustedProxy(app, appEnv.TRUST_PROXY_CIDRS);

  app.use(requestIdMiddleware);
  app.use(requestLoggingMiddleware);
  app.use(
    cors({
      origin: getAllowedCorsOrigins(appEnv),
      credentials: true
    })
  );

  app.use("/api", noindexApiResponses);
  registerRateLimiters(app);
  app.use(createTrustedOriginMiddleware(appEnv));
  app.use(express.json({ limit: "64kb" }));
  app.use(cookieParser());

  app.use("/sitemap.xml", createSitemapRouter(undefined, appEnv));
  app.use("/api/health", createHealthRouter(readinessDependencies, appEnv));
  app.use("/api/debug", debugRouter);
  app.use("/api/public/clubs", publicClubsRouter);
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
