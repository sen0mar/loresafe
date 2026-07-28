import cookieParser from "cookie-parser";
import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { errorHandler } from "../../core/http/error-middleware.js";
import { createAuthController } from "./auth.controller.js";
import { RefreshTokenReuseError, type AuthService } from "./auth.service.js";

describe("refresh replay response", () => {
  it("disconnects live events and clears cookies after family compromise", async () => {
    const userId = crypto.randomUUID();
    const disconnectUser = vi.fn(async () => undefined);
    const service = {
      refresh: vi.fn(async () => {
        throw new RefreshTokenReuseError(userId);
      })
    } as unknown as AuthService;
    const controller = createAuthController(service, {
      disconnectUser
    });
    const app = express();

    app.use(cookieParser());
    app.post("/api/auth/refresh", controller.refresh);
    app.use(errorHandler);

    const response = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", "loresafe_refresh_session=copied-token")
      .expect(401);

    expect(disconnectUser).toHaveBeenCalledWith(userId);
    expect(response.headers["set-cookie"]).toHaveLength(2);
  });
});
