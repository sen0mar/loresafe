import { timingSafeEqual } from "node:crypto";
import type { RequestHandler } from "express";

import type { AppEnv } from "../../config/env.js";
import { renderOperationsMetrics } from "../../core/monitoring/operations-metrics.js";
import { eventsService } from "../events/events.service.js";

export const createGetOperationsMetrics =
  (appEnv: AppEnv): RequestHandler =>
  (req, res) => {
    const configuredToken = appEnv.OPERATIONS_BEARER_TOKEN;
    const suppliedToken = req.get("authorization")?.replace(/^Bearer\s+/i, "");

    if (
      !configuredToken ||
      !suppliedToken ||
      !tokensMatch(configuredToken, suppliedToken)
    ) {
      res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Route not found",
          requestId: res.locals.requestId
        }
      });
      return;
    }

    const eventStatus = eventsService.getStatus?.() ?? {
      connectionCount: 0,
      ready: false
    };
    res.type("text/plain; version=0.0.4; charset=utf-8").send(
      renderOperationsMetrics({
        eventConnections: eventStatus.connectionCount
      })
    );
  };

const tokensMatch = (expected: string, actual: string) => {
  const expectedBytes = Buffer.from(expected);
  const actualBytes = Buffer.from(actual);

  return (
    expectedBytes.length === actualBytes.length &&
    timingSafeEqual(expectedBytes, actualBytes)
  );
};
