import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";

import { env } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./core/http/error-middleware.js";
import { requestIdMiddleware } from "./core/http/request-id.js";
import { healthRouter } from "./modules/health/health.routes.js";

const localDevOrigins = [env.CLIENT_ORIGIN, "http://localhost:5174"];

export const createApp = () => {
  const app = express();

  app.disable("x-powered-by");

  app.use(requestIdMiddleware);
  app.use(
    cors({
      origin:
        env.NODE_ENV === "production" ? env.CLIENT_ORIGIN : localDevOrigins,
      credentials: true
    })
  );
  app.use(express.json());
  app.use(cookieParser());

  app.use("/api/health", healthRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};

export const app = createApp();
