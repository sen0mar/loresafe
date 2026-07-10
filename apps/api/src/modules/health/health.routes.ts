import { Router } from "express";

import { createGetReadiness, getHealth } from "./health.controller.js";
import type { ReadinessDependencies } from "./readiness.service.js";
import type { AppEnv } from "../../config/env.js";
import { env } from "../../config/env.js";
import { createGetOperationsMetrics } from "./operations.controller.js";

export const createHealthRouter = (
  dependencies?: ReadinessDependencies,
  appEnv: AppEnv = env
) => {
  const healthRouter = Router();

  healthRouter.get("/", getHealth);
  healthRouter.get("/ready", createGetReadiness(dependencies));
  healthRouter.get("/metrics", createGetOperationsMetrics(appEnv));

  return healthRouter;
};

export const healthRouter = createHealthRouter();
