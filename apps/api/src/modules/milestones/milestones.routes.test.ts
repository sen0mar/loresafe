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
import {
  type ListMilestonesResult,
  type MilestoneRecord,
  type MilestonesRepository
} from "./milestones.repository.js";
import { createMilestonesController } from "./milestones.controller.js";
import { createMilestonesRouter } from "./milestones.routes.js";
import { createMilestonesService } from "./milestones.service.js";

describe("milestones routes", () => {
  let repository: InMemoryMilestonesRepository;
  let app: express.Express;

  beforeEach(() => {
    repository = new InMemoryMilestonesRepository();
    app = createMilestonesTestApp(repository);
  });

  it("rejects milestone reads without an authenticated session", async () => {
    const response = await request(app)
      .get("/api/clubs/public-story-circle/milestones")
      .set("x-request-id", "milestones-missing-session")
      .expect(401);

    expect(response.body).toEqual({
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required",
        requestId: "milestones-missing-session"
      }
    });
  });

  it("rejects invalid club slugs", async () => {
    const user = await repository.createUser(validUserInput());

    const response = await request(app)
      .get("/api/clubs/not%20ok/milestones")
      .set("x-request-id", "milestones-invalid-slug")
      .set("Cookie", await createSessionCookie(user))
      .expect(400);

    expect(response.body).toEqual({
      error: {
        code: "BAD_REQUEST",
        message: "Check the club URL and try again.",
        requestId: "milestones-invalid-slug"
      }
    });
  });

  it("rejects invalid milestone query params", async () => {
    const user = await repository.createUser(validUserInput());

    const response = await request(app)
      .get("/api/clubs/public-story-circle/milestones?page=0&limit=101")
      .set("x-request-id", "milestones-invalid-query")
      .set("Cookie", await createSessionCookie(user))
      .expect(400);

    expect(response.body).toEqual({
      error: {
        code: "BAD_REQUEST",
        message: "Check the milestone query and try again.",
        requestId: "milestones-invalid-query"
      }
    });
  });

  it("returns public club milestones ordered by position", async () => {
    const user = await repository.createUser(validUserInput());
    const club = repository.createClub({
      slug: "public-story-circle",
      visibility: "PUBLIC"
    });
    repository.createMilestone(club.id, {
      position: 3,
      safeTitle: "Third checkpoint"
    });
    repository.createMilestone(club.id, {
      position: 1,
      safeTitle: "First checkpoint"
    });
    repository.createMilestone(club.id, {
      position: 2,
      safeTitle: "Second checkpoint"
    });

    const response = await request(app)
      .get("/api/clubs/public-story-circle/milestones")
      .set("Cookie", await createSessionCookie(user))
      .expect(200);

    expect(
      response.body.milestones.map(
        (milestone: { position: number }) => milestone.position
      )
    ).toEqual([1, 2, 3]);
    expect(response.body.pagination).toEqual({
      page: 1,
      limit: 100,
      total: 3,
      pageCount: 1
    });
  });

  it("paginates public club milestones", async () => {
    const user = await repository.createUser(validUserInput());
    const club = repository.createClub({
      slug: "public-story-circle",
      visibility: "PUBLIC"
    });
    repository.createMilestone(club.id, {
      position: 1,
      safeTitle: "First checkpoint"
    });
    repository.createMilestone(club.id, {
      position: 2,
      safeTitle: "Second checkpoint"
    });

    const response = await request(app)
      .get("/api/clubs/public-story-circle/milestones?page=2&limit=1")
      .set("Cookie", await createSessionCookie(user))
      .expect(200);

    expect(response.body.milestones).toMatchObject([
      {
        position: 2,
        safeTitle: "Second checkpoint"
      }
    ]);
    expect(response.body.pagination).toEqual({
      page: 2,
      limit: 1,
      total: 2,
      pageCount: 2
    });
  });

  it.each([
    ["private", "PRIVATE"],
    ["invite-only", "INVITE_ONLY"]
  ] as const)(
    "hides %s club milestones from signed-in non-members",
    async (label, visibility) => {
      const reader = await repository.createUser(validUserInput());
      const club = repository.createClub({
        slug: `${label}-plot-room`,
        visibility
      });
      repository.createMilestone(club.id, {
        position: 1,
        safeTitle: "Safe checkpoint",
        fullTitle: "Hidden secret"
      });

      const response = await request(app)
        .get(`/api/clubs/${label}-plot-room/milestones`)
        .set("x-request-id", `milestones-${label}-non-member`)
        .set("Cookie", await createSessionCookie(reader))
        .expect(404);

      expect(response.body).toEqual({
        error: {
          code: "NOT_FOUND",
          message: "Club not found",
          requestId: `milestones-${label}-non-member`
        }
      });
      expect(JSON.stringify(response.body)).not.toContain("Hidden secret");
    }
  );

  it("does not return unsafe milestone full titles", async () => {
    const user = await repository.createUser(validUserInput());
    const club = repository.createClub({
      slug: "public-story-circle",
      visibility: "PUBLIC"
    });
    repository.createMilestone(club.id, {
      position: 1,
      safeTitle: "Named revelation",
      fullTitle: "Forbidden Name",
      description: "Safe context only.",
      spoilerName: true
    });

    const response = await request(app)
      .get("/api/clubs/public-story-circle/milestones")
      .set("Cookie", await createSessionCookie(user))
      .expect(200);

    expect(response.body.milestones).toEqual([
      {
        id: expect.any(String),
        position: 1,
        safeTitle: "Named revelation",
        fullTitle: null,
        description: "Safe context only.",
        spoilerName: true,
        isFullTitleHidden: true
      }
    ]);
    expect(JSON.stringify(response.body)).not.toContain("Forbidden Name");
  });

  it("returns narrow milestone DTO fields", async () => {
    const user = await repository.createUser(validUserInput());
    const club = repository.createClub({
      slug: "public-story-circle",
      visibility: "PUBLIC"
    });
    repository.createMilestone(club.id, {
      position: 1,
      safeTitle: "Opening chapters",
      fullTitle: "Opening chapters",
      description: null,
      spoilerName: false
    });

    const response = await request(app)
      .get("/api/clubs/public-story-circle/milestones")
      .set("Cookie", await createSessionCookie(user))
      .expect(200);

    expect(Object.keys(response.body.milestones[0]).sort()).toEqual(
      [
        "description",
        "fullTitle",
        "id",
        "isFullTitleHidden",
        "position",
        "safeTitle",
        "spoilerName"
      ].sort()
    );
  });
});

