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
import type { ClubDetailRecord } from "../clubs/clubs.repository.js";
import { createInvitesController } from "./invites.controller.js";
import {
  type AcceptInviteRecord,
  type ClubInviteCreationClubRecord,
  type ClubInviteRecord,
  type CreateClubInviteInput,
  type InvitesRepository
} from "./invites.repository.js";
import {
  createClubInvitesRouter,
  createInvitesRouter
} from "./invites.routes.js";
import { createInvitesService } from "./invites.service.js";
import { hashInviteToken } from "./invites.token.js";

describe("invite routes", () => {
  let repository: InMemoryInvitesRepository;
  let app: express.Express;

  beforeEach(() => {
    repository = new InMemoryInvitesRepository();
    app = createInvitesTestApp(repository);
  });

  it.each(["OWNER", "MODERATOR"] as const)(
    "lets a club %s create an invite without storing the raw token",
    async (role) => {
      const creator = await repository.createUser({
        email: `${role.toLowerCase()}@example.com`,
        displayName: role,
        passwordHash: "$argon2id$v=19$hash"
      });
      const club = repository.createClub({
        title: "Invite Arc Watch",
        slug: "invite-arc-watch",
        visibility: "INVITE_ONLY"
      });
      repository.createMembership(creator.id, club.id, role);

      const response = await request(app)
        .post("/api/clubs/invite-arc-watch/invites")
        .set("Cookie", await createSessionCookie(creator))
        .send({
          expiresInDays: 3,
          maxUses: 5
        })
        .expect(201);

      expect(response.body.invite).toMatchObject({
        token: expect.any(String),
        maxUses: 5,
        usedCount: 0,
        revokedAt: null,
        createdAt: expect.any(String),
        expiresAt: expect.any(String),
        club: {
          id: club.id,
          title: "Invite Arc Watch",
          slug: "invite-arc-watch"
        }
      });
      expect(response.body.invite.token).toHaveLength(43);

      const storedInvite = repository.invites[0];

      expect(storedInvite.tokenHash).toBe(
        hashInviteToken(response.body.invite.token)
      );
      expect(storedInvite).not.toHaveProperty("token");
    }
  );

  it("defaults invite expiry and max uses when no body is sent", async () => {
    const owner = await repository.createUser({
      email: "owner@example.com",
      displayName: "Owner",
      passwordHash: "$argon2id$v=19$hash"
    });
    const club = repository.createClub({
      title: "Default Invite Club",
      slug: "default-invite-club",
      visibility: "PRIVATE"
    });
    repository.createMembership(owner.id, club.id, "OWNER");

    const response = await request(app)
      .post("/api/clubs/default-invite-club/invites")
      .set("Cookie", await createSessionCookie(owner))
      .expect(201);

    expect(response.body.invite).toMatchObject({
      maxUses: 10,
      usedCount: 0
    });
  });

  it("does not let non-moderators create invites", async () => {
    const member = await repository.createUser({
      email: "member@example.com",
      displayName: "Member",
      passwordHash: "$argon2id$v=19$hash"
    });
    const club = repository.createClub({
      title: "Member Club",
      slug: "member-club",
      visibility: "PUBLIC"
    });
    repository.createMembership(member.id, club.id, "MEMBER");

    const response = await request(app)
      .post("/api/clubs/member-club/invites")
      .set("x-request-id", "invites-member-forbidden")
      .set("Cookie", await createSessionCookie(member))
      .send({})
      .expect(403);

    expect(response.body).toEqual({
      error: {
        code: "FORBIDDEN",
        message: "Only club owners and moderators can create invites.",
        requestId: "invites-member-forbidden"
      }
    });
    expect(repository.invites).toHaveLength(0);
  });

  it("hides invite creation from club nonmembers", async () => {
    const reader = await repository.createUser({
      email: "reader@example.com",
      displayName: "Reader",
      passwordHash: "$argon2id$v=19$hash"
    });
    repository.createClub({
      title: "Hidden Club",
      slug: "hidden-club",
      visibility: "PRIVATE"
    });

    const response = await request(app)
      .post("/api/clubs/hidden-club/invites")
      .set("x-request-id", "invites-nonmember-hidden")
      .set("Cookie", await createSessionCookie(reader))
      .send({})
      .expect(404);

    expect(response.body).toEqual({
      error: {
        code: "NOT_FOUND",
        message: "Club not found",
        requestId: "invites-nonmember-hidden"
      }
    });
    expect(repository.invites).toHaveLength(0);
  });

  it("grants membership for a valid invite", async () => {
    const reader = await repository.createUser({
      email: "reader@example.com",
      displayName: "Reader",
      passwordHash: "$argon2id$v=19$hash"
    });
    const club = repository.createClub({
      title: "Invite Arc Watch",
      slug: "invite-arc-watch",
      visibility: "INVITE_ONLY"
    });
    const token = createTestToken("a");
    const invite = repository.createStoredInvite({
      clubId: club.id,
      tokenHash: hashInviteToken(token),
      maxUses: 2,
      usedCount: 0,
      expiresAt: new Date(Date.now() + 60_000)
    });

    const response = await request(app)
      .post(`/api/invites/${token}/accept`)
      .set("Cookie", await createSessionCookie(reader))
      .expect(200);

    expect(response.body).toMatchObject({
      status: "accepted",
      club: {
        id: club.id,
        slug: "invite-arc-watch",
        currentUserRole: "MEMBER",
        membership: {
          isMember: true,
          role: "MEMBER"
        }
      }
    });
    expect(repository.findMembership(reader.id, club.id)).toMatchObject({
      role: "MEMBER"
    });
    expect(invite.usedCount).toBe(1);
  });

  it("does not spend an invite use for existing members", async () => {
    const moderator = await repository.createUser({
      email: "mod@example.com",
      displayName: "Moderator",
      passwordHash: "$argon2id$v=19$hash"
    });
    const club = repository.createClub({
      title: "Existing Member Club",
      slug: "existing-member-club",
      visibility: "PRIVATE"
    });
    repository.createMembership(moderator.id, club.id, "MODERATOR");
    const token = createTestToken("b");
    const invite = repository.createStoredInvite({
      clubId: club.id,
      tokenHash: hashInviteToken(token),
      maxUses: 1,
      usedCount: 0,
      expiresAt: new Date(Date.now() + 60_000)
    });

    const response = await request(app)
      .post(`/api/invites/${token}/accept`)
      .set("Cookie", await createSessionCookie(moderator))
      .expect(200);

    expect(response.body).toMatchObject({
      status: "already_member",
      club: {
        id: club.id,
        currentUserRole: "MODERATOR",
        membership: {
          isMember: true,
          role: "MODERATOR"
        }
      }
    });
    expect(invite.usedCount).toBe(0);
  });

  it.each([
    {
      label: "expired",
      code: "INVITE_EXPIRED",
      token: createTestToken("c"),
      invite: {
        expiresAt: new Date(Date.now() - 60_000),
        maxUses: 3,
        usedCount: 0,
        revokedAt: null
      }
    },
    {
      label: "revoked",
      code: "INVITE_REVOKED",
      token: createTestToken("d"),
      invite: {
        expiresAt: new Date(Date.now() + 60_000),
        maxUses: 3,
        usedCount: 0,
        revokedAt: new Date()
      }
    },
    {
      label: "maxed",
      code: "INVITE_MAXED",
      token: createTestToken("e"),
      invite: {
        expiresAt: new Date(Date.now() + 60_000),
        maxUses: 1,
        usedCount: 1,
        revokedAt: null
      }
    }
  ])("$label invites fail without granting membership", async ({ code, invite, token }) => {
    const reader = await repository.createUser({
      email: `${code.toLowerCase()}@example.com`,
      displayName: "Reader",
      passwordHash: "$argon2id$v=19$hash"
    });
    const club = repository.createClub({
      title: `${code} Club`,
      slug: `${code.toLowerCase().replace("_", "-")}-club`,
      visibility: "INVITE_ONLY"
    });

    repository.createStoredInvite({
      clubId: club.id,
      tokenHash: hashInviteToken(token),
      ...invite
    });

    const response = await request(app)
      .post(`/api/invites/${token}/accept`)
      .set("x-request-id", `invites-${code.toLowerCase()}`)
      .set("Cookie", await createSessionCookie(reader))
      .expect(409);

    expect(response.body.error).toMatchObject({
      code,
      requestId: `invites-${code.toLowerCase()}`
    });
    expect(repository.findMembership(reader.id, club.id)).toBeNull();
  });

  it("rejects unknown and malformed invite tokens cleanly", async () => {
    const reader = await repository.createUser({
      email: "reader@example.com",
      displayName: "Reader",
      passwordHash: "$argon2id$v=19$hash"
    });
    const missingToken = createTestToken("f");

    const missingResponse = await request(app)
      .post(`/api/invites/${missingToken}/accept`)
      .set("x-request-id", "invites-missing-token")
      .set("Cookie", await createSessionCookie(reader))
      .expect(404);

    expect(missingResponse.body).toEqual({
      error: {
        code: "NOT_FOUND",
        message: "Invite not found",
        requestId: "invites-missing-token"
      }
    });

    const malformedResponse = await request(app)
      .post("/api/invites/not-valid/accept")
      .set("x-request-id", "invites-bad-token")
      .set("Cookie", await createSessionCookie(reader))
      .expect(400);

    expect(malformedResponse.body).toEqual({
      error: {
        code: "BAD_REQUEST",
        message: "Check the invite link and try again.",
        requestId: "invites-bad-token"
      }
    });
  });

  it("rejects invite acceptance for actively banned users", async () => {
    const reader = await repository.createUser({
      email: "reader@example.com",
      displayName: "Reader",
      passwordHash: "$argon2id$v=19$hash"
    });
    const club = repository.createClub({
      title: "Banned Invite Club",
      slug: "banned-invite-club",
      visibility: "INVITE_ONLY"
    });
    const token = createTestToken("b");

    repository.createStoredInvite({
      clubId: club.id,
      tokenHash: hashInviteToken(token),
      expiresAt: new Date(Date.now() + 60_000),
      maxUses: 1
    });
    repository.createBan(reader.id, club.id);

    const response = await request(app)
      .post(`/api/invites/${token}/accept`)
      .set("Cookie", await createSessionCookie(reader))
      .expect(403);

    expect(response.body.error).toMatchObject({
      code: "FORBIDDEN",
      message: "You cannot join this club."
    });
    expect(repository.memberships).toHaveLength(0);
    expect(repository.invites[0].usedCount).toBe(0);
  });

  it("rejects invalid invite create bodies and accept bodies", async () => {
    const owner = await repository.createUser({
      email: "owner@example.com",
      displayName: "Owner",
      passwordHash: "$argon2id$v=19$hash"
    });
    const club = repository.createClub({
      title: "Body Check Club",
      slug: "body-check-club",
      visibility: "PUBLIC"
    });
    repository.createMembership(owner.id, club.id, "OWNER");
    const token = createTestToken("g");
    repository.createStoredInvite({
      clubId: club.id,
      tokenHash: hashInviteToken(token),
      maxUses: 1,
      usedCount: 0,
      expiresAt: new Date(Date.now() + 60_000)
    });

    const createResponse = await request(app)
      .post("/api/clubs/body-check-club/invites")
      .set("x-request-id", "invites-bad-create-body")
      .set("Cookie", await createSessionCookie(owner))
      .send({
        expiresInDays: 0
      })
      .expect(400);

    expect(createResponse.body).toEqual({
      error: {
        code: "BAD_REQUEST",
        message: "Check the invite fields and try again.",
        requestId: "invites-bad-create-body"
      }
    });

    const acceptResponse = await request(app)
      .post(`/api/invites/${token}/accept`)
      .set("x-request-id", "invites-accept-body")
      .set("Cookie", await createSessionCookie(owner))
      .send({
        unexpected: true
      })
      .expect(400);

    expect(acceptResponse.body).toEqual({
      error: {
        code: "BAD_REQUEST",
        message: "Invite accept requests do not accept a body.",
        requestId: "invites-accept-body"
      }
    });
  });
});

