import cookieParser from "cookie-parser";
import express from "express";
import { SignJWT } from "jose";
import request from "supertest";
import type { Response } from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import { env } from "../../config/env.js";
import { errorHandler } from "../../core/http/error-middleware.js";
import { requestIdMiddleware } from "../../core/http/request-id.js";
import { hashPassword } from "../../core/security/password.js";
import { createSessionToken } from "../../core/security/session-token.js";
import { createAuthController } from "./auth.controller.js";
import { createAuthMiddleware } from "./auth.middleware.js";
import {
  type AuthUserCredentialsRecord,
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
    expect(response.body.user).not.toHaveProperty("sessionVersion");

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

  it("logs in an existing user and sends an HttpOnly session cookie", async () => {
    await repository.createUser({
      email: "reader@example.com",
      displayName: "Existing Reader",
      passwordHash: await hashPassword("correct horse battery staple")
    });

    const response = await request(app)
      .post("/api/auth/login")
      .set("x-request-id", "login-success")
      .send({
        email: "Reader@Example.com",
        password: "correct horse battery staple"
      })
      .expect(200);

    expect(response.body).toEqual({
      user: {
        id: expect.any(String),
        email: "reader@example.com",
        displayName: "Existing Reader",
        createdAt: expect.any(String),
        updatedAt: expect.any(String)
      }
    });
    expect(response.body.user).not.toHaveProperty("passwordHash");
    expect(response.body.user).not.toHaveProperty("sessionVersion");

    const cookie = response.headers["set-cookie"]?.[0] ?? "";
    expect(cookie).toContain(`${env.SESSION_COOKIE_NAME}=`);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
  });

  it("uses a generic auth error for unknown email and wrong password", async () => {
    await repository.createUser({
      email: "reader@example.com",
      displayName: "Existing Reader",
      passwordHash: await hashPassword("correct horse battery staple")
    });

    const unknownEmailResponse = await request(app)
      .post("/api/auth/login")
      .set("x-request-id", "login-unknown")
      .send({
        email: "missing@example.com",
        password: "correct horse battery staple"
      })
      .expect(401);

    expect(unknownEmailResponse.body).toEqual({
      error: {
        code: "UNAUTHORIZED",
        message: "Invalid credentials",
        requestId: "login-unknown"
      }
    });

    const wrongPasswordResponse = await request(app)
      .post("/api/auth/login")
      .set("x-request-id", "login-wrong-password")
      .send({
        email: "reader@example.com",
        password: "wrong password"
      })
      .expect(401);

    expect(wrongPasswordResponse.body).toEqual({
      error: {
        code: "UNAUTHORIZED",
        message: "Invalid credentials",
        requestId: "login-wrong-password"
      }
    });
  });

  it("clears the session cookie on logout", async () => {
    const response = await request(app)
      .post("/api/auth/logout")
      .set("x-request-id", "logout")
      .expect(204);

    const cookie = response.headers["set-cookie"]?.[0] ?? "";

    expect(cookie).toContain(`${env.SESSION_COOKIE_NAME}=`);
    expect(cookie).toContain("Expires=Thu, 01 Jan 1970");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
  });

  it("returns the current safe user profile for a valid session", async () => {
    const signupResponse = await request(app)
      .post("/api/auth/signup")
      .send({
        email: "reader@example.com",
        displayName: "New Reader",
        password: "correct horse battery staple"
      })
      .expect(201);

    const response = await request(app)
      .get("/api/auth/me")
      .set("Cookie", extractSessionCookie(signupResponse))
      .expect(200);

    expect(response.body).toEqual({
      user: {
        id: signupResponse.body.user.id,
        email: "reader@example.com",
        displayName: "New Reader",
        createdAt: expect.any(String),
        updatedAt: expect.any(String)
      }
    });
    expect(response.body.user).not.toHaveProperty("passwordHash");
    expect(response.body.user).not.toHaveProperty("sessionVersion");
    expect(response.body.user).not.toHaveProperty("deletedAt");
  });

  it("rejects missing, malformed, tampered, expired, and stale current-user sessions", async () => {
    await request(app)
      .get("/api/auth/me")
      .set("x-request-id", "me-missing")
      .expect(401)
      .expect({
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required",
          requestId: "me-missing"
        }
      });

    await request(app)
      .get("/api/auth/me")
      .set("x-request-id", "me-invalid")
      .set("Cookie", `${env.SESSION_COOKIE_NAME}=not-a-token`)
      .expect(401)
      .expect({
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required",
          requestId: "me-invalid"
        }
      });

    const user = await repository.createUser({
      email: "reader@example.com",
      displayName: "Existing Reader",
      passwordHash: await hashPassword("correct horse battery staple")
    });
    const validSessionToken = await createSessionToken({
      userId: user.id,
      sessionVersion: user.sessionVersion
    });
    const expiredSessionToken = await createExpiredSessionToken(user);

    await request(app)
      .get("/api/auth/me")
      .set("x-request-id", "me-tampered")
      .set(
        "Cookie",
        `${env.SESSION_COOKIE_NAME}=${tamperToken(validSessionToken)}`
      )
      .expect(401)
      .expect({
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required",
          requestId: "me-tampered"
        }
      });

    await request(app)
      .get("/api/auth/me")
      .set("x-request-id", "me-expired")
      .set("Cookie", `${env.SESSION_COOKIE_NAME}=${expiredSessionToken}`)
      .expect(401)
      .expect({
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required",
          requestId: "me-expired"
        }
      });

    const staleSessionToken = await createSessionToken({
      userId: user.id,
      sessionVersion: user.sessionVersion
    });
    const storedUser = repository.usersByEmail.get("reader@example.com");

    if (storedUser) {
      storedUser.sessionVersion += 1;
    }

    await request(app)
      .get("/api/auth/me")
      .set("x-request-id", "me-stale")
      .set("Cookie", `${env.SESSION_COOKIE_NAME}=${staleSessionToken}`)
      .expect(401)
      .expect({
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required",
          requestId: "me-stale"
        }
      });
  });
});

const createAuthTestApp = (repository: AuthUsersRepository) => {
  const app = express();
  const service = createAuthService(repository);
  const controller = createAuthController(service);
  const middleware = createAuthMiddleware(service);

  app.use(requestIdMiddleware);
  app.use(express.json());
  app.use(cookieParser());
  app.use("/api/auth", createAuthRouter(controller, middleware));
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

  findActiveUserById = async (id: string) => {
    for (const user of this.usersByEmail.values()) {
      if (user.id === id) {
        return user;
      }
    }

    return null;
  };

  findActiveUserCredentialsByEmail = async (
    email: string
  ): Promise<AuthUserCredentialsRecord | null> =>
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

const extractSessionCookie = (response: Response) => {
  const cookie = response.headers["set-cookie"]?.[0];

  if (!cookie) {
    throw new Error("Expected response to include a session cookie.");
  }

  return cookie.split(";")[0];
};

const tamperToken = (token: string) => {
  const parts = token.split(".");
  const signature = parts[2] ?? "";
  const replacement = signature.endsWith("a") ? "b" : "a";

  parts[2] = `${signature.slice(0, -1)}${replacement}`;

  return parts.join(".");
};

const createExpiredSessionToken = (user: AuthUserRecord) => {
  const secretKey = new TextEncoder().encode(env.JWT_SECRET);
  const now = Math.floor(Date.now() / 1000);

  return new SignJWT({ sessionVersion: user.sessionVersion })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(user.id)
    .setIssuedAt(now - 120)
    .setExpirationTime(now - 60)
    .sign(secretKey);
};
