import type { RequestHandler } from "express";

import { env } from "../../config/env.js";

export type HealthResponse = {
  appName: string;
  status: "ok";
  timestamp: string;
};

export const getHealth: RequestHandler = (_req, res) => {
  const response: HealthResponse = {
    appName: env.APP_NAME,
    status: "ok",
    timestamp: new Date().toISOString()
  };

  res.json(response);
};