const createMilestonesTestApp = (
  repository: AuthUsersRepository & MilestonesRepository
) => {
  const app = express();
  const authService = createAuthService(repository);
  const authMiddleware = createAuthMiddleware(authService);
  const milestonesService = createMilestonesService(repository);
  const milestonesController = createMilestonesController(milestonesService);

  app.use(requestIdMiddleware);
  app.use(express.json());
  app.use(cookieParser());
  app.use(
    "/api/clubs",
    createMilestonesRouter(milestonesController, authMiddleware)
  );
  app.use(errorHandler);

  return app;
};

type StoredClub = {
  id: string;
  slug: string;
  visibility: "PUBLIC" | "PRIVATE" | "INVITE_ONLY";
};

type CreateStoredClubInput = {
  slug: string;
  visibility: StoredClub["visibility"];
};

type CreateStoredMilestoneInput = Omit<MilestoneRecord, "id">;

class InMemoryMilestonesRepository
  implements AuthUsersRepository, MilestonesRepository
{
  readonly usersByEmail = new Map<
    string,
    AuthUserRecord & { passwordHash: string }
  >();
  readonly clubs = new Map<string, StoredClub>();
  readonly memberships: Array<{ userId: string; clubId: string }> = [];
  readonly milestones: Array<MilestoneRecord & { clubId: string }> = [];

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

  createClub = ({ slug, visibility }: CreateStoredClubInput) => {
    const club = {
      id: crypto.randomUUID(),
      slug,
      visibility
    };

    this.clubs.set(club.id, club);

    return club;
  };

  createMembership = (userId: string, clubId: string) => {
    this.memberships.push({
      userId,
      clubId
    });
  };

  createMilestone = (
    clubId: string,
    input: Partial<CreateStoredMilestoneInput> &
      Pick<CreateStoredMilestoneInput, "position" | "safeTitle">
  ) => {
    const milestone = {
      id: crypto.randomUUID(),
      clubId,
      fullTitle: null,
      description: null,
      spoilerName: false,
      ...input
    };

    this.milestones.push(milestone);

    return milestone;
  };

  listVisibleMilestonesByClubSlug = async (
    slug: string,
    userId: string,
    { page, limit }: { page: number; limit: number }
  ): Promise<ListMilestonesResult | null> => {
    const club = this.findStoredClubBySlug(slug);

    if (!club || !this.canViewClubMilestones(club, userId)) {
      return null;
    }

    const orderedMilestones = this.milestones
      .filter((milestone) => milestone.clubId === club.id)
      .sort(
        (leftMilestone, rightMilestone) =>
          leftMilestone.position - rightMilestone.position ||
          leftMilestone.id.localeCompare(rightMilestone.id)
      );
    const start = (page - 1) * limit;

    return {
      milestones: orderedMilestones.slice(start, start + limit),
      total: orderedMilestones.length
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

  private canViewClubMilestones = (club: StoredClub, userId: string) =>
    club.visibility === "PUBLIC" ||
    this.memberships.some(
      (membership) =>
        membership.clubId === club.id && membership.userId === userId
    );
}

const createSessionCookie = async (user: AuthUserRecord) => {
  const token = await createSessionToken({
    userId: user.id,
    sessionVersion: user.sessionVersion
  });

  return `${env.SESSION_COOKIE_NAME}=${token}`;
};

const validUserInput = () => ({
  email: "reader@example.com",
  displayName: "Reader",
  passwordHash: "$argon2id$v=19$hash"
});
