import cookieParser from "cookie-parser";
import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import { env } from "../../config/env.js";
import { errorHandler } from "../../core/http/error-middleware.js";
import { requestIdMiddleware } from "../../core/http/request-id.js";
import { createAuthController } from "./auth.controller.js";
import {
  type AuthUserRecord,
  type AuthUsersRepository,
  type CreateAuthUserInput
} from "./auth.repository.js";
import { createAuthRouter } from "./auth.routes.js";
import { createAuthService } from "./auth.service.js";

describe("auth routes", () => {
  let repository: InMemoryAuthUsersRepository;
  let app: express.Express;

  beforeEach(() => {
    repository = new InMemoryAuthUsersRepository();
    app = createAuthTestApp(repository);
  });

  it("creates a user and sends an HttpOnly session cookie", async () => {
    const response = await request(app)
      .post("/api/auth/signup")
      .set("x-request-id", "signup-success")
      .send({
        email: "Reader@Example.com",
        displayName: "New Reader",
        password: "correct horse battery staple"
      })
      .expect(201);

    expect(response.body).toEqual({
      user: {
        id: expect.any(String),
        email: "reader@example.com",
        displayName: "New Reader",
        createdAt: expect.any(String),
        updatedAt: expect.any(String)
      }
    });
    expect(response.body.user).not.toHaveProperty("passwordHash");

    const storedUser = repository.usersByEmail.get("reader@example.com");
    expect(storedUser?.passwordHash).toMatch(/^\$argon2id\$/);

    const cookie = response.headers["set-cookie"]?.[0] ?? "";
    expect(cookie).toContain(`${env.SESSION_COOKIE_NAME}=`);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");

    if (env.SESSION_COOKIE_SECURE) {
      expect(cookie).toContain("Secure");
    } else {
      expect(cookie).not.toContain("Secure");
    }
  });

  it("rejects invalid signup payloads", async () => {
    const response = await request(app)
      .post("/api/auth/signup")
      .set("x-request-id", "signup-invalid")
      .send({
        email: "not-an-email",
        displayName: "N",
        password: "short"
      })
      .expect(400);

    expect(response.body).toEqual({
      error: {
        code: "BAD_REQUEST",
        message: "Check the signup fields and try again.",
        requestId: "signup-invalid"
      }
    });
  });

  it("rejects duplicate active emails", async () => {
    await repository.createUser({
      email: "duplicate@example.com",
      displayName: "Existing Reader",
      passwordHash: "$argon2id$v=19$hash"
    });

    const response = await request(app)
      .post("/api/auth/signup")
      .set("x-request-id", "signup-duplicate")
      .send({
        email: "duplicate@example.com",
        displayName: "New Reader",
        password: "correct horse battery staple"
      })
      .expect(409);

    expect(response.body).toEqual({
      error: {
        code: "CONFLICT",
        message: "An account with that email already exists.",
        requestId: "signup-duplicate"
      }
    });
  });
});

const createAuthTestApp = (repository: AuthUsersRepository) => {
  const app = express();
  const service = createAuthService(repository);
  const controller = createAuthController(service);

  app.use(requestIdMiddleware);
  app.use(express.json());
  app.use(cookieParser());
  app.use("/api/auth", createAuthRouter(controller));
  app.use(errorHandler);

  return app;
};

class InMemoryAuthUsersRepository implements AuthUsersRepository {
  readonly usersByEmail = new Map<
    string,
    AuthUserRecord & { passwordHash: string }
  >();

  findActiveUserByEmail = async (email: string) =>
    this.usersByEmail.get(email) ?? null;

  createUser = async ({ email, displayName, passwordHash }: CreateAuthUserInput) => {
    const now = new Date();
    const user = {
      id: crypto.randomUUID(),
      email,
      displayName,
      passwordHash,
      sessionVersion: 1,
      createdAt: now,
      updatedAt: now
    };

    this.usersByEmail.set(email, user);

    return user;
  };
}
