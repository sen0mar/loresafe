import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { requestIdMiddleware } from "./request-id.js";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const createApp = () => {
  const app = express();

  app.use(requestIdMiddleware);
  app.get("/", (_req, res) => {
    res.json({ requestId: res.locals.requestId });
  });

  return app;
};

describe("requestIdMiddleware", () => {
  it("retains a bounded safe upstream correlation ID", async () => {
    const response = await request(createApp())
      .get("/")
      .set("x-request-id", "edge:4f90a3d2-7");

    expect(response.status).toBe(200);
    expect(response.headers["x-request-id"]).toBe("edge:4f90a3d2-7");
    expect(response.body.requestId).toBe("edge:4f90a3d2-7");
  });

  it.each([
    ["oversized", "a".repeat(65)],
    ["invalid characters", "request-id-with-a-newline%0a"],
    ["whitespace only", "   "]
  ])("replaces an %s client ID with a server UUID", async (_label, value) => {
    const response = await request(createApp())
      .get("/")
      .set("x-request-id", value);

    expect(response.status).toBe(200);
    expect(response.headers["x-request-id"]).toMatch(uuidPattern);
    expect(response.headers["x-request-id"]).not.toBe(value);
    expect(response.body.requestId).toBe(response.headers["x-request-id"]);
  });

  it("treats repeated valid client IDs as correlation labels, not unique keys", async () => {
    const app = createApp();
    const collisionId = "edge-collision-1";
    const firstResponse = await request(app)
      .get("/")
      .set("x-request-id", collisionId);
    const secondResponse = await request(app)
      .get("/")
      .set("x-request-id", collisionId);

    expect(firstResponse.headers["x-request-id"]).toBe(collisionId);
    expect(secondResponse.headers["x-request-id"]).toBe(collisionId);
  });
});
