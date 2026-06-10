import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../../app.js";

describe("health routes", () => {
  const app = createApp();

  it("returns live API health metadata", async () => {
    const response = await request(app).get("/api/health").expect(200);

    expect(response.body).toMatchObject({
      appName: "ThreadSync",
      status: "ok"
    });
    expect(new Date(response.body.timestamp).toISOString()).toBe(
      response.body.timestamp
    );
    expect(response.headers["x-request-id"]).toEqual(expect.any(String));
  });

  it("allows the Vite fallback dev origin", async () => {
    const response = await request(app)
      .get("/api/health")
      .set("Origin", "http://localhost:5174")
      .expect(200);

    expect(response.headers["access-control-allow-origin"]).toBe(
      "http://localhost:5174"
    );
    expect(response.headers["access-control-allow-credentials"]).toBe("true");
  });

  it("returns the shared error shape for unknown API routes", async () => {
    const response = await request(app)
      .get("/api/missing")
      .set("x-request-id", "test-request-id")
      .expect(404);

    expect(response.body).toEqual({
      error: {
        code: "NOT_FOUND",
        message: "Route not found",
        requestId: "test-request-id"
      }
    });
  });
});
