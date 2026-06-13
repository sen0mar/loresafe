import cookieParser from "cookie-parser";
import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import { env } from "../../config/env.js";
import { errorHandler } from "../../core/http/error-middleware.js";
import { requestIdMiddleware } from "../../core/http/request-id.js";
import { createSessionToken } from "../../core/security/session-token.js";
import { createAuthMiddleware } from "../auth/auth.middleware.js";
import {
  type AuthUserCredentialsRecord,
  type AuthUserRecord,
  type AuthUsersRepository,
  type CreateAuthUserInput
} from "../auth/auth.repository.js";
import { createAuthService } from "../auth/auth.service.js";
import type {
  ClubDetailRecord,
  ClubDiscoveryRecord,
  ClubsRepository
} from "./clubs.repository.js";
import { createClubsController } from "./clubs.controller.js";
import { createClubsRouter } from "./clubs.routes.js";
import { createClubsService } from "./clubs.service.js";
import type { CreateClubRequest } from "./clubs.schema.js";

describe("clubs routes", () => {
  let repository: InMemoryClubsRepository;
  let app: express.Express;

  beforeEach(() => {
    repository = new InMemoryClubsRepository();
    app = createClubsTestApp(repository);
  });

  it("rejects club creation without an authenticated session", async () => {
    const response = await request(app)
      .post("/api/clubs")
      .set("x-request-id", "clubs-create-missing-session")
      .send(validCreateClubPayload())
      .expect(401);

    expect(response.body).toEqual({
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required",
        requestId: "clubs-create-missing-session"
      }
    });
  });

  it("creates a club and exactly one owner membership", async () => {
    const user = await repository.createUser({
      email: "owner@example.com",
      displayName: "Owner",
      passwordHash: "$argon2id$v=19$hash"
    });

    const response = await request(app)
      .post("/api/clubs")
      .set("Cookie", await createSessionCookie(user))
      .send({
        title: "  New Story Circle  ",
        slug: " New-Story-Circle ",
        description: "  Spoiler-safe theories.  ",
        category: "  Books  ",
        visibility: "PUBLIC",
        rules: "  Keep future chapters out of early discussions.  "
      })
      .expect(201);

    expect(response.body).toEqual({
      club: {
        id: expect.any(String),
        title: "New Story Circle",
        slug: "new-story-circle",
        description: "Spoiler-safe theories.",
        category: "Books",
        rules: "Keep future chapters out of early discussions.",
        visibility: "PUBLIC",
        memberCount: 1,
        currentUserRole: "OWNER",
        membership: {
          isMember: true,
          role: "OWNER"
        },
        settings: {
          visibility: "PUBLIC",
          rules: "Keep future chapters out of early discussions."
        },
        createdAt: expect.any(String),
        updatedAt: expect.any(String)
      }
    });
    expect(repository.memberships).toEqual([
      {
        userId: user.id,
        clubId: response.body.club.id,
        role: "OWNER"
      }
    ]);
  });

  it("rejects duplicate club slugs cleanly", async () => {
    const user = await repository.createUser({
      email: "owner@example.com",
      displayName: "Owner",
      passwordHash: "$argon2id$v=19$hash"
    });
    repository.createClub({
      title: "Existing Club",
      slug: "existing-club",
      visibility: "PUBLIC"
    });

    const response = await request(app)
      .post("/api/clubs")
      .set("x-request-id", "clubs-duplicate-slug")
      .set("Cookie", await createSessionCookie(user))
      .send({
        ...validCreateClubPayload(),
        slug: "existing-club"
      })
      .expect(409);

    expect(response.body).toEqual({
      error: {
        code: "CONFLICT",
        message: "That club slug is already taken.",
        requestId: "clubs-duplicate-slug"
      }
    });
    expect(repository.clubs.size).toBe(1);
    expect(repository.memberships).toHaveLength(0);
  });

  it.each([
    ["title", { title: "x" }],
    ["slug", { slug: "not ok" }],
    ["description", { description: "x".repeat(281) }],
    ["category", { category: "x".repeat(61) }],
    ["visibility", { visibility: "FRIENDS_ONLY" }],
    ["rules", { rules: "x".repeat(2001) }]
  ])("rejects invalid club %s fields", async (_field, override) => {
    const user = await repository.createUser({
      email: `${_field}@example.com`,
      displayName: "Owner",
      passwordHash: "$argon2id$v=19$hash"
    });

    const response = await request(app)
      .post("/api/clubs")
      .set("x-request-id", `clubs-invalid-${_field}`)
      .set("Cookie", await createSessionCookie(user))
      .send({
        ...validCreateClubPayload(),
        ...override
      })
      .expect(400);

    expect(response.body).toEqual({
      error: {
        code: "BAD_REQUEST",
        message: "Check the club fields and try again.",
        requestId: `clubs-invalid-${_field}`
      }
    });
  });

  it("lets a private club owner view membership and settings but hides it from non-members and discovery", async () => {
    const owner = await repository.createUser({
      email: "owner@example.com",
      displayName: "Owner",
      passwordHash: "$argon2id$v=19$hash"
    });
    const nonMember = await repository.createUser({
      email: "reader@example.com",
      displayName: "Reader",
      passwordHash: "$argon2id$v=19$hash"
    });

    const createResponse = await request(app)
      .post("/api/clubs")
      .set("Cookie", await createSessionCookie(owner))
      .send({
        ...validCreateClubPayload(),
        title: "Private Plot Room",
        slug: "private-plot-room",
        visibility: "PRIVATE"
      })
      .expect(201);

    const ownerResponse = await request(app)
      .get("/api/clubs/private-plot-room")
      .set("Cookie", await createSessionCookie(owner))
      .expect(200);

    expect(ownerResponse.body.club).toMatchObject({
      id: createResponse.body.club.id,
      title: "Private Plot Room",
      slug: "private-plot-room",
      visibility: "PRIVATE",
      currentUserRole: "OWNER",
      membership: {
        isMember: true,
        role: "OWNER"
      },
      settings: {
        visibility: "PRIVATE",
        rules: "Keep future chapters out of early discussions."
      },
      memberCount: 1
    });

    const nonMemberResponse = await request(app)
      .get("/api/clubs/private-plot-room")
      .set("x-request-id", "clubs-private-non-member")
      .set("Cookie", await createSessionCookie(nonMember))
      .expect(404);

    expect(nonMemberResponse.body).toEqual({
      error: {
        code: "NOT_FOUND",
        message: "Club not found",
        requestId: "clubs-private-non-member"
      }
    });

    const discoveryResponse = await request(app)
      .get("/api/clubs")
      .set("Cookie", await createSessionCookie(owner))
      .expect(200);

    expect(discoveryResponse.body.clubs).toEqual([]);
    expect(JSON.stringify(discoveryResponse.body)).not.toContain(
      "Private Plot Room"
    );
  });

  it("hides invite-only club details from signed-in non-members", async () => {
    const owner = await repository.createUser({
      email: "owner@example.com",
      displayName: "Owner",
      passwordHash: "$argon2id$v=19$hash"
    });
    const nonMember = await repository.createUser({
      email: "reader@example.com",
      displayName: "Reader",
      passwordHash: "$argon2id$v=19$hash"
    });

    const club = repository.createClub({
      title: "Invite Arc Watch",
      slug: "invite-arc-watch",
      description: "Hidden invite-only discussion.",
      category: "Anime",
      visibility: "INVITE_ONLY"
    });
    repository.createMembership(owner.id, club.id, "OWNER");

    const response = await request(app)
      .get("/api/clubs/invite-arc-watch")
      .set("x-request-id", "clubs-invite-only-non-member")
      .set("Cookie", await createSessionCookie(nonMember))
      .expect(404);

    expect(response.body).toEqual({
      error: {
        code: "NOT_FOUND",
        message: "Club not found",
        requestId: "clubs-invite-only-non-member"
      }
    });
    expect(JSON.stringify(response.body)).not.toContain("Invite Arc Watch");
  });

  it("lets signed-in non-members open public club details", async () => {
    const reader = await repository.createUser({
      email: "reader@example.com",
      displayName: "Reader",
      passwordHash: "$argon2id$v=19$hash"
    });
    const club = repository.createClub({
      title: "Public Story Circle",
      slug: "public-story-circle",
      description: "Safe public discussion.",
      category: "Books",
      rules: "Keep future chapters out of early discussions.",
      visibility: "PUBLIC"
    });

    const response = await request(app)
      .get("/api/clubs/public-story-circle")
      .set("Cookie", await createSessionCookie(reader))
      .expect(200);

    expect(response.body.club).toMatchObject({
      id: club.id,
      title: "Public Story Circle",
      slug: "public-story-circle",
      visibility: "PUBLIC",
      currentUserRole: null,
      membership: {
        isMember: false,
        role: null
      },
      settings: {
        visibility: "PUBLIC",
        rules: "Keep future chapters out of early discussions."
      },
      memberCount: 0
    });
  });

  it("rejects discovery without an authenticated session", async () => {
    const response = await request(app)
      .get("/api/clubs")
      .set("x-request-id", "clubs-missing-session")
      .expect(401);

    expect(response.body).toEqual({
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required",
        requestId: "clubs-missing-session"
      }
    });
  });

  it("returns only public clubs to signed-in users", async () => {
    const user = await repository.createUser({
      email: "reader@example.com",
      displayName: "Reader",
      passwordHash: "$argon2id$v=19$hash"
    });
    const publicClub = repository.createClub({
      title: "Public Story Circle",
      slug: "public-story-circle",
      description: "Safe public discussion.",
      category: "Books",
      visibility: "PUBLIC"
    });
    const privateClub = repository.createClub({
      title: "Private Plot Room",
      slug: "private-plot-room",
      description: "Hidden private discussion.",
      category: "Shows",
      visibility: "PRIVATE"
    });
    const inviteOnlyClub = repository.createClub({
      title: "Invite Arc Watch",
      slug: "invite-arc-watch",
      description: "Hidden invite-only discussion.",
      category: "Anime",
      visibility: "INVITE_ONLY"
    });

    repository.createMembership(user.id, publicClub.id);
    repository.createMembership(user.id, privateClub.id);
    repository.createMembership(user.id, inviteOnlyClub.id);

    const response = await request(app)
      .get("/api/clubs")
      .set("Cookie", await createSessionCookie(user))
      .expect(200);

    expect(response.body).toEqual({
      clubs: [
        {
          id: publicClub.id,
          title: "Public Story Circle",
          slug: "public-story-circle",
          description: "Safe public discussion.",
          category: "Books",
          visibility: "PUBLIC",
          memberCount: 1,
          createdAt: publicClub.createdAt.toISOString(),
          updatedAt: publicClub.updatedAt.toISOString()
        }
      ],
      pagination: {
        page: 1,
        limit: 20,
        total: 1,
        pageCount: 1
      }
    });
    expect(JSON.stringify(response.body)).not.toContain("Private Plot Room");
    expect(JSON.stringify(response.body)).not.toContain("Invite Arc Watch");
  });

  it("returns narrow public club DTO fields", async () => {
    const user = await repository.createUser({
      email: "reader@example.com",
      displayName: "Reader",
      passwordHash: "$argon2id$v=19$hash"
    });

    repository.createClub({
      title: "Public Story Circle",
      slug: "public-story-circle",
      description: null,
      category: null,
      visibility: "PUBLIC"
    });

    const response = await request(app)
      .get("/api/clubs")
      .set("Cookie", await createSessionCookie(user))
      .expect(200);

    expect(Object.keys(response.body.clubs[0]).sort()).toEqual(
      [
        "category",
        "createdAt",
        "description",
        "id",
        "memberCount",
        "slug",
        "title",
        "updatedAt",
        "visibility"
      ].sort()
    );
  });

  it("returns narrow club detail DTO fields", async () => {
    const user = await repository.createUser({
      email: "reader@example.com",
      displayName: "Reader",
      passwordHash: "$argon2id$v=19$hash"
    });

    repository.createClub({
      title: "Public Story Circle",
      slug: "public-story-circle",
      description: null,
      category: null,
      rules: "Mind the spoiler line.",
      visibility: "PUBLIC"
    });

    const response = await request(app)
      .get("/api/clubs/public-story-circle")
      .set("Cookie", await createSessionCookie(user))
      .expect(200);

    expect(Object.keys(response.body.club).sort()).toEqual(
      [
        "category",
        "createdAt",
        "currentUserRole",
        "description",
        "id",
        "memberCount",
        "membership",
        "rules",
        "settings",
        "slug",
        "title",
        "updatedAt",
        "visibility"
      ].sort()
    );
    expect(Object.keys(response.body.club.membership).sort()).toEqual(
      ["isMember", "role"].sort()
    );
    expect(Object.keys(response.body.club.settings).sort()).toEqual(
      ["rules", "visibility"].sort()
    );
    expect(response.body.club).not.toHaveProperty("memberships");
  });

  it("paginates public discovery results", async () => {
    const user = await repository.createUser({
      email: "reader@example.com",
      displayName: "Reader",
      passwordHash: "$argon2id$v=19$hash"
    });

    repository.createClub({
      title: "First Public Club",
      slug: "first-public-club",
      visibility: "PUBLIC",
      createdAt: new Date("2026-01-01T00:00:00.000Z")
    });
    repository.createClub({
      title: "Second Public Club",
      slug: "second-public-club",
      visibility: "PUBLIC",
      createdAt: new Date("2026-01-02T00:00:00.000Z")
    });
    repository.createClub({
      title: "Third Public Club",
      slug: "third-public-club",
      visibility: "PUBLIC",
      createdAt: new Date("2026-01-03T00:00:00.000Z")
    });

    const response = await request(app)
      .get("/api/clubs?page=2&limit=2")
      .set("Cookie", await createSessionCookie(user))
      .expect(200);

    expect(response.body.clubs.map((club: { slug: string }) => club.slug)).toEqual([
      "first-public-club"
    ]);
    expect(response.body.pagination).toEqual({
      page: 2,
      limit: 2,
      total: 3,
      pageCount: 2
    });
  });

  it("rejects invalid discovery query params", async () => {
    const user = await repository.createUser({
      email: "reader@example.com",
      displayName: "Reader",
      passwordHash: "$argon2id$v=19$hash"
    });

    const response = await request(app)
      .get("/api/clubs?page=0&limit=51")
      .set("x-request-id", "clubs-invalid-query")
      .set("Cookie", await createSessionCookie(user))
      .expect(400);

    expect(response.body).toEqual({
      error: {
        code: "BAD_REQUEST",
        message: "Check the club discovery query and try again.",
        requestId: "clubs-invalid-query"
      }
    });
  });
});

