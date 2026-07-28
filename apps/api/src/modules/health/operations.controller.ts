import type { RequestHandler } from "express";

import { renderOperationsMetrics } from "../../core/monitoring/operations-metrics.js";
import { eventsService } from "../events/events.service.js";

export const getOperationsMetrics: RequestHandler = (_req, res) => {
  res.type("text/plain; version=0.0.4; charset=utf-8").send(
    renderOperationsMetrics({
      eventConnections: eventsService.getConnectionCount()
    })
  );
};
