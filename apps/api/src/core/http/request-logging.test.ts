import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  renderOperationsMetrics,
  resetOperationsMetricsForTests
} from "../monitoring/operations-metrics.js";
import { requestLoggingMiddleware } from "./request-logging.js";

describe("requestLoggingMiddleware", () => {
  beforeEach(() => {
    resetOperationsMetricsForTests();
    vi.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(() => {
    resetOperationsMetricsForTests();
    vi.restoreAllMocks();
  });

  it("uses route templates and collapses unmatched paths", async () => {
    const app = express();
    const clubsRouter = express.Router();

    app.use(requestLoggingMiddleware);
    clubsRouter.get("/:clubId/posts", (_req, res) => {
      res.status(200).json({ ok: true });
    });
    app.use("/api/clubs", clubsRouter);
    app.use((_req, res) => {
      res.sendStatus(404);
    });

    await request(app).get("/api/clubs/first-club/posts");
    await request(app).get("/api/clubs/second-club/posts");
    await request(app).get("/api/unknown-one");
    await request(app).get("/api/unknown-two");

    const metrics = renderOperationsMetrics({ eventConnections: 0 });

    expect(metrics).toContain(
      'path="/api/clubs/:clubId/posts",status="200"} 2'
    );
    expect(metrics).toContain('path="unmatched",status="404"} 2');
    expect(metrics).not.toContain("first-club");
    expect(metrics).not.toContain("unknown-one");
  });
});