const createClubsTestApp = (
  repository: AuthUsersRepository & ClubsRepository
) => {
  const app = express();
  const authService = createAuthService(repository);
  const authMiddleware = createAuthMiddleware(authService);
  const clubsService = createClubsService(repository);
  const clubsController = createClubsController(clubsService);

  app.use(requestIdMiddleware);
  app.use(express.json());
  app.use(cookieParser());
  app.use("/api/clubs", createClubsRouter(clubsController, authMiddleware));
  app.use(errorHandler);

  return app;
};

type StoredClub = Omit<ClubDiscoveryRecord, "memberCount" | "visibility"> & {
  visibility: "PUBLIC" | "PRIVATE" | "INVITE_ONLY";
  rules: string | null;
};

type CreateStoredClubInput = {
  title: string;
  slug: string;
  description?: string | null;
  category?: string | null;
  rules?: string | null;
  visibility: StoredClub["visibility"];
  createdAt?: Date;
};

class InMemoryClubsRepository implements AuthUsersRepository, ClubsRepository {
  readonly usersByEmail = new Map<
    string,
    AuthUserRecord & { passwordHash: string }
  >();
  readonly clubs = new Map<string, StoredClub>();
  readonly memberships: Array<{
    userId: string;
    clubId: string;
    role: "OWNER" | "MODERATOR" | "MEMBER";
  }> = [];

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
    description = null,
    category = null,
    rules = null,
    visibility,
    createdAt = new Date()
  }: CreateStoredClubInput) => {
    const club = {
      id: crypto.randomUUID(),
      title,
      slug,
      description,
      category,
      rules,
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
    role: "OWNER" | "MODERATOR" | "MEMBER" = "MEMBER"
  ) => {
    this.memberships.push({
      userId,
      clubId,
      role
    });
  };

  createClubWithOwnerMembership = async (
    userId: string,
    input: CreateClubRequest
  ) => {
    if (await this.findClubBySlug(input.slug)) {
      throw {
        code: "P2002"
      };
    }

    const club = this.createClub({
      title: input.title,
      slug: input.slug,
      description: input.description,
      category: input.category,
      rules: input.rules,
      visibility: input.visibility
    });

    this.createMembership(userId, club.id, "OWNER");

    return this.toClubDetailRecord(club, userId);
  };

  findClubBySlug = async (slug: string) => {
    const club = this.findStoredClubBySlug(slug);

    return club ? { id: club.id } : null;
  };

  findVisibleClubBySlugForUser = async (slug: string, userId: string) => {
    const club = this.findStoredClubBySlug(slug);

    if (!club) {
      return null;
    }

    const detail = this.toClubDetailRecord(club, userId);

    if (detail.visibility !== "PUBLIC" && !detail.currentUserRole) {
      return null;
    }

    return detail;
  };

  listPublicClubs = async ({ page, limit }: { page: number; limit: number }) => {
    const publicClubs = Array.from(this.clubs.values())
      .filter((club) => club.visibility === "PUBLIC")
      .sort(
        (leftClub, rightClub) =>
          rightClub.createdAt.getTime() - leftClub.createdAt.getTime() ||
          leftClub.id.localeCompare(rightClub.id)
      );
    const start = (page - 1) * limit;
    const clubs = publicClubs.slice(start, start + limit).map((club) => ({
      ...club,
      visibility: "PUBLIC" as const,
      memberCount: this.memberships.filter(
        (membership) => membership.clubId === club.id
      ).length
    }));

    return {
      clubs,
      total: publicClubs.length
    };
  };

  private findStoredClubBySlug = (slug: string) => {
    for (const club of this.clubs.values()) {
      if (club.slug === slug) {
        return club;
      }
    }

    return null;
  };

  private toClubDetailRecord = (
    club: StoredClub,
    userId: string
  ): ClubDetailRecord => ({
    ...club,
    memberCount: this.memberships.filter(
      (membership) => membership.clubId === club.id
    ).length,
    currentUserRole:
      this.memberships.find(
        (membership) =>
          membership.clubId === club.id && membership.userId === userId
      )?.role ?? null
  });
}

const createSessionCookie = async (user: AuthUserRecord) => {
  const token = await createSessionToken({
    userId: user.id,
    sessionVersion: user.sessionVersion
  });

  return `${env.SESSION_COOKIE_NAME}=${token}`;
};

const validCreateClubPayload = () => ({
  title: "New Story Circle",
  slug: "new-story-circle",
  description: "Spoiler-safe theories.",
  category: "Books",
  visibility: "PUBLIC",
  rules: "Keep future chapters out of early discussions."
});
