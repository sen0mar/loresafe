import { Router } from "express";

import { createGetHealth, createGetReadiness } from "./health.controller.js";
import type { ReadinessDependencies } from "./readiness.service.js";
import type { AppEnv } from "../../config/env.js";
import { env } from "../../config/env.js";
import { createGetOperationsMetrics } from "./operations.controller.js";

export const createHealthRouter = (
  dependencies?: ReadinessDependencies,
  appEnv: AppEnv = env
) => {
  const healthRouter = Router();

  healthRouter.get("/", createGetHealth(appEnv));
  healthRouter.get("/ready", createGetReadiness(dependencies));
  healthRouter.get("/metrics", createGetOperationsMetrics(appEnv));

  return healthRouter;
};
