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
  type JoinedClubRecord,
  type UpdateCurrentUserProfileInput,
  type UsersRepository
} from "./users.repository.js";
import { createUsersController } from "./users.controller.js";
import { createUsersRouter } from "./users.routes.js";
import { createUsersService } from "./users.service.js";
import type { ListCurrentUserClubsQuery } from "./users.schema.js";

describe("users routes", () => {
  let repository: InMemoryUsersRepository;
  let app: express.Express;

  beforeEach(() => {
    repository = new InMemoryUsersRepository();
    app = createUsersTestApp(repository);
  });

  it("rejects joined club reads without an authenticated session", async () => {
    const response = await request(app)
      .get("/api/users/me/clubs")
      .set("x-request-id", "joined-clubs-missing-session")
      .expect(401);

    expect(response.body).toEqual({
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required",
        requestId: "joined-clubs-missing-session"
      }
    });
  });

  it("returns all clubs joined by the current user with safe sidebar fields", async () => {
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
    const publicClub = repository.createClub({
      title: "Public Story Circle",
      slug: "public-story-circle",
      visibility: "PUBLIC"
    });
    const privateClub = repository.createClub({
      title: "Private Plot Room",
      slug: "private-plot-room",
      visibility: "PRIVATE"
    });
    const inviteOnlyClub = repository.createClub({
      title: "Invite Arc Watch",
      slug: "invite-arc-watch",
      visibility: "INVITE_ONLY"
    });
    const unjoinedClub = repository.createClub({
      title: "Unjoined Spoiler Room",
      slug: "unjoined-spoiler-room",
      visibility: "PRIVATE"
    });
    const publicJoinedAt = new Date("2026-01-01T00:00:00.000Z");
    const inviteJoinedAt = new Date("2026-01-02T00:00:00.000Z");
    const privateJoinedAt = new Date("2026-01-03T00:00:00.000Z");

    repository.createMembership(user.id, publicClub.id, "MEMBER", publicJoinedAt);
    repository.createMembership(
      user.id,
      inviteOnlyClub.id,
      "MODERATOR",
      inviteJoinedAt
    );
    repository.createMembership(user.id, privateClub.id, "OWNER", privateJoinedAt);
    repository.createMembership(otherUser.id, publicClub.id);
    repository.createMembership(otherUser.id, unjoinedClub.id);

    const response = await request(app)
      .get("/api/users/me/clubs")
      .set("Cookie", await createSessionCookie(user))
      .expect(200);

    expect(response.body).toEqual({
      clubs: [
        {
          id: privateClub.id,
          title: "Private Plot Room",
          slug: "private-plot-room",
          visibility: "PRIVATE",
          role: "OWNER",
          memberCount: 1,
          joinedAt: privateJoinedAt.toISOString()
        },
        {
          id: inviteOnlyClub.id,
          title: "Invite Arc Watch",
          slug: "invite-arc-watch",
          visibility: "INVITE_ONLY",
          role: "MODERATOR",
          memberCount: 1,
          joinedAt: inviteJoinedAt.toISOString()
        },
        {
          id: publicClub.id,
          title: "Public Story Circle",
          slug: "public-story-circle",
          visibility: "PUBLIC",
          role: "MEMBER",
          memberCount: 2,
          joinedAt: publicJoinedAt.toISOString()
        }
      ],
      pagination: {
        page: 1,
        limit: 20,
        total: 3,
        pageCount: 1
      }
    });
    expect(Object.keys(response.body.clubs[0]).sort()).toEqual(
      [
        "id",
        "joinedAt",
        "memberCount",
        "role",
        "slug",
        "title",
        "visibility"
      ].sort()
    );
    expect(JSON.stringify(response.body)).not.toContain("Unjoined Spoiler Room");
  });

  it("paginates joined clubs by newest membership first", async () => {
    const user = await repository.createUser({
      email: "reader@example.com",
      displayName: "Existing Reader",
      passwordHash: "$argon2id$v=19$hash"
    });

    const oldestClub = repository.createClub({
      title: "Oldest Club",
      slug: "oldest-club",
      visibility: "PUBLIC"
    });
    const middleClub = repository.createClub({
      title: "Middle Club",
      slug: "middle-club",
      visibility: "PUBLIC"
    });
    const newestClub = repository.createClub({
      title: "Newest Club",
      slug: "newest-club",
      visibility: "PUBLIC"
    });

    repository.createMembership(
      user.id,
      oldestClub.id,
      "MEMBER",
      new Date("2026-01-01T00:00:00.000Z")
    );
    repository.createMembership(
      user.id,
      middleClub.id,
      "MEMBER",
      new Date("2026-01-02T00:00:00.000Z")
    );
    repository.createMembership(
      user.id,
      newestClub.id,
      "MEMBER",
      new Date("2026-01-03T00:00:00.000Z")
    );

    const response = await request(app)
      .get("/api/users/me/clubs?page=2&limit=2")
      .set("Cookie", await createSessionCookie(user))
      .expect(200);

    expect(response.body.clubs.map((club: { slug: string }) => club.slug)).toEqual([
      "oldest-club"
    ]);
    expect(response.body.pagination).toEqual({
      page: 2,
      limit: 2,
      total: 3,
      pageCount: 2
    });
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
  readonly clubs = new Map<string, StoredClub>();
  readonly memberships: StoredMembership[] = [];

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

  createClub = ({
    title,
    slug,
    visibility,
    createdAt = new Date()
  }: CreateStoredClubInput) => {
    const club = {
      id: crypto.randomUUID(),
      title,
      slug,
      visibility,
      createdAt,
      updatedAt: createdAt
    };

    this.clubs.set(club.id, club);

    return club;
  };

  createMembership = (
    userId: string,
    clubId: string,
    role: StoredMembership["role"] = "MEMBER",
    createdAt = new Date()
  ) => {
    this.memberships.push({
      id: crypto.randomUUID(),
      userId,
      clubId,
      role,
      createdAt
    });
  };

  listJoinedClubsForUser = async (
    userId: string,
    { page, limit }: ListCurrentUserClubsQuery
  ) => {
    const joinedMemberships = this.memberships
      .filter((membership) => membership.userId === userId)
      .sort(
        (leftMembership, rightMembership) =>
          rightMembership.createdAt.getTime() -
            leftMembership.createdAt.getTime() ||
          leftMembership.id.localeCompare(rightMembership.id)
      );
    const start = (page - 1) * limit;
    const clubs: JoinedClubRecord[] = joinedMemberships
      .slice(start, start + limit)
      .map((membership) => {
        const club = this.clubs.get(membership.clubId);

        if (!club) {
          throw new Error(`Missing test club ${membership.clubId}`);
        }

        return {
          id: club.id,
          title: club.title,
          slug: club.slug,
          visibility: club.visibility,
          role: membership.role,
          memberCount: this.memberships.filter(
            (storedMembership) => storedMembership.clubId === club.id
          ).length,
          joinedAt: membership.createdAt
        };
      });

    return {
      clubs,
      total: joinedMemberships.length
    };
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

type StoredClub = {
  id: string;
  title: string;
  slug: string;
  visibility: "PUBLIC" | "PRIVATE" | "INVITE_ONLY";
  createdAt: Date;
  updatedAt: Date;
};

type CreateStoredClubInput = {
  title: string;
  slug: string;
  visibility: StoredClub["visibility"];
  createdAt?: Date;
};

type StoredMembership = {
  id: string;
  userId: string;
  clubId: string;
  role: "OWNER" | "MODERATOR" | "MEMBER";
  createdAt: Date;
};

const createSessionCookie = async (user: AuthUserRecord) => {
  const sessionToken = await createSessionToken({
    userId: user.id,
    sessionVersion: user.sessionVersion
  });

  return `${env.SESSION_COOKIE_NAME}=${sessionToken}`;
};
