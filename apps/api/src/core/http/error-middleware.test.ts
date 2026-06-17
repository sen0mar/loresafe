import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { errorHandler } from "./error-middleware.js";
import { requestIdMiddleware } from "./request-id.js";

describe("error middleware", () => {
  it("returns a safe shared error shape for unexpected errors", async () => {
    const app = express();

    app.use(requestIdMiddleware);
    app.get("/api/debug/:token", () => {
      throw new Error("database failed with password hunter2");
    });
    app.use(errorHandler);

    const response = await request(app)
      .get("/api/debug/super-secret-token")
      .set("x-request-id", "unexpected-safe-shape")
      .expect(500);

    expect(response.body).toEqual({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Internal server error",
        requestId: "unexpected-safe-shape"
      }
    });
  });
});