const createInvitesTestApp = (
  repository: AuthUsersRepository & InvitesRepository
) => {
  const app = express();
  const authService = createAuthService(repository);
  const authMiddleware = createAuthMiddleware(authService);
  const invitesService = createInvitesService(repository);
  const invitesController = createInvitesController(invitesService);

  app.use(requestIdMiddleware);
  app.use(express.json());
  app.use(cookieParser());
  app.use(
    "/api/clubs",
    createClubInvitesRouter(invitesController, authMiddleware)
  );
  app.use("/api/invites", createInvitesRouter(invitesController, authMiddleware));
  app.use(errorHandler);

  return app;
};

type StoredClub = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  category: string | null;
  rules: string | null;
  visibility: "PUBLIC" | "PRIVATE" | "INVITE_ONLY";
  createdAt: Date;
  updatedAt: Date;
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

type StoredInvite = {
  id: string;
  clubId: string;
  createdById: string;
  tokenHash: string;
  expiresAt: Date;
  maxUses: number;
  usedCount: number;
  revokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type CreateStoredInviteInput = {
  clubId: string;
  createdById?: string;
  tokenHash: string;
  expiresAt: Date;
  maxUses: number;
  usedCount?: number;
  revokedAt?: Date | null;
  createdAt?: Date;
};

class InMemoryInvitesRepository
  implements AuthUsersRepository, InvitesRepository
{
  readonly usersByEmail = new Map<
    string,
    AuthUserRecord & { passwordHash: string }
  >();
  readonly clubs = new Map<string, StoredClub>();
  readonly invites: StoredInvite[] = [];
  readonly memberships: Array<{
    userId: string;
    clubId: string;
    role: "OWNER" | "MODERATOR" | "MEMBER";
  }> = [];
  readonly bans: Array<{
    userId: string;
    clubId: string;
    expiresAt: Date | null;
    revokedAt: Date | null;
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

  createBan = (
    userId: string,
    clubId: string,
    input: {
      expiresAt?: Date | null;
      revokedAt?: Date | null;
    } = {}
  ) => {
    this.bans.push({
      userId,
      clubId,
      expiresAt: input.expiresAt ?? null,
      revokedAt: input.revokedAt ?? null
    });
  };

  createStoredInvite = ({
    clubId,
    createdById = crypto.randomUUID(),
    tokenHash,
    expiresAt,
    maxUses,
    usedCount = 0,
    revokedAt = null,
    createdAt = new Date()
  }: CreateStoredInviteInput) => {
    const invite = {
      id: crypto.randomUUID(),
      clubId,
      createdById,
      tokenHash,
      expiresAt,
      maxUses,
      usedCount,
      revokedAt,
      createdAt,
      updatedAt: createdAt
    };

    this.invites.push(invite);

    return invite;
  };

  findMembership = (userId: string, clubId: string) =>
    this.memberships.find(
      (membership) =>
        membership.clubId === clubId && membership.userId === userId
    ) ?? null;

  acceptInviteByTokenHash = async (
    tokenHash: string,
    userId: string,
    now: Date
  ): Promise<AcceptInviteRecord> => {
    const invite =
      this.invites.find((storedInvite) => storedInvite.tokenHash === tokenHash) ??
      null;

    if (!invite) {
      return {
        status: "not_found"
      };
    }

    if (this.hasActiveBan(userId, invite.clubId)) {
      return {
        status: "banned"
      };
    }

    if (this.findMembership(userId, invite.clubId)) {
      return {
        status: "already_member",
        club: this.toClubDetailRecord(invite.clubId, userId)
      };
    }

    if (invite.revokedAt) {
      return {
        status: "revoked"
      };
    }

    if (invite.expiresAt.getTime() <= now.getTime()) {
      return {
        status: "expired"
      };
    }

    if (invite.usedCount >= invite.maxUses) {
      return {
        status: "maxed"
      };
    }

    this.createMembership(userId, invite.clubId, "MEMBER");
    invite.usedCount += 1;

    return {
      status: "accepted",
      club: this.toClubDetailRecord(invite.clubId, userId)
    };
  };

  createClubInvite = async ({
    clubId,
    createdById,
    tokenHash,
    expiresAt,
    maxUses
  }: CreateClubInviteInput): Promise<ClubInviteRecord> => {
    if (this.invites.some((invite) => invite.tokenHash === tokenHash)) {
      throw {
        code: "P2002"
      };
    }

    const invite = this.createStoredInvite({
      clubId,
      createdById,
      tokenHash,
      expiresAt,
      maxUses
    });

    return this.toClubInviteRecord(invite);
  };

  findClubForInviteCreation = async (
    slug: string,
    userId: string
  ): Promise<ClubInviteCreationClubRecord | null> => {
    const club = this.findStoredClubBySlug(slug);

    if (!club) {
      return null;
    }

    return {
      id: club.id,
      title: club.title,
      slug: club.slug,
      currentUserRole: this.findMembership(userId, club.id)?.role ?? null
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

  private hasActiveBan = (userId: string, clubId: string) =>
    this.bans.some(
      (ban) =>
        ban.userId === userId &&
        ban.clubId === clubId &&
        !ban.revokedAt &&
        (!ban.expiresAt || ban.expiresAt.getTime() > Date.now())
    );

  private toClubInviteRecord = (invite: StoredInvite): ClubInviteRecord => {
    const club = this.clubs.get(invite.clubId);

    if (!club) {
      throw new Error(`Missing test club ${invite.clubId}`);
    }

    return {
      expiresAt: invite.expiresAt,
      maxUses: invite.maxUses,
      usedCount: invite.usedCount,
      revokedAt: invite.revokedAt,
      createdAt: invite.createdAt,
      club: {
        id: club.id,
        title: club.title,
        slug: club.slug
      }
    };
  };

  private toClubDetailRecord = (
    clubId: string,
    userId: string
  ): ClubDetailRecord => {
    const club = this.clubs.get(clubId);

    if (!club) {
      throw new Error(`Missing test club ${clubId}`);
    }

    return {
      ...club,
      memberCount: this.memberships.filter(
        (membership) => membership.clubId === club.id
      ).length,
      currentUserRole: this.findMembership(userId, club.id)?.role ?? null
    };
  };
}

const createTestToken = (character: string) => character.repeat(43);

const createSessionCookie = async (user: AuthUserRecord) => {
  const token = await createSessionToken({
    userId: user.id,
    sessionVersion: user.sessionVersion
  });

  return `${env.SESSION_COOKIE_NAME}=${token}`;
};
