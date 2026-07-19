import type { RequestHandler } from "express";

import type { AppEnv } from "../../config/env.js";
import {
  checkReadiness,
  type ReadinessDependencies
} from "./readiness.service.js";

export type HealthResponse = {
  appName: string;
  status: "ok";
  timestamp: string;
};

export const createGetHealth =
  (appEnv: AppEnv): RequestHandler =>
  (_req, res) => {
    const response: HealthResponse = {
      appName: appEnv.APP_NAME,
      status: "ok",
      timestamp: new Date().toISOString()
    };

    res.json(response);
  };

export const createGetReadiness =
  (dependencies?: ReadinessDependencies): RequestHandler =>
  async (_req, res) => {
    const result = await checkReadiness(dependencies);

    res.status(result.status === "ready" ? 200 : 503).json({
      ...result,
      timestamp: new Date().toISOString()
    });
  };
