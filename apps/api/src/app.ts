import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";

import { env } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./core/http/error-middleware.js";
import { requestIdMiddleware } from "./core/http/request-id.js";
import {
  loginRateLimiter,
  logoutRateLimiter,
  profileUpdateRateLimiter,
  signupRateLimiter
} from "./core/security/rate-limit.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { healthRouter } from "./modules/health/health.routes.js";
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
  app.patch("/api/users/me", profileUpdateRateLimiter);
  app.use(express.json({ limit: "64kb" }));
  app.use(cookieParser());

  app.use("/api/health", healthRouter);
  app.use("/api/auth", authRouter);
  app.use("/api/users", usersRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};

export const app = createApp();
