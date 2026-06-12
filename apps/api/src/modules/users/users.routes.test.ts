import cookieParser from "cookie-parser";
import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import { env } from "../../config/env.js";
import { errorHandler } from "../../core/http/error-middleware.js";
import { requestIdMiddleware } from "../../core/http/request-id.js";
import { createSessionToken } from "../../core/security/session-token.js";
import { createAuthController } from "../auth/auth.controller.js";
import { createAuthMiddleware } from "../auth/auth.middleware.js";
import {
  type AuthUserCredentialsRecord,
  type AuthUserRecord,
  type AuthUsersRepository,
  type CreateAuthUserInput
} from "../auth/auth.repository.js";
import { createAuthRouter } from "../auth/auth.routes.js";
import { createAuthService } from "../auth/auth.service.js";
import {
  type UpdateCurrentUserProfileInput,
  type UsersRepository
} from "./users.repository.js";
import { createUsersController } from "./users.controller.js";
import { createUsersRouter } from "./users.routes.js";
import { createUsersService } from "./users.service.js";

describe("users routes", () => {
  let repository: InMemoryUsersRepository;
  let app: express.Express;

  beforeEach(() => {
    repository = new InMemoryUsersRepository();
    app = createUsersTestApp(repository);
  });

  it("updates the authenticated user's profile and returns the persisted current user", async () => {
    const user = await repository.createUser({
      email: "reader@example.com",
      displayName: "Existing Reader",
      passwordHash: "$argon2id$v=19$hash"
    });

    const response = await request(app)
      .patch("/api/users/me")
      .set("Cookie", await createSessionCookie(user))
      .send({
        displayName: "  Updated Reader  ",
        username: " Story_Fan ",
        bio: "  Safe discussions only.  "
      })
      .expect(200);

    expect(response.body).toEqual({
      user: {
        id: user.id,
        email: "reader@example.com",
        displayName: "Updated Reader",
        username: "story_fan",
        bio: "Safe discussions only.",
        createdAt: expect.any(String),
        updatedAt: expect.any(String)
      }
    });

    const meResponse = await request(app)
      .get("/api/auth/me")
      .set("Cookie", await createSessionCookie(user))
      .expect(200);

    expect(meResponse.body.user).toMatchObject({
      id: user.id,
      displayName: "Updated Reader",
      username: "story_fan",
      bio: "Safe discussions only."
    });
  });

  it("rejects profile updates without an authenticated session", async () => {
    const response = await request(app)
      .patch("/api/users/me")
      .set("x-request-id", "profile-missing-session")
      .send({
        displayName: "Updated Reader"
      })
      .expect(401);

    expect(response.body).toEqual({
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required",
        requestId: "profile-missing-session"
      }
    });
  });

  it("rejects empty and invalid profile payloads with useful errors", async () => {
    const user = await repository.createUser({
      email: "reader@example.com",
      displayName: "Existing Reader",
      passwordHash: "$argon2id$v=19$hash"
    });
    const cookie = await createSessionCookie(user);

    const emptyResponse = await request(app)
      .patch("/api/users/me")
      .set("x-request-id", "profile-empty")
      .set("Cookie", cookie)
      .send({})
      .expect(400);

    expect(emptyResponse.body).toEqual({
      error: {
        code: "BAD_REQUEST",
        message: "Send at least one profile field to update.",
        requestId: "profile-empty"
      }
    });

    const invalidResponse = await request(app)
      .patch("/api/users/me")
      .set("x-request-id", "profile-invalid")
      .set("Cookie", cookie)
      .send({
        displayName: "",
        username: "not ok",
        bio: "x".repeat(161)
      })
      .expect(400);

    expect(invalidResponse.body).toEqual({
      error: {
        code: "BAD_REQUEST",
        message: "Check the profile fields and try again.",
        requestId: "profile-invalid"
      }
    });
  });

  it("rejects duplicate active usernames", async () => {
    const user = await repository.createUser({
      email: "reader@example.com",
      displayName: "Existing Reader",
      passwordHash: "$argon2id$v=19$hash"
    });
    const otherUser = await repository.createUser({
      email: "other@example.com",
      displayName: "Other Reader",
      passwordHash: "$argon2id$v=19$hash"
    });

    await repository.updateActiveUserProfile(otherUser.id, {
      username: "taken"
    });

    const response = await request(app)
      .patch("/api/users/me")
      .set("x-request-id", "profile-duplicate")
      .set("Cookie", await createSessionCookie(user))
      .send({
        username: "TAKEN"
      })
      .expect(409);

    expect(response.body).toEqual({
      error: {
        code: "CONFLICT",
        message: "That username is already taken.",
        requestId: "profile-duplicate"
      }
    });
  });

  it("stores an empty bio as null", async () => {
    const user = await repository.createUser({
      email: "reader@example.com",
      displayName: "Existing Reader",
      passwordHash: "$argon2id$v=19$hash"
    });

    const response = await request(app)
      .patch("/api/users/me")
      .set("Cookie", await createSessionCookie(user))
      .send({
        bio: "   "
      })
      .expect(200);

    expect(response.body.user.bio).toBeNull();
  });
});

const createUsersTestApp = (
  repository: AuthUsersRepository & UsersRepository
) => {
  const app = express();
  const authService = createAuthService(repository);
  const authController = createAuthController(authService);
  const authMiddleware = createAuthMiddleware(authService);
  const usersService = createUsersService(repository);
  const usersController = createUsersController(usersService);

  app.use(requestIdMiddleware);
  app.use(express.json());
  app.use(cookieParser());
  app.use("/api/auth", createAuthRouter(authController, authMiddleware));
  app.use("/api/users", createUsersRouter(usersController, authMiddleware));
  app.use(errorHandler);

  return app;
};

class InMemoryUsersRepository implements AuthUsersRepository, UsersRepository {
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

  findActiveUserByUsername = async (username: string) => {
    for (const user of this.usersByEmail.values()) {
      if (user.username === username) {
        return user;
      }
    }

    return null;
  };

  createUser = async ({
    email,
    displayName,
    passwordHash
  }: CreateAuthUserInput) => {
    const now = new Date();
    const user = {
      id: crypto.randomUUID(),
      email,
      displayName,
      username: null,
      bio: null,
      passwordHash,
      sessionVersion: 1,
      createdAt: now,
      updatedAt: now
    };

    this.usersByEmail.set(email, user);

    return user;
  };

  updateActiveUserProfile = async (
    userId: string,
    input: UpdateCurrentUserProfileInput
  ) => {
    let user: (AuthUserRecord & { passwordHash: string }) | null = null;

    for (const storedUser of this.usersByEmail.values()) {
      if (storedUser.id === userId) {
        user = storedUser;
        break;
      }
    }

    if (!user) {
      return null;
    }

    const updatedUser = {
      ...user,
      ...input,
      updatedAt: new Date()
    };

    this.usersByEmail.set(updatedUser.email, updatedUser);

    return updatedUser;
  };
}

const createSessionCookie = async (user: AuthUserRecord) => {
  const sessionToken = await createSessionToken({
    userId: user.id,
    sessionVersion: user.sessionVersion
  });

  return `${env.SESSION_COOKIE_NAME}=${sessionToken}`;
};
