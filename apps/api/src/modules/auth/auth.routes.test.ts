import cookieParser from "cookie-parser";
import express from "express";
import type {
  ClientRateLimitInfo,
  Options as RateLimitOptions,
  Store
} from "express-rate-limit";
import { SignJWT } from "jose";
import request from "supertest";
import type { Response } from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import { env } from "../../config/env.js";
import { normalizeNameReservationKey } from "../../core/identity/user-names.js";
import { errorHandler } from "../../core/http/error-middleware.js";
import { requestIdMiddleware } from "../../core/http/request-id.js";
import {
  createAuthRateLimiters,
  type AuthRateLimiterOptions,
  type AuthRateLimiters
} from "../../core/security/rate-limit.js";
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
        username: "New_Reader",
        password: "correct horse battery staple"
      })
      .expect(201);

    expect(response.body).toEqual({
      user: {
        id: expect.any(String),
        email: "reader@example.com",
        displayName: "new_reader",
        username: "new_reader",
        bio: null,
        avatarUrl: null,
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
        username: "not ok",
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
        username: "new_reader",
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

  it("rejects usernames reserved by active display names", async () => {
    await repository.createUser({
      email: "existing@example.com",
      displayName: "Existing Reader",
      passwordHash: "$argon2id$v=19$hash"
    });

    const response = await request(app)
      .post("/api/auth/signup")
      .set("x-request-id", "signup-reserved-name")
      .send({
        email: "new@example.com",
        username: "existing_reader",
        password: "correct horse battery staple"
      })
      .expect(409);

    expect(response.body).toEqual({
      error: {
        code: "CONFLICT",
        message: "That username is already taken.",
        requestId: "signup-reserved-name"
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
        username: "existing_reader",
        bio: null,
        avatarUrl: null,
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

  it("rate limits repeated failed login attempts before credential lookup", async () => {
    app = createAuthTestApp(repository, {
      rateLimiters: createAuthTestRateLimiters({ login: 2 })
    });

    await repository.createUser({
      email: "reader@example.com",
      displayName: "Existing Reader",
      passwordHash: await hashPassword("correct horse battery staple")
    });

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      await request(app)
        .post("/api/auth/login")
        .set("x-request-id", `login-failed-${attempt}`)
        .send({
          email: "reader@example.com",
          password: "wrong password"
        })
        .expect(401);
    }

    const limitedResponse = await request(app)
      .post("/api/auth/login")
      .set("x-request-id", "login-limited")
      .send({
        email: "reader@example.com",
        password: "wrong password"
      })
      .expect(429);

    expect(limitedResponse.body).toEqual({
      error: {
        code: "TOO_MANY_REQUESTS",
        message: "Too many attempts. Try again later.",
        requestId: "login-limited"
      }
    });
    expect(repository.credentialLookupCount).toBe(2);
  });

  it("does not count successful logins against the failed-login limiter", async () => {
    app = createAuthTestApp(repository, {
      rateLimiters: createAuthTestRateLimiters({ login: 1 })
    });

    await repository.createUser({
      email: "reader@example.com",
      displayName: "Existing Reader",
      passwordHash: await hashPassword("correct horse battery staple")
    });

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      await request(app)
        .post("/api/auth/login")
        .set("x-request-id", `login-success-${attempt}`)
        .send({
          email: "reader@example.com",
          password: "correct horse battery staple"
        })
        .expect(200);
      await waitForRateLimitDecrement();
    }
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

  it("rate limits signup with the shared 429 response shape", async () => {
    app = createAuthTestApp(repository, {
      rateLimiters: createAuthTestRateLimiters({ signup: 1 })
    });

    await request(app)
      .post("/api/auth/signup")
      .set("x-request-id", "signup-first")
      .send({
        email: "reader@example.com",
        username: "new_reader",
        password: "correct horse battery staple"
      })
      .expect(201);

    const limitedResponse = await request(app)
      .post("/api/auth/signup")
      .set("x-request-id", "signup-limited")
      .send({
        email: "another@example.com",
        username: "another_reader",
        password: "correct horse battery staple"
      })
      .expect(429);

    expect(limitedResponse.body).toEqual({
      error: {
        code: "TOO_MANY_REQUESTS",
        message: "Too many attempts. Try again later.",
        requestId: "signup-limited"
      }
    });
  });

  it("rate limits logout with the shared 429 response shape", async () => {
    app = createAuthTestApp(repository, {
      rateLimiters: createAuthTestRateLimiters({ logout: 1 })
    });

    await request(app)
      .post("/api/auth/logout")
      .set("x-request-id", "logout-first")
      .expect(204);

    const limitedResponse = await request(app)
      .post("/api/auth/logout")
      .set("x-request-id", "logout-limited")
      .expect(429);

    expect(limitedResponse.body).toEqual({
      error: {
        code: "TOO_MANY_REQUESTS",
        message: "Too many attempts. Try again later.",
        requestId: "logout-limited"
      }
    });
  });

  it("returns the current safe user profile for a valid session", async () => {
    const signupResponse = await request(app)
      .post("/api/auth/signup")
      .send({
        email: "reader@example.com",
        username: "new_reader",
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
        displayName: "new_reader",
        username: "new_reader",
        bio: null,
        avatarUrl: null,
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

const createAuthTestApp = (
  repository: AuthUsersRepository,
  options: { rateLimiters?: AuthRateLimiters } = {}
) => {
  const app = express();
  const service = createAuthService(repository);
  const controller = createAuthController(service);
  const middleware = createAuthMiddleware(service);

  app.use(requestIdMiddleware);

  if (options.rateLimiters) {
    app.use("/api/auth/login", options.rateLimiters.loginRateLimiter);
    app.use("/api/auth/logout", options.rateLimiters.logoutRateLimiter);
    app.use("/api/auth/signup", options.rateLimiters.signupRateLimiter);
  }

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
  readonly nameReservations = new Map<string, string>();
  credentialLookupCount = 0;

  findActiveUserByEmail = async (email: string) =>
    this.usersByEmail.get(email) ?? null;

  findActiveUserByReservedName = async (normalizedName: string) => {
    const userId = this.nameReservations.get(normalizedName);

    if (!userId) {
      return null;
    }

    for (const user of this.usersByEmail.values()) {
      if (user.id === userId) {
        return user;
      }
    }

    return null;
  };

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
  ): Promise<AuthUserCredentialsRecord | null> => {
    this.credentialLookupCount += 1;

    return this.usersByEmail.get(email) ?? null;
  };

  createUser = async ({
    email,
    displayName,
    username,
    passwordHash
  }: CreateAuthUserInput) => {
    const now = new Date();
    const lockedUsername = username ?? toTestUsername(displayName);
    const user = {
      id: crypto.randomUUID(),
      email,
      displayName,
      username: lockedUsername,
      bio: null,
      passwordHash,
      sessionVersion: 1,
      createdAt: now,
      updatedAt: now
    };

    this.usersByEmail.set(email, user);
    this.reserveName(displayName, user.id);
    this.reserveName(lockedUsername, user.id);

    return user;
  };

  private reserveName = (name: string, userId: string) => {
    this.nameReservations.set(normalizeNameReservationKey(name), userId);
  };
}

const toTestUsername = (displayName: string) => {
  const username = displayName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return username.length >= 3 ? username.slice(0, 30) : "user";
};

type InMemoryRateLimitClient = {
  resetTime: Date;
  totalHits: number;
};

class InMemoryRateLimitStore implements Store {
  private clients = new Map<string, InMemoryRateLimitClient>();
  private windowMs = 0;

  init = (options: RateLimitOptions) => {
    this.windowMs = options.windowMs;
  };

  increment = (key: string) => {
    const now = Date.now();
    const currentClient = this.clients.get(key);

    if (!currentClient || currentClient.resetTime.getTime() <= now) {
      const nextClient = {
        totalHits: 1,
        resetTime: new Date(now + this.windowMs)
      };

      this.clients.set(key, nextClient);

      return nextClient;
    }

    currentClient.totalHits += 1;

    return currentClient;
  };

  decrement = (key: string) => {
    const currentClient = this.clients.get(key);

    if (!currentClient) {
      return;
    }

    currentClient.totalHits = Math.max(currentClient.totalHits - 1, 0);
  };

  resetKey = (key: string) => {
    this.clients.delete(key);
  };
}

const createAuthTestRateLimiters = (
  limitOverrides: AuthRateLimiterOptions["limitOverrides"]
) =>
  createAuthRateLimiters({
    limitOverrides,
    storeFactory: () => new InMemoryRateLimitStore()
  });

const waitForRateLimitDecrement = () =>
  new Promise((resolve) => {
    setImmediate(resolve);
  });

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
  const replacement = signature.startsWith("a") ? "b" : "a";

  parts[2] = `${replacement}${signature.slice(1)}`;

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
