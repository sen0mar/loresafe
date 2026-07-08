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
  ClubBanMutationResult,
  ClubBanRecord,
  ClubDetailRecord,
  ClubDiscoveryRecord,
  LeaveClubResult,
  PublicClubDetailRecord,
  PublicClubSitemapEntryRecord,
  ClubMemberMutationResult,
  ClubMemberRecord,
  ClubSettingsMutationResult,
  ClubsRepository
} from "./clubs.repository.js";
import {
  createClubsController,
  type ClubsController
} from "./clubs.controller.js";
import {
  createClubsRouter,
  createPublicClubsRouter
} from "./clubs.routes.js";
import { createClubsService } from "./clubs.service.js";
import { createSitemapRouter } from "../seo/sitemap.routes.js";
import type {
  BanClubMemberRequest,
  ClubCategory,
  CreateClubRequest,
  ListClubBansQuery,
  ListClubMembersQuery,
  ListClubsQuery,
  ListPublicSeoClubsQuery,
  UpdateClubSettingsRequest
} from "./clubs.schema.js";

describe("clubs routes", () => {
  let repository: InMemoryClubsRepository;
  let app: express.Express;

  beforeEach(() => {
    repository = new InMemoryClubsRepository();
    app = createClubsTestApp(repository);
  });

  it("fails fast if the unban route handler is not registered", () => {
    const authService = createAuthService(repository);
    const authMiddleware = createAuthMiddleware(authService);
    const clubsService = createClubsService(repository);
    const clubsController = createClubsController(clubsService);
    const incompleteController: ClubsController = {
      ...clubsController,
      unbanClubBan: undefined as unknown as ClubsController["unbanClubBan"]
    };

    expect(() =>
      createClubsRouter(incompleteController, authMiddleware)
    ).toThrow(/handler must be a function/i);
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
        linkName: " New-Story-Circle ",
        description: "  Spoiler-safe theories.  ",
        category: "BOOKS",
        visibility: "PUBLIC",
        rules: "  Keep future chapters out of early discussions.  "
      })
      .expect(201);

    expect(response.body).toEqual({
      club: {
        id: expect.any(String),
        title: "New Story Circle",
        linkName: "new-story-circle",
        description: "Spoiler-safe theories.",
        category: "BOOKS",
        coverUrl: null,
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

  it.each([
    "BOOKS",
    "TV_SHOWS",
    "ANIME",
    "MANGA",
    "MOVIES",
    "GAMES",
    "PODCASTS",
    "COURSES",
    "COMICS_GRAPHIC_NOVELS",
    "WEB_SERIALS",
    "CUSTOM_TIMELINE"
  ] satisfies ClubCategory[])("creates clubs with %s category", async (category) => {
    const user = await repository.createUser({
      email: `${category.toLowerCase()}@example.com`,
      displayName: "Owner",
      passwordHash: "$argon2id$v=19$hash"
    });

    const response = await request(app)
      .post("/api/clubs")
      .set("Cookie", await createSessionCookie(user))
      .send({
        ...validCreateClubPayload(),
        title: `${category} Club`,
        linkName: `${category.toLowerCase().replaceAll("_", "-")}-club`,
        category
      })
      .expect(201);

    expect(response.body.club.category).toBe(category);
  });

  it("rejects duplicate club link names cleanly", async () => {
    const user = await repository.createUser({
      email: "owner@example.com",
      displayName: "Owner",
      passwordHash: "$argon2id$v=19$hash"
    });
    repository.createClub({
      title: "Existing Club",
      linkName: "existing-club",
      visibility: "PUBLIC"
    });

    const response = await request(app)
      .post("/api/clubs")
      .set("x-request-id", "clubs-duplicate-linkName")
      .set("Cookie", await createSessionCookie(user))
      .send({
        ...validCreateClubPayload(),
        linkName: "existing-club"
      })
      .expect(409);

    expect(response.body).toEqual({
      error: {
        code: "CONFLICT",
        message: "That club link name is already taken.",
        requestId: "clubs-duplicate-linkName"
      }
    });
    expect(repository.clubs.size).toBe(1);
    expect(repository.memberships).toHaveLength(0);
  });

  it.each([
    ["title", { title: "x" }],
    ["linkName", { linkName: "not ok" }],
    ["description", { description: "x".repeat(281) }],
    ["category", { category: "NOT_A_CATEGORY" }],
    ["category", { category: "" }],
    ["category", { category: null }],
    ["category", { category: undefined }],
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
        linkName: "private-plot-room",
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
      linkName: "private-plot-room",
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
    expect(JSON.stringify(discoveryResponse.body)).not.toContain(
      "private-plot-room"
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
      linkName: "invite-arc-watch",
      description: "Hidden invite-only discussion.",
      category: "ANIME",
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
      linkName: "public-story-circle",
      description: "Safe public discussion.",
      category: "BOOKS",
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
      linkName: "public-story-circle",
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

  it("lets a signed-in user join a public club as a member", async () => {
    const reader = await repository.createUser({
      email: "reader@example.com",
      displayName: "Reader",
      passwordHash: "$argon2id$v=19$hash"
    });
    const club = repository.createClub({
      title: "Public Story Circle",
      linkName: "public-story-circle",
      description: "Safe public discussion.",
      category: "BOOKS",
      visibility: "PUBLIC"
    });

    const response = await request(app)
      .post("/api/clubs/public-story-circle/join")
      .set("Cookie", await createSessionCookie(reader))
      .expect(200);

    expect(response.body.club).toMatchObject({
      id: club.id,
      title: "Public Story Circle",
      linkName: "public-story-circle",
      visibility: "PUBLIC",
      memberCount: 1,
      currentUserRole: "MEMBER",
      membership: {
        isMember: true,
        role: "MEMBER"
      }
    });
    expect(repository.memberships).toEqual([
      {
        userId: reader.id,
        clubId: club.id,
        role: "MEMBER"
      }
    ]);
  });

  it("treats duplicate public club joins as idempotent", async () => {
    const reader = await repository.createUser({
      email: "reader@example.com",
      displayName: "Reader",
      passwordHash: "$argon2id$v=19$hash"
    });
    const club = repository.createClub({
      title: "Public Story Circle",
      linkName: "public-story-circle",
      visibility: "PUBLIC"
    });

    repository.createMembership(reader.id, club.id, "MEMBER");

    const response = await request(app)
      .post("/api/clubs/public-story-circle/join")
      .set("Cookie", await createSessionCookie(reader))
      .expect(200);

    expect(response.body.club).toMatchObject({
      id: club.id,
      memberCount: 1,
      currentUserRole: "MEMBER",
      membership: {
        isMember: true,
        role: "MEMBER"
      }
    });
    expect(
      repository.memberships.filter(
        (membership) =>
          membership.userId === reader.id && membership.clubId === club.id
      )
    ).toHaveLength(1);
  });

  it("preserves an existing elevated role during an idempotent public club join", async () => {
    const moderator = await repository.createUser({
      email: "mod@example.com",
      displayName: "Moderator",
      passwordHash: "$argon2id$v=19$hash"
    });
    const club = repository.createClub({
      title: "Public Story Circle",
      linkName: "public-story-circle",
      visibility: "PUBLIC"
    });

    repository.createMembership(moderator.id, club.id, "MODERATOR");

    const response = await request(app)
      .post("/api/clubs/public-story-circle/join")
      .set("Cookie", await createSessionCookie(moderator))
      .expect(200);

    expect(response.body.club).toMatchObject({
      id: club.id,
      memberCount: 1,
      currentUserRole: "MODERATOR",
      membership: {
        isMember: true,
        role: "MODERATOR"
      }
    });
    expect(repository.memberships).toEqual([
      {
        userId: moderator.id,
        clubId: club.id,
        role: "MODERATOR"
      }
    ]);
  });

  it("lets a club member leave their club", async () => {
    const reader = await repository.createUser({
      email: "reader@example.com",
      displayName: "Reader",
      passwordHash: "$argon2id$v=19$hash"
    });
    const club = repository.createClub({
      title: "Leaveable Story Circle",
      linkName: "leaveable-story-circle",
      visibility: "PUBLIC"
    });

    repository.createMembership(reader.id, club.id, "MEMBER");

    const response = await request(app)
      .post("/api/clubs/leaveable-story-circle/leave")
      .set("Cookie", await createSessionCookie(reader))
      .expect(200);

    expect(response.body).toEqual({
      left: true,
      club: {
        id: club.id,
        linkName: "leaveable-story-circle"
      }
    });
    expect(
      repository.memberships.some(
        (membership) =>
          membership.userId === reader.id && membership.clubId === club.id
      )
    ).toBe(false);
  });

  it("prevents a sole owner from leaving their club", async () => {
    const owner = await repository.createUser({
      email: "owner@example.com",
      displayName: "Owner",
      passwordHash: "$argon2id$v=19$hash"
    });
    const club = repository.createClub({
      title: "Owned Story Circle",
      linkName: "owned-story-circle",
      visibility: "PUBLIC"
    });

    repository.createMembership(owner.id, club.id, "OWNER");

    const response = await request(app)
      .post("/api/clubs/owned-story-circle/leave")
      .set("Cookie", await createSessionCookie(owner))
      .set("x-request-id", "clubs-leave-last-owner")
      .expect(409);

    expect(response.body).toEqual({
      error: {
        code: "CONFLICT",
        message: "This club must keep at least one owner.",
        requestId: "clubs-leave-last-owner"
      }
    });
    expect(repository.memberships).toHaveLength(1);
  });

  it("lists club members with safe public user fields for members only", async () => {
    const owner = await repository.createUser({
      email: "owner@example.com",
      displayName: "Owner",
      passwordHash: "$argon2id$v=19$hash"
    });
    const reader = await repository.createUser({
      email: "reader@example.com",
      displayName: "Reader",
      passwordHash: "$argon2id$v=19$hash"
    });
    const outsider = await repository.createUser({
      email: "outsider@example.com",
      displayName: "Outsider",
      passwordHash: "$argon2id$v=19$hash"
    });
    const club = repository.createClub({
      title: "Member List Club",
      linkName: "member-list-club",
      visibility: "PUBLIC"
    });
    const ownerMembershipId = repository.createMembership(
      owner.id,
      club.id,
      "OWNER"
    );
    repository.createMembership(reader.id, club.id, "MEMBER");
    repository.createBan(reader.id, club.id, { reason: "Cooldown" });

    const response = await request(app)
      .get("/api/clubs/member-list-club/members?page=1&limit=1")
      .set("Cookie", await createSessionCookie(owner))
      .expect(200);

    expect(response.body).toEqual({
      members: [
        {
          id: ownerMembershipId,
          role: "OWNER",
          user: {
            id: owner.id,
            displayName: "Owner",
            username: null,
            avatarUrl: null
          },
          activeBan: null,
          joinedAt: expect.any(String),
          updatedAt: expect.any(String)
        }
      ],
      pagination: {
        page: 1,
        limit: 1,
        total: 1,
        pageCount: 1
      }
    });
    expect(JSON.stringify(response.body)).not.toContain("owner@example.com");
    expect(JSON.stringify(response.body)).not.toContain("$argon2id");

    await request(app)
      .get("/api/clubs/member-list-club/members")
      .set("Cookie", await createSessionCookie(outsider))
      .expect(404);
  });

  it("searches club members by display name while preserving member-only access", async () => {
    const owner = await repository.createUser({
      email: "owner-search@example.com",
      displayName: "Owner Search",
      passwordHash: "$argon2id$v=19$hash"
    });
    const matchingReader = await repository.createUser({
      email: "matching-reader@example.com",
      displayName: "Azure Reader",
      passwordHash: "$argon2id$v=19$hash"
    });
    const otherReader = await repository.createUser({
      email: "other-reader@example.com",
      displayName: "Quiet Viewer",
      passwordHash: "$argon2id$v=19$hash"
    });
    const outsider = await repository.createUser({
      email: "outsider-search@example.com",
      displayName: "Roster Outsider",
      passwordHash: "$argon2id$v=19$hash"
    });
    const club = repository.createClub({
      title: "Member Search Club",
      linkName: "member-search-club",
      visibility: "PUBLIC"
    });

    repository.createMembership(owner.id, club.id, "OWNER");
    const matchingMembershipId = repository.createMembership(
      matchingReader.id,
      club.id,
      "MEMBER"
    );
    repository.createMembership(otherReader.id, club.id, "MEMBER");

    const response = await request(app)
      .get("/api/clubs/member-search-club/members?q=azure")
      .set("Cookie", await createSessionCookie(owner))
      .expect(200);

    expect(response.body).toMatchObject({
      members: [
        {
          id: matchingMembershipId,
          role: "MEMBER",
          user: {
            id: matchingReader.id,
            displayName: "Azure Reader"
          }
        }
      ],
      pagination: {
        page: 1,
        limit: 20,
        total: 1,
        pageCount: 1
      }
    });
    expect(JSON.stringify(response.body)).not.toContain("Quiet Viewer");

    await request(app)
      .get("/api/clubs/member-search-club/members?q=azure")
      .set("Cookie", await createSessionCookie(outsider))
      .expect(404);
  });

  it("lets owners update roles but prevents demoting the last owner", async () => {
    const owner = await repository.createUser({
      email: "owner@example.com",
      displayName: "Owner",
      passwordHash: "$argon2id$v=19$hash"
    });
    const reader = await repository.createUser({
      email: "reader@example.com",
      displayName: "Reader",
      passwordHash: "$argon2id$v=19$hash"
    });
    const club = repository.createClub({
      title: "Role Club",
      linkName: "role-club",
      visibility: "PUBLIC"
    });
    const ownerMembershipId = repository.createMembership(
      owner.id,
      club.id,
      "OWNER"
    );
    const readerMembershipId = repository.createMembership(
      reader.id,
      club.id,
      "MEMBER"
    );

    const promoteResponse = await request(app)
      .patch(`/api/clubs/role-club/members/${readerMembershipId}/role`)
      .set("Cookie", await createSessionCookie(owner))
      .send({ role: "MODERATOR" })
      .expect(200);

    expect(promoteResponse.body.member).toMatchObject({
      id: readerMembershipId,
      role: "MODERATOR"
    });
    expect(
      repository.memberships.find((membership) => membership.id === readerMembershipId)
        ?.role
    ).toBe("MODERATOR");
    expect(repository.auditLogs.map((log) => log.action)).toEqual([
      "CLUB_MEMBER_ROLE_UPDATED"
    ]);

    const demoteResponse = await request(app)
      .patch(`/api/clubs/role-club/members/${ownerMembershipId}/role`)
      .set("Cookie", await createSessionCookie(owner))
      .send({ role: "MEMBER" })
      .expect(409);

    expect(demoteResponse.body.error).toMatchObject({
      code: "CONFLICT",
      message: "This club must keep at least one owner."
    });
  });

  it("limits moderators to banning and unbanning regular members", async () => {
    const owner = await repository.createUser({
      email: "owner@example.com",
      displayName: "Owner",
      passwordHash: "$argon2id$v=19$hash"
    });
    const moderator = await repository.createUser({
      email: "moderator@example.com",
      displayName: "Moderator",
      passwordHash: "$argon2id$v=19$hash"
    });
    const reader = await repository.createUser({
      email: "reader@example.com",
      displayName: "Reader",
      passwordHash: "$argon2id$v=19$hash"
    });
    const club = repository.createClub({
      title: "Ban Club",
      linkName: "ban-club",
      visibility: "PUBLIC"
    });
    const ownerMembershipId = repository.createMembership(
      owner.id,
      club.id,
      "OWNER"
    );
    repository.createMembership(moderator.id, club.id, "MODERATOR");
    const readerMembershipId = repository.createMembership(
      reader.id,
      club.id,
      "MEMBER"
    );
    const readerPostId = repository.createPost(reader.id, club.id);
    const secondReaderPostId = repository.createPost(reader.id, club.id);
    const ownerPostId = repository.createPost(owner.id, club.id);

    await request(app)
      .patch(`/api/clubs/ban-club/members/${readerMembershipId}/role`)
      .set("Cookie", await createSessionCookie(moderator))
      .send({ role: "MODERATOR" })
      .expect(403);

    const banResponse = await request(app)
      .post(`/api/clubs/ban-club/members/${readerMembershipId}/ban`)
      .set("Cookie", await createSessionCookie(moderator))
      .send({ reason: "Repeated spoilers", deleteAuthoredPosts: true })
      .expect(200);

    expect(banResponse.body).toMatchObject({
      deletedPostCount: 2,
      ban: {
        id: expect.any(String),
        roleAtBan: "MEMBER",
        reason: "Repeated spoilers",
        expiresAt: null,
        createdAt: expect.any(String),
        user: {
          id: reader.id,
          displayName: "Reader",
          username: null,
          avatarUrl: null
        }
      }
    });
    expect(
      repository.memberships.some(
        (membership) => membership.id === readerMembershipId
      )
    ).toBe(false);
    expect(repository.posts.find((post) => post.id === readerPostId)?.deletedAt)
      .toBeInstanceOf(Date);
    expect(
      repository.posts.find((post) => post.id === secondReaderPostId)?.deletedAt
    ).toBeInstanceOf(Date);
    expect(repository.posts.find((post) => post.id === ownerPostId)?.deletedAt)
      .toBeNull();

    const bansResponse = await request(app)
      .get("/api/clubs/ban-club/bans")
      .set("Cookie", await createSessionCookie(moderator))
      .expect(200);

    expect(bansResponse.body.bans).toEqual([
      expect.objectContaining({
        id: banResponse.body.ban.id,
        roleAtBan: "MEMBER",
        user: expect.objectContaining({
          id: reader.id
        })
      })
    ]);

    const membersResponse = await request(app)
      .get("/api/clubs/ban-club/members")
      .set("Cookie", await createSessionCookie(moderator))
      .expect(200);
    const memberUserIds = membersResponse.body.members.map(
      (member: { user: { id: string } }) => member.user.id
    );

    expect(memberUserIds).not.toContain(reader.id);
    expect(memberUserIds).toEqual(
      expect.arrayContaining([owner.id, moderator.id])
    );

    await request(app)
      .post(`/api/clubs/ban-club/members/${ownerMembershipId}/ban`)
      .set("Cookie", await createSessionCookie(moderator))
      .send({})
      .expect(403);

    const joinWhileBannedResponse = await request(app)
      .post("/api/clubs/ban-club/join")
      .set("Cookie", await createSessionCookie(reader))
      .expect(403);

    expect(joinWhileBannedResponse.body.error).toMatchObject({
      code: "BANNED",
      message: "You are banned from this club."
    });

    const unbanResponse = await request(app)
      .post(`/api/clubs/ban-club/bans/${banResponse.body.ban.id}/unban`)
      .set("Cookie", await createSessionCookie(moderator))
      .expect(200);

    expect(unbanResponse.body).toMatchObject({
      deletedPostCount: 0,
      ban: {
        id: banResponse.body.ban.id,
        revokedAt: expect.any(String)
      }
    });

    const rejoinResponse = await request(app)
      .post("/api/clubs/ban-club/join")
      .set("Cookie", await createSessionCookie(reader))
      .expect(200);

    expect(rejoinResponse.body.club.membership).toMatchObject({
      isMember: true,
      role: "MEMBER"
    });
    expect(repository.auditLogs.map((log) => log.action)).toEqual([
      "POST_DELETED",
      "POST_DELETED",
      "USER_BANNED",
      "USER_UNBANNED"
    ]);
  });

  it("leaves authored posts alone when ban cleanup is not requested", async () => {
    const owner = await repository.createUser({
      email: "owner@example.com",
      displayName: "Owner",
      passwordHash: "$argon2id$v=19$hash"
    });
    const reader = await repository.createUser({
      email: "reader@example.com",
      displayName: "Reader",
      passwordHash: "$argon2id$v=19$hash"
    });
    const club = repository.createClub({
      title: "Ban Club",
      linkName: "ban-club",
      visibility: "PUBLIC"
    });
    repository.createMembership(owner.id, club.id, "OWNER");
    const readerMembershipId = repository.createMembership(
      reader.id,
      club.id,
      "MEMBER"
    );
    const readerPostId = repository.createPost(reader.id, club.id);

    const response = await request(app)
      .post(`/api/clubs/ban-club/members/${readerMembershipId}/ban`)
      .set("Cookie", await createSessionCookie(owner))
      .send({ deleteAuthoredPosts: false })
      .expect(200);

    expect(response.body.deletedPostCount).toBe(0);
    expect(repository.posts.find((post) => post.id === readerPostId)?.deletedAt)
      .toBeNull();
  });

  it("prevents banning the last owner and blocks banned users from joining", async () => {
    const owner = await repository.createUser({
      email: "owner@example.com",
      displayName: "Owner",
      passwordHash: "$argon2id$v=19$hash"
    });
    const reader = await repository.createUser({
      email: "reader@example.com",
      displayName: "Reader",
      passwordHash: "$argon2id$v=19$hash"
    });
    const club = repository.createClub({
      title: "Protected Club",
      linkName: "protected-club",
      visibility: "PUBLIC"
    });
    const ownerMembershipId = repository.createMembership(
      owner.id,
      club.id,
      "OWNER"
    );
    repository.createBan(reader.id, club.id);

    await request(app)
      .post(`/api/clubs/protected-club/members/${ownerMembershipId}/ban`)
      .set("Cookie", await createSessionCookie(owner))
      .send({})
      .expect(409);

    const response = await request(app)
      .post("/api/clubs/protected-club/join")
      .set("Cookie", await createSessionCookie(reader))
      .expect(403);

    expect(response.body.error).toMatchObject({
      code: "BANNED",
      message: "You are banned from this club."
    });

    const detailResponse = await request(app)
      .get("/api/clubs/protected-club")
      .set("Cookie", await createSessionCookie(reader))
      .expect(403);

    expect(detailResponse.body.error).toMatchObject({
      code: "BANNED",
      message: "You are banned from this club."
    });

    const discoveryResponse = await request(app)
      .get("/api/clubs")
      .set("Cookie", await createSessionCookie(reader))
      .expect(200);

    expect(
      discoveryResponse.body.clubs.map(
        (discoveredClub: { linkName: string }) => discoveredClub.linkName
      )
    ).not.toContain("protected-club");
    expect(repository.memberships).toHaveLength(1);
  });

  it.each([
    ["private", "PRIVATE"],
    ["invite-only", "INVITE_ONLY"]
  ] as const)(
    "does not let signed-in users join %s clubs through the public join endpoint",
    async (_label, visibility) => {
      const reader = await repository.createUser({
        email: `${visibility.toLowerCase()}@example.com`,
        displayName: "Reader",
        passwordHash: "$argon2id$v=19$hash"
      });

      repository.createClub({
        title: "Hidden Story Circle",
        linkName: "hidden-story-circle",
        visibility
      });

      const response = await request(app)
        .post("/api/clubs/hidden-story-circle/join")
        .set("x-request-id", `clubs-join-${visibility.toLowerCase()}`)
        .set("Cookie", await createSessionCookie(reader))
        .expect(404);

      expect(response.body).toEqual({
        error: {
          code: "NOT_FOUND",
          message: "Club not found",
          requestId: `clubs-join-${visibility.toLowerCase()}`
        }
      });
      expect(JSON.stringify(response.body)).not.toContain("Hidden Story Circle");
      expect(repository.memberships).toHaveLength(0);
    }
  );

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

  it("returns safe public club SEO list data without a session", async () => {
    const publicClub = repository.createClub({
      title: "Public Story Circle",
      linkName: "public-story-circle",
      description: "Safe public discussion.",
      category: "BOOKS",
      rules: "Rules stay on detail only.",
      visibility: "PUBLIC"
    });
    repository.createClub({
      title: "Private Plot Room",
      linkName: "private-plot-room",
      description: "Hidden private discussion.",
      category: "TV_SHOWS",
      visibility: "PRIVATE"
    });
    repository.createClub({
      title: "Invite Arc Watch",
      linkName: "invite-arc-watch",
      description: "Hidden invite-only discussion.",
      category: "ANIME",
      visibility: "INVITE_ONLY"
    });

    repository.createMembership(crypto.randomUUID(), publicClub.id);

    const response = await request(app).get("/api/public/clubs").expect(200);

    expect(response.body).toEqual({
      clubs: [
        {
          id: publicClub.id,
          title: "Public Story Circle",
          linkName: "public-story-circle",
          description: "Safe public discussion.",
          category: "BOOKS",
          coverUrl: null,
          visibility: "PUBLIC",
          memberCount: 1,
          createdAt: publicClub.createdAt.toISOString(),
          updatedAt: publicClub.updatedAt.toISOString()
        }
      ],
      pagination: {
        page: 1,
        limit: 12,
        total: 1,
        pageCount: 1
      }
    });
    expect(Object.keys(response.body.clubs[0]).sort()).toEqual(
      [
        "category",
        "coverUrl",
        "createdAt",
        "description",
        "id",
        "linkName",
        "memberCount",
        "title",
        "updatedAt",
        "visibility"
      ].sort()
    );
    expect(JSON.stringify(response.body)).not.toContain("Rules stay on detail");
    expect(JSON.stringify(response.body)).not.toContain("Private Plot Room");
    expect(JSON.stringify(response.body)).not.toContain("Invite Arc Watch");
  });

  it("returns safe public club SEO detail data without membership fields", async () => {
    const publicClub = repository.createClub({
      title: "Public Rules Club",
      linkName: "public-rules-club",
      description: "Public metadata only.",
      category: "COURSES",
      rules: "Keep future lessons out of early threads.",
      visibility: "PUBLIC"
    });

    const response = await request(app)
      .get("/api/public/clubs/public-rules-club")
      .expect(200);

    expect(response.body.club).toEqual({
      id: publicClub.id,
      title: "Public Rules Club",
      linkName: "public-rules-club",
      description: "Public metadata only.",
      category: "COURSES",
      coverUrl: null,
      visibility: "PUBLIC",
      memberCount: 0,
      rules: "Keep future lessons out of early threads.",
      createdAt: publicClub.createdAt.toISOString(),
      updatedAt: publicClub.updatedAt.toISOString()
    });
    expect(Object.keys(response.body.club).sort()).toEqual(
      [
        "category",
        "coverUrl",
        "createdAt",
        "description",
        "id",
        "linkName",
        "memberCount",
        "rules",
        "title",
        "updatedAt",
        "visibility"
      ].sort()
    );
    expect(response.body.club).not.toHaveProperty("membership");
    expect(response.body.club).not.toHaveProperty("settings");
  });

  it("filters public SEO club reads for signed-in banned users", async () => {
    const bannedUser = await repository.createUser({
      email: "banned@example.com",
      displayName: "Banned Reader",
      passwordHash: "$argon2id$v=19$hash"
    });
    const visibleClub = repository.createClub({
      title: "Visible Public Club",
      linkName: "visible-public-club",
      visibility: "PUBLIC"
    });
    const bannedClub = repository.createClub({
      title: "Banned Public Club",
      linkName: "banned-public-club",
      visibility: "PUBLIC"
    });

    repository.createMembership(bannedUser.id, visibleClub.id);
    repository.createMembership(bannedUser.id, bannedClub.id);
    repository.createBan(bannedUser.id, bannedClub.id);

    const listResponse = await request(app)
      .get("/api/public/clubs")
      .set("Cookie", await createSessionCookie(bannedUser))
      .expect(200);

    expect(
      listResponse.body.clubs.map((club: { linkName: string }) => club.linkName)
    ).toEqual(["visible-public-club"]);

    await request(app)
      .get("/api/public/clubs/banned-public-club")
      .set("x-request-id", "public-club-banned")
      .set("Cookie", await createSessionCookie(bannedUser))
      .expect(404)
      .expect((response) => {
        expect(response.body).toEqual({
          error: {
            code: "NOT_FOUND",
            message: "Club not found",
            requestId: "public-club-banned"
          }
        });
      });
  });

  it("rejects invalid public SEO club query and detail params", async () => {
    await request(app)
      .get("/api/public/clubs?page=0&limit=51&sort=unknown")
      .set("x-request-id", "public-clubs-invalid-query")
      .expect(400)
      .expect((response) => {
        expect(response.body).toEqual({
          error: {
            code: "BAD_REQUEST",
            message: "Check the public club discovery query and try again.",
            requestId: "public-clubs-invalid-query"
          }
        });
      });

    await request(app)
      .get("/api/public/clubs/not%20ok")
      .set("x-request-id", "public-club-invalid-url")
      .expect(400)
      .expect((response) => {
        expect(response.body).toEqual({
          error: {
            code: "BAD_REQUEST",
            message: "Check the public club URL and try again.",
            requestId: "public-club-invalid-url"
          }
        });
      });
  });

  it("generates a sitemap with only homepage, public directory, and public club URLs", async () => {
    repository.createClub({
      title: "Public Sitemap Club",
      linkName: "public-sitemap-club",
      visibility: "PUBLIC",
      createdAt: new Date("2026-01-02T00:00:00.000Z")
    });
    repository.createClub({
      title: "Private Sitemap Club",
      linkName: "private-sitemap-club",
      visibility: "PRIVATE",
      createdAt: new Date("2026-01-03T00:00:00.000Z")
    });

    const response = await request(app).get("/sitemap.xml").expect(200);

    expect(response.headers["content-type"]).toContain("application/xml");
    expect(response.text).toContain(
      "<loc>https://loresafe-web.vercel.app/</loc>"
    );
    expect(response.text).toContain(
      "<loc>https://loresafe-web.vercel.app/clubs</loc>"
    );
    expect(response.text).toContain(
      "<loc>https://loresafe-web.vercel.app/clubs/public-sitemap-club</loc>"
    );
    expect(response.text).not.toContain("/app");
    expect(response.text).not.toContain("/login");
    expect(response.text).not.toContain("/signup");
    expect(response.text).not.toContain("/invite");
    expect(response.text).not.toContain("/api");
    expect(response.text).not.toContain("private-sitemap-club");
  });

  it("returns only public clubs to signed-in users", async () => {
    const user = await repository.createUser({
      email: "reader@example.com",
      displayName: "Reader",
      passwordHash: "$argon2id$v=19$hash"
    });
    const publicClub = repository.createClub({
      title: "Public Story Circle",
      linkName: "public-story-circle",
      description: "Safe public discussion.",
      category: "BOOKS",
      visibility: "PUBLIC"
    });
    const privateClub = repository.createClub({
      title: "Private Plot Room",
      linkName: "private-plot-room",
      description: "Hidden private discussion.",
      category: "TV_SHOWS",
      visibility: "PRIVATE"
    });
    const inviteOnlyClub = repository.createClub({
      title: "Invite Arc Watch",
      linkName: "invite-arc-watch",
      description: "Hidden invite-only discussion.",
      category: "ANIME",
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
          linkName: "public-story-circle",
          description: "Safe public discussion.",
          category: "BOOKS",
          coverUrl: null,
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

  it("returns popular public clubs by member count with a requested cap", async () => {
    const user = await repository.createUser({
      email: "reader@example.com",
      displayName: "Reader",
      passwordHash: "$argon2id$v=19$hash"
    });

    Array.from({ length: 12 }, (_, index) => {
      const clubNumber = index + 1;
      const club = repository.createClub({
        title: `Public Club ${clubNumber}`,
        linkName: `public-club-${clubNumber}`,
        visibility: "PUBLIC"
      });

      Array.from({ length: clubNumber }, () => {
        repository.createMembership(crypto.randomUUID(), club.id);
      });
    });

    const privateClub = repository.createClub({
      title: "Private Giant Club",
      linkName: "private-giant-club",
      visibility: "PRIVATE"
    });

    Array.from({ length: 30 }, () => {
      repository.createMembership(crypto.randomUUID(), privateClub.id);
    });

    const response = await request(app)
      .get("/api/clubs?sort=popular&limit=10")
      .set("Cookie", await createSessionCookie(user))
      .expect(200);

    expect(response.body.clubs.map((club: { title: string }) => club.title)).toEqual([
      "Public Club 12",
      "Public Club 11",
      "Public Club 10",
      "Public Club 9",
      "Public Club 8",
      "Public Club 7",
      "Public Club 6",
      "Public Club 5",
      "Public Club 4",
      "Public Club 3"
    ]);
    expect(
      response.body.clubs.map((club: { memberCount: number }) => club.memberCount)
    ).toEqual([12, 11, 10, 9, 8, 7, 6, 5, 4, 3]);
    expect(response.body.pagination).toEqual({
      page: 1,
      limit: 10,
      total: 12,
      pageCount: 2
    });
    expect(JSON.stringify(response.body)).not.toContain("Private Giant Club");
  });

  it("returns narrow public club DTO fields", async () => {
    const user = await repository.createUser({
      email: "reader@example.com",
      displayName: "Reader",
      passwordHash: "$argon2id$v=19$hash"
    });

    repository.createClub({
      title: "Public Story Circle",
      linkName: "public-story-circle",
      description: null,
      category: "CUSTOM_TIMELINE",
      visibility: "PUBLIC"
    });

    const response = await request(app)
      .get("/api/clubs")
      .set("Cookie", await createSessionCookie(user))
      .expect(200);

    expect(Object.keys(response.body.clubs[0]).sort()).toEqual(
      [
        "category",
        "coverUrl",
        "createdAt",
        "description",
        "id",
        "memberCount",
        "linkName",
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
      linkName: "public-story-circle",
      description: null,
      category: "CUSTOM_TIMELINE",
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
        "coverUrl",
        "createdAt",
        "currentUserRole",
        "description",
        "id",
        "memberCount",
        "membership",
        "rules",
        "settings",
        "linkName",
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

  it("lets owners update club visibility and rules", async () => {
    const owner = await repository.createUser({
      email: "owner@example.com",
      displayName: "Owner",
      passwordHash: "$argon2id$v=19$hash"
    });
    const club = repository.createClub({
      title: "Settings Club",
      linkName: "settings-club",
      rules: "Old rules.",
      visibility: "PUBLIC"
    });

    repository.createMembership(owner.id, club.id, "OWNER");

    const response = await request(app)
      .patch("/api/clubs/settings-club/settings")
      .set("Cookie", await createSessionCookie(owner))
      .send({
        visibility: "PRIVATE",
        rules: "  Keep finale spoilers out of early threads.  "
      })
      .expect(200);

    expect(response.body.club).toMatchObject({
      linkName: "settings-club",
      visibility: "PRIVATE",
      rules: "Keep finale spoilers out of early threads.",
      settings: {
        visibility: "PRIVATE",
        rules: "Keep finale spoilers out of early threads."
      },
      membership: {
        isMember: true,
        role: "OWNER"
      }
    });
    expect(repository.clubs.get(club.id)?.visibility).toBe("PRIVATE");
    expect(repository.clubs.get(club.id)?.rules).toBe(
      "Keep finale spoilers out of early threads."
    );
  });

  it("lets moderators update club settings and clear rules", async () => {
    const moderator = await repository.createUser({
      email: "moderator@example.com",
      displayName: "Moderator",
      passwordHash: "$argon2id$v=19$hash"
    });
    const club = repository.createClub({
      title: "Moderator Settings Club",
      linkName: "moderator-settings-club",
      rules: "Old rules.",
      visibility: "PRIVATE"
    });

    repository.createMembership(moderator.id, club.id, "MODERATOR");

    const response = await request(app)
      .patch("/api/clubs/moderator-settings-club/settings")
      .set("Cookie", await createSessionCookie(moderator))
      .send({
        visibility: "INVITE_ONLY",
        rules: null
      })
      .expect(200);

    expect(response.body.club).toMatchObject({
      visibility: "INVITE_ONLY",
      rules: null,
      settings: {
        visibility: "INVITE_ONLY",
        rules: null
      },
      membership: {
        isMember: true,
        role: "MODERATOR"
      }
    });
  });

  it("prevents normal members from updating club settings", async () => {
    const member = await repository.createUser({
      email: "member@example.com",
      displayName: "Member",
      passwordHash: "$argon2id$v=19$hash"
    });
    const club = repository.createClub({
      title: "Member Settings Club",
      linkName: "member-settings-club",
      rules: "Original rules.",
      visibility: "PUBLIC"
    });

    repository.createMembership(member.id, club.id, "MEMBER");

    const response = await request(app)
      .patch("/api/clubs/member-settings-club/settings")
      .set("x-request-id", "member-settings-denied")
      .set("Cookie", await createSessionCookie(member))
      .send({
        visibility: "PRIVATE",
        rules: "Member should not update this."
      })
      .expect(403);

    expect(response.body).toEqual({
      error: {
        code: "FORBIDDEN",
        message: "Only club owners and moderators can update club settings.",
        requestId: "member-settings-denied"
      }
    });
    expect(repository.clubs.get(club.id)?.visibility).toBe("PUBLIC");
    expect(repository.clubs.get(club.id)?.rules).toBe("Original rules.");
  });

  it("hides private club settings updates from non-members", async () => {
    const reader = await repository.createUser({
      email: "reader@example.com",
      displayName: "Reader",
      passwordHash: "$argon2id$v=19$hash"
    });

    repository.createClub({
      title: "Hidden Settings Club",
      linkName: "hidden-settings-club",
      visibility: "PRIVATE"
    });

    const response = await request(app)
      .patch("/api/clubs/hidden-settings-club/settings")
      .set("x-request-id", "hidden-settings-denied")
      .set("Cookie", await createSessionCookie(reader))
      .send({
        visibility: "PUBLIC",
        rules: "Should not update."
      })
      .expect(404);

    expect(response.body).toEqual({
      error: {
        code: "NOT_FOUND",
        message: "Club not found",
        requestId: "hidden-settings-denied"
      }
    });
  });

  it("blocks banned actors from updating club settings", async () => {
    const owner = await repository.createUser({
      email: "owner@example.com",
      displayName: "Owner",
      passwordHash: "$argon2id$v=19$hash"
    });
    const club = repository.createClub({
      title: "Banned Settings Club",
      linkName: "banned-settings-club",
      visibility: "PUBLIC"
    });

    repository.createMembership(owner.id, club.id, "OWNER");
    repository.createBan(owner.id, club.id, {
      roleAtBan: "OWNER"
    });

    const response = await request(app)
      .patch("/api/clubs/banned-settings-club/settings")
      .set("x-request-id", "banned-settings-denied")
      .set("Cookie", await createSessionCookie(owner))
      .send({
        visibility: "PRIVATE",
        rules: "Should not update."
      })
      .expect(403);

    expect(response.body).toEqual({
      error: {
        code: "BANNED",
        message: "You are banned from this club.",
        requestId: "banned-settings-denied"
      }
    });
  });

  it.each([
    ["visibility", { visibility: "FRIENDS_ONLY", rules: "Valid rules." }],
    ["rules", { visibility: "PUBLIC", rules: "x".repeat(2001) }],
    [
      "extra fields",
      {
        visibility: "PUBLIC",
        rules: "Valid rules.",
        title: "Unexpected"
      }
    ]
  ])("rejects invalid club settings payloads for %s", async (_label, body) => {
    const owner = await repository.createUser({
      email: "owner@example.com",
      displayName: "Owner",
      passwordHash: "$argon2id$v=19$hash"
    });
    const club = repository.createClub({
      title: "Invalid Settings Club",
      linkName: "invalid-settings-club",
      visibility: "PUBLIC"
    });

    repository.createMembership(owner.id, club.id, "OWNER");

    const response = await request(app)
      .patch("/api/clubs/invalid-settings-club/settings")
      .set("x-request-id", "invalid-club-settings")
      .set("Cookie", await createSessionCookie(owner))
      .send(body)
      .expect(400);

    expect(response.body).toEqual({
      error: {
        code: "BAD_REQUEST",
        message: "Check the club settings request and try again.",
        requestId: "invalid-club-settings"
      }
    });
  });

  it("rejects malformed club settings URLs", async () => {
    const owner = await repository.createUser({
      email: "owner@example.com",
      displayName: "Owner",
      passwordHash: "$argon2id$v=19$hash"
    });

    const response = await request(app)
      .patch("/api/clubs/not%20ok/settings")
      .set("x-request-id", "invalid-club-settings-url")
      .set("Cookie", await createSessionCookie(owner))
      .send({
        visibility: "PUBLIC",
        rules: "Valid rules."
      })
      .expect(400);

    expect(response.body).toEqual({
      error: {
        code: "BAD_REQUEST",
        message: "Check the club settings request and try again.",
        requestId: "invalid-club-settings-url"
      }
    });
  });

  it("updates public discovery when club visibility changes", async () => {
    const owner = await repository.createUser({
      email: "owner@example.com",
      displayName: "Owner",
      passwordHash: "$argon2id$v=19$hash"
    });
    const reader = await repository.createUser({
      email: "reader@example.com",
      displayName: "Reader",
      passwordHash: "$argon2id$v=19$hash"
    });
    const club = repository.createClub({
      title: "Discovery Settings Club",
      linkName: "discovery-settings-club",
      visibility: "PUBLIC"
    });

    repository.createMembership(owner.id, club.id, "OWNER");

    await request(app)
      .patch("/api/clubs/discovery-settings-club/settings")
      .set("Cookie", await createSessionCookie(owner))
      .send({
        visibility: "PRIVATE",
        rules: null
      })
      .expect(200);

    const privateDiscoveryResponse = await request(app)
      .get("/api/clubs")
      .set("Cookie", await createSessionCookie(reader))
      .expect(200);

    expect(
      privateDiscoveryResponse.body.clubs.map(
        (discoveredClub: { linkName: string }) => discoveredClub.linkName
      )
    ).not.toContain("discovery-settings-club");

    await request(app)
      .patch("/api/clubs/discovery-settings-club/settings")
      .set("Cookie", await createSessionCookie(owner))
      .send({
        visibility: "PUBLIC",
        rules: null
      })
      .expect(200);

    const publicDiscoveryResponse = await request(app)
      .get("/api/clubs")
      .set("Cookie", await createSessionCookie(reader))
      .expect(200);

    expect(
      publicDiscoveryResponse.body.clubs.map(
        (discoveredClub: { linkName: string }) => discoveredClub.linkName
      )
    ).toContain("discovery-settings-club");
  });

  it("paginates public discovery results", async () => {
    const user = await repository.createUser({
      email: "reader@example.com",
      displayName: "Reader",
      passwordHash: "$argon2id$v=19$hash"
    });

    repository.createClub({
      title: "First Public Club",
      linkName: "first-public-club",
      visibility: "PUBLIC",
      createdAt: new Date("2026-01-01T00:00:00.000Z")
    });
    repository.createClub({
      title: "Second Public Club",
      linkName: "second-public-club",
      visibility: "PUBLIC",
      createdAt: new Date("2026-01-02T00:00:00.000Z")
    });
    repository.createClub({
      title: "Third Public Club",
      linkName: "third-public-club",
      visibility: "PUBLIC",
      createdAt: new Date("2026-01-03T00:00:00.000Z")
    });

    const response = await request(app)
      .get("/api/clubs?page=2&limit=2")
      .set("Cookie", await createSessionCookie(user))
      .expect(200);

    expect(response.body.clubs.map((club: { linkName: string }) => club.linkName)).toEqual([
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

  it("rejects popular discovery limits above 20", async () => {
    const user = await repository.createUser({
      email: "reader@example.com",
      displayName: "Reader",
      passwordHash: "$argon2id$v=19$hash"
    });

    const response = await request(app)
      .get("/api/clubs?sort=popular&limit=21")
      .set("x-request-id", "clubs-popular-limit")
      .set("Cookie", await createSessionCookie(user))
      .expect(400);

    expect(response.body).toEqual({
      error: {
        code: "BAD_REQUEST",
        message: "Check the club discovery query and try again.",
        requestId: "clubs-popular-limit"
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
  app.use(
    "/sitemap.xml",
    createSitemapRouter(clubsService, {
      ...env,
      PUBLIC_SITE_ORIGIN: "https://loresafe-web.vercel.app"
    })
  );
  app.use(
    "/api/public/clubs",
    createPublicClubsRouter(clubsController, authMiddleware)
  );
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
  linkName: string;
  description?: string | null;
  category?: ClubCategory;
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
    id: string;
    userId: string;
    clubId: string;
    role: "OWNER" | "MODERATOR" | "MEMBER";
  }> = [];
  readonly bans: Array<{
    id: string;
    userId: string;
    clubId: string;
    roleAtBan: "OWNER" | "MODERATOR" | "MEMBER" | null;
    reason: string | null;
    expiresAt: Date | null;
    revokedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }> = [];
  readonly posts: Array<{
    id: string;
    authorId: string;
    clubId: string;
    deletedAt: Date | null;
  }> = [];
  readonly auditLogs: Array<{
    action:
      | "CLUB_MEMBER_ROLE_UPDATED"
      | "POST_DELETED"
      | "USER_BANNED"
      | "USER_UNBANNED";
    actorId: string;
    clubId: string;
    targetUserId: string;
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
    linkName,
    description = null,
    category = "CUSTOM_TIMELINE",
    rules = null,
    visibility,
    createdAt = new Date()
  }: CreateStoredClubInput) => {
    const club = {
      id: crypto.randomUUID(),
      title,
      linkName,
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
    const membership = {
      id: crypto.randomUUID(),
      userId,
      clubId,
      role
    };

    Object.defineProperty(membership, "id", {
      value: membership.id,
      enumerable: false
    });
    this.memberships.push(membership);

    return membership.id;
  };

  createBan = (
    userId: string,
    clubId: string,
    input: {
      roleAtBan?: "OWNER" | "MODERATOR" | "MEMBER" | null;
      reason?: string | null;
      expiresAt?: Date | null;
      revokedAt?: Date | null;
    } = {}
  ) => {
    const membership = this.findMembership(userId, clubId);
    const now = new Date();
    const ban = {
      id: crypto.randomUUID(),
      userId,
      clubId,
      roleAtBan: input.roleAtBan ?? membership?.role ?? null,
      reason: input.reason ?? null,
      expiresAt: input.expiresAt ?? null,
      revokedAt: input.revokedAt ?? null,
      createdAt: now,
      updatedAt: now
    };

    this.bans.push(ban);
    this.removeMembership(userId, clubId);

    return ban.id;
  };

  createPost = (authorId: string, clubId: string) => {
    const post = {
      id: crypto.randomUUID(),
      authorId,
      clubId,
      deletedAt: null
    };

    this.posts.push(post);

    return post.id;
  };

  createClubWithOwnerMembership = async (
    userId: string,
    input: CreateClubRequest
  ) => {
    if (await this.findClubByLinkName(input.linkName)) {
      throw {
        code: "P2002"
      };
    }

    const club = this.createClub({
      title: input.title,
      linkName: input.linkName,
      description: input.description,
      category: input.category,
      rules: input.rules,
      visibility: input.visibility
    });

    this.createMembership(userId, club.id, "OWNER");

    return this.toClubDetailRecord(club, userId);
  };

  findClubByLinkName = async (linkName: string) => {
    const club = this.findStoredClubByLinkName(linkName);

    return club ? { id: club.id } : null;
  };

  findVisibleClubByLinkNameForUser = async (linkName: string, userId: string) => {
    const club = this.findStoredClubByLinkName(linkName);

    if (!club) {
      return null;
    }

    const detail = this.toClubDetailRecord(club, userId);

    if (
      !detail.isCurrentUserBanned &&
      detail.visibility !== "PUBLIC" &&
      !detail.currentUserRole
    ) {
      return null;
    }

    return detail;
  };

  joinPublicClubByLinkName = async (linkName: string, userId: string) => {
    const club = this.findStoredClubByLinkName(linkName);

    if (!club || club.visibility !== "PUBLIC") {
      return {
        status: "NOT_FOUND" as const
      };
    }

    if (this.hasActiveBan(userId, club.id)) {
      return {
        status: "BANNED" as const
      };
    }

    const existingMembership = this.memberships.find(
      (membership) =>
        membership.clubId === club.id && membership.userId === userId
    );

    if (!existingMembership) {
      this.createMembership(userId, club.id, "MEMBER");
    }

    return {
      status: "SUCCESS" as const,
      club: this.toClubDetailRecord(club, userId)
    };
  };

  leaveClubByLinkName = async (
    linkName: string,
    userId: string
  ): Promise<LeaveClubResult> => {
    const club = this.findStoredClubByLinkName(linkName);

    if (!club) {
      return { status: "CLUB_NOT_FOUND" };
    }

    if (this.hasActiveBan(userId, club.id)) {
      return { status: "ACTOR_BANNED" };
    }

    const membership = this.findMembership(userId, club.id);

    if (!membership) {
      return { status: "MEMBER_NOT_FOUND" };
    }

    if (
      membership.role === "OWNER" &&
      this.memberships.filter(
        (currentMembership) =>
          currentMembership.clubId === club.id &&
          currentMembership.role === "OWNER"
      ).length <= 1
    ) {
      return { status: "LAST_OWNER" };
    }

    this.removeMembership(userId, club.id);

    return {
      status: "SUCCESS",
      club: {
        id: club.id,
        linkName: club.linkName
      }
    };
  };

  updateClubSettings = async (
    linkName: string,
    actorId: string,
    input: UpdateClubSettingsRequest
  ): Promise<ClubSettingsMutationResult> => {
    const club = this.findStoredClubByLinkName(linkName);

    if (!club) {
      return { status: "CLUB_NOT_FOUND" };
    }

    if (this.hasActiveBan(actorId, club.id)) {
      return { status: "ACTOR_BANNED" };
    }

    const actorRole = this.findMembership(actorId, club.id)?.role ?? null;

    if (!actorRole && club.visibility !== "PUBLIC") {
      return { status: "CLUB_NOT_FOUND" };
    }

    if (!canTestManageSettings(actorRole)) {
      return { status: "ACTOR_NOT_ALLOWED" };
    }

    club.visibility = input.visibility;
    club.rules = input.rules;
    club.updatedAt = new Date();

    return {
      status: "SUCCESS",
      club: this.toClubDetailRecord(club, actorId)
    };
  };

  listClubMembersByLinkName = async (
    linkName: string,
    userId: string,
    query: ListClubMembersQuery
  ) => {
    const { page, limit } = query;
    const club = this.findStoredClubByLinkName(linkName);

    if (!club) {
      return {
        club: null,
        members: [],
        total: 0
      };
    }

    const currentUserRole =
      this.findMembership(userId, club.id)?.role ?? null;
    const isCurrentUserBanned = this.hasActiveBan(userId, club.id);

    if (!currentUserRole || isCurrentUserBanned) {
      return {
        club: {
          id: club.id,
          currentUserRole,
          isCurrentUserBanned
        },
        members: [],
        total: 0
      };
    }

    const normalizedQuery = query.q?.toLowerCase() ?? null;
    const members = this.memberships
      .filter((membership) => membership.clubId === club.id)
      .filter((membership) => {
        if (!normalizedQuery) {
          return true;
        }

        const user = this.findUserById(membership.userId);
        const username = user?.username?.toLowerCase() ?? "";
        const displayName = user?.displayName.toLowerCase() ?? "";

        return (
          displayName.includes(normalizedQuery) ||
          username.includes(normalizedQuery)
        );
      })
      .sort(
        (left, right) =>
          roleSortValue(left.role) - roleSortValue(right.role) ||
          left.userId.localeCompare(right.userId)
      );
    const start = (page - 1) * limit;

    return {
      club: {
        id: club.id,
        currentUserRole,
        isCurrentUserBanned
      },
      members: members
        .slice(start, start + limit)
        .map((membership) => this.toClubMemberRecord(membership)),
      total: members.length
    };
  };

  listClubBansByLinkName = async (
    linkName: string,
    userId: string,
    { page, limit }: ListClubBansQuery
  ) => {
    const club = this.findStoredClubByLinkName(linkName);

    if (!club) {
      return {
        club: null,
        bans: [],
        total: 0
      };
    }

    const currentUserRole =
      this.findMembership(userId, club.id)?.role ?? null;
    const isCurrentUserBanned = this.hasActiveBan(userId, club.id);

    if (
      !currentUserRole ||
      isCurrentUserBanned ||
      !canTestManageBans(currentUserRole)
    ) {
      return {
        club: {
          id: club.id,
          currentUserRole,
          isCurrentUserBanned
        },
        bans: [],
        total: 0
      };
    }

    const activeBans = this.bans
      .filter((ban) => ban.clubId === club.id && this.isActiveBan(ban))
      .sort(
        (left, right) =>
          right.createdAt.getTime() - left.createdAt.getTime() ||
          left.id.localeCompare(right.id)
      );
    const start = (page - 1) * limit;

    return {
      club: {
        id: club.id,
        currentUserRole,
        isCurrentUserBanned
      },
      bans: activeBans
        .slice(start, start + limit)
        .map((ban) => this.toClubBanRecord(ban)),
      total: activeBans.length
    };
  };

  updateClubMemberRole = async (
    linkName: string,
    membershipId: string,
    actorId: string,
    role: "OWNER" | "MODERATOR" | "MEMBER"
  ): Promise<ClubMemberMutationResult> => {
    const context = this.findMemberContext(linkName, actorId, membershipId);

    if (!context.club) {
      return { status: "CLUB_NOT_FOUND" };
    }

    if (!context.actorRole) {
      return { status: "CLUB_NOT_FOUND" };
    }

    if (context.isActorBanned) {
      return { status: "ACTOR_BANNED" };
    }

    if (!context.member) {
      return { status: "MEMBER_NOT_FOUND" };
    }

    if (context.actorRole !== "OWNER") {
      return { status: "ACTOR_NOT_ALLOWED" };
    }

    if (
      context.member.role === "OWNER" &&
      role !== "OWNER" &&
      context.ownerCount <= 1
    ) {
      return { status: "LAST_OWNER" };
    }

    context.member.role = role;
    this.createAuditLog(
      "CLUB_MEMBER_ROLE_UPDATED",
      actorId,
      context.club.id,
      context.member.userId
    );

    return {
      status: "SUCCESS",
      member: this.toClubMemberRecord(context.member)
    };
  };

  banClubMember = async (
    linkName: string,
    membershipId: string,
    actorId: string,
    input: BanClubMemberRequest
  ): Promise<ClubBanMutationResult> => {
    const context = this.findMemberContext(linkName, actorId, membershipId);

    if (!context.club) {
      return { status: "CLUB_NOT_FOUND" };
    }

    if (!context.actorRole) {
      return { status: "CLUB_NOT_FOUND" };
    }

    if (context.isActorBanned) {
      return { status: "ACTOR_BANNED" };
    }

    if (!context.member) {
      return { status: "MEMBER_NOT_FOUND" };
    }

    if (!canTestActorBanTarget(context.actorRole, context.member.role)) {
      return { status: "ACTOR_NOT_ALLOWED" };
    }

    if (context.member.role === "OWNER" && context.ownerCount <= 1) {
      return { status: "LAST_OWNER" };
    }

    const activeBan = this.findActiveBan(context.member.userId, context.club.id);
    const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
    let ban: (typeof this.bans)[number] | undefined;

    if (activeBan) {
      activeBan.reason = input.reason ?? null;
      activeBan.expiresAt = expiresAt;
      activeBan.roleAtBan = context.member.role;
      activeBan.updatedAt = new Date();
      ban = activeBan;
    } else {
      const banId = this.createBan(context.member.userId, context.club.id, {
        roleAtBan: context.member.role,
        reason: input.reason ?? null,
        expiresAt
      });
      ban = this.bans.find((row) => row.id === banId);
    }

    if (!ban) {
      throw new Error("Expected test ban to be created.");
    }

    const deletedPostCount = input.deleteAuthoredPosts
      ? this.softDeleteAuthoredPosts(
          actorId,
          context.club.id,
          context.member.userId
        )
      : 0;
    this.removeMembership(context.member.userId, context.club.id);

    this.createAuditLog(
      "USER_BANNED",
      actorId,
      context.club.id,
      context.member.userId
    );

    return {
      status: "SUCCESS",
      ban: this.toClubBanRecord(ban),
      deletedPostCount
    };
  };

  unbanClubBan = async (
    linkName: string,
    banId: string,
    actorId: string
  ): Promise<ClubBanMutationResult> => {
    const context = this.findBanContext(linkName, actorId, banId);

    if (!context.club) {
      return { status: "CLUB_NOT_FOUND" };
    }

    if (!context.actorRole) {
      return { status: "CLUB_NOT_FOUND" };
    }

    if (context.isActorBanned) {
      return { status: "ACTOR_BANNED" };
    }

    if (!context.ban) {
      return { status: "BAN_NOT_FOUND" };
    }

    if (!canTestActorUnbanRole(context.actorRole, context.ban.roleAtBan)) {
      return { status: "ACTOR_NOT_ALLOWED" };
    }

    for (const ban of this.bans) {
      if (
        ban.userId === context.ban.userId &&
        ban.clubId === context.club.id &&
        this.isActiveBan(ban)
      ) {
        ban.revokedAt = new Date();
        ban.updatedAt = ban.revokedAt;
      }
    }
    const revokedBan = this.bans.find((ban) => ban.id === context.ban?.id);

    if (!revokedBan) {
      throw new Error("Expected test ban to exist.");
    }

    this.createAuditLog(
      "USER_UNBANNED",
      actorId,
      context.club.id,
      context.ban.userId
    );

    return {
      status: "SUCCESS",
      ban: this.toClubBanRecord(revokedBan),
      deletedPostCount: 0
    };
  };

  listPublicClubs = async (userId: string, { limit, page, sort }: ListClubsQuery) => {
    const publicClubs = Array.from(this.clubs.values())
      .filter(
        (club) =>
          club.visibility === "PUBLIC" && !this.hasActiveBan(userId, club.id)
      )
      .sort((leftClub, rightClub) => {
        if (sort === "popular") {
          const memberCountDifference =
            this.countClubMembers(rightClub.id) - this.countClubMembers(leftClub.id);

          if (memberCountDifference !== 0) {
            return memberCountDifference;
          }
        }

        return (
          rightClub.createdAt.getTime() - leftClub.createdAt.getTime() ||
          leftClub.id.localeCompare(rightClub.id)
        );
      });
    const start = (page - 1) * limit;
    const clubs = publicClubs.slice(start, start + limit).map((club) => ({
      ...club,
      visibility: "PUBLIC" as const,
      memberCount: this.countClubMembers(club.id)
    }));

    return {
      clubs,
      total: publicClubs.length
    };
  };

  listPublicSeoClubs = async (
    currentUserId: string | null,
    { limit, page, sort }: ListPublicSeoClubsQuery
  ) => {
    const publicClubs = this.getPublicSeoClubs(currentUserId)
      .sort((leftClub, rightClub) => {
        if (sort === "popular") {
          const memberCountDifference =
            this.countClubMembers(rightClub.id) - this.countClubMembers(leftClub.id);

          if (memberCountDifference !== 0) {
            return memberCountDifference;
          }
        }

        return (
          rightClub.createdAt.getTime() - leftClub.createdAt.getTime() ||
          leftClub.id.localeCompare(rightClub.id)
        );
      });
    const start = (page - 1) * limit;

    return {
      clubs: publicClubs.slice(start, start + limit).map((club) => ({
        ...club,
        visibility: "PUBLIC" as const,
        memberCount: this.countClubMembers(club.id)
      })),
      total: publicClubs.length
    };
  };

  findPublicSeoClubByLinkName = async (
    linkName: string,
    currentUserId: string | null
  ): Promise<PublicClubDetailRecord | null> => {
    const club = this.getPublicSeoClubs(currentUserId).find(
      (candidate) => candidate.linkName === linkName
    );

    return club
      ? {
          ...club,
          visibility: "PUBLIC" as const,
          memberCount: this.countClubMembers(club.id)
        }
      : null;
  };

  listPublicClubSitemapEntries = async (
    limit: number
  ): Promise<{ entries: PublicClubSitemapEntryRecord[] }> => ({
    entries: Array.from(this.clubs.values())
      .filter((club) => club.visibility === "PUBLIC")
      .sort(
        (leftClub, rightClub) =>
          rightClub.updatedAt.getTime() - leftClub.updatedAt.getTime() ||
          leftClub.id.localeCompare(rightClub.id)
      )
      .slice(0, limit)
      .map((club) => ({
        linkName: club.linkName,
        updatedAt: club.updatedAt
      }))
  });

  private countClubMembers = (clubId: string) =>
    this.memberships.filter((membership) => membership.clubId === clubId).length;

  private getPublicSeoClubs = (currentUserId: string | null) =>
    Array.from(this.clubs.values()).filter(
      (club) =>
        club.visibility === "PUBLIC" &&
        (!currentUserId || !this.hasActiveBan(currentUserId, club.id))
    );

  private findStoredClubByLinkName = (linkName: string) => {
    for (const club of this.clubs.values()) {
      if (club.linkName === linkName) {
        return club;
      }
    }

    return null;
  };

  private findMembership = (userId: string, clubId: string) =>
    this.memberships.find(
      (membership) =>
        membership.clubId === clubId && membership.userId === userId
    ) ?? null;

  private removeMembership = (userId: string, clubId: string) => {
    const membershipIndex = this.memberships.findIndex(
      (membership) =>
        membership.clubId === clubId && membership.userId === userId
    );

    if (membershipIndex >= 0) {
      this.memberships.splice(membershipIndex, 1);
    }
  };

  private findMemberContext = (
    linkName: string,
    actorId: string,
    membershipId: string
  ) => {
    const club = this.findStoredClubByLinkName(linkName);

    if (!club) {
      return {
        club: null,
        actorRole: null,
        isActorBanned: false,
        member: null,
        ownerCount: 0
      };
    }

    return {
      club,
      actorRole: this.findMembership(actorId, club.id)?.role ?? null,
      isActorBanned: this.hasActiveBan(actorId, club.id),
      member:
        this.memberships.find(
          (membership) =>
            membership.id === membershipId && membership.clubId === club.id
        ) ?? null,
      ownerCount: this.memberships.filter(
        (membership) =>
          membership.clubId === club.id && membership.role === "OWNER"
      ).length
    };
  };

  private findBanContext = (
    linkName: string,
    actorId: string,
    banId: string
  ) => {
    const club = this.findStoredClubByLinkName(linkName);

    if (!club) {
      return {
        club: null,
        actorRole: null,
        isActorBanned: false,
        ban: null
      };
    }

    return {
      club,
      actorRole: this.findMembership(actorId, club.id)?.role ?? null,
      isActorBanned: this.hasActiveBan(actorId, club.id),
      ban:
        this.bans.find(
          (ban) =>
            ban.id === banId && ban.clubId === club.id && this.isActiveBan(ban)
        ) ?? null
    };
  };

  private findUserById = (id: string) => {
    for (const user of this.usersByEmail.values()) {
      if (user.id === id) {
        return user;
      }
    }

    throw new Error(`Missing test user ${id}`);
  };

  private findActiveBan = (userId: string, clubId: string) =>
    this.bans.find(
      (ban) =>
        ban.userId === userId && ban.clubId === clubId && this.isActiveBan(ban)
    ) ?? null;

  private hasActiveBan = (userId: string, clubId: string) =>
    Boolean(this.findActiveBan(userId, clubId));

  private isActiveBan = (ban: {
    revokedAt: Date | null;
    expiresAt: Date | null;
  }) =>
    !ban.revokedAt &&
    (!ban.expiresAt || ban.expiresAt.getTime() > Date.now());

  private createAuditLog = (
    action:
      | "CLUB_MEMBER_ROLE_UPDATED"
      | "POST_DELETED"
      | "USER_BANNED"
      | "USER_UNBANNED",
    actorId: string,
    clubId: string,
    targetUserId: string
  ) => {
    this.auditLogs.push({
      action,
      actorId,
      clubId,
      targetUserId
    });
  };

  private softDeleteAuthoredPosts = (
    actorId: string,
    clubId: string,
    targetUserId: string
  ) => {
    const deletedAt = new Date();
    const posts = this.posts.filter(
      (post) =>
        post.clubId === clubId &&
        post.authorId === targetUserId &&
        post.deletedAt === null
    );

    for (const post of posts) {
      post.deletedAt = deletedAt;
      this.createAuditLog("POST_DELETED", actorId, clubId, targetUserId);
    }

    return posts.length;
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
      )?.role ?? null,
    isCurrentUserBanned: this.hasActiveBan(userId, club.id)
  });

  private toClubMemberRecord = (membership: {
    id: string;
    userId: string;
    clubId: string;
    role: "OWNER" | "MODERATOR" | "MEMBER";
  }): ClubMemberRecord => {
    const user = this.findUserById(membership.userId);
    const activeBan = this.findActiveBan(membership.userId, membership.clubId);

    return {
      id: membership.id,
      role: membership.role,
      user: {
        id: user.id,
        displayName: user.displayName,
        username: user.username,
        avatarAsset: user.avatarAsset
      },
      activeBan: activeBan
        ? {
            id: activeBan.id,
            reason: activeBan.reason,
            expiresAt: activeBan.expiresAt,
            createdAt: activeBan.createdAt
          }
        : null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  };

  private toClubBanRecord = (ban: {
    id: string;
    userId: string;
    roleAtBan: "OWNER" | "MODERATOR" | "MEMBER" | null;
    reason: string | null;
    expiresAt: Date | null;
    revokedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): ClubBanRecord => {
    const user = this.findUserById(ban.userId);

    return {
      id: ban.id,
      roleAtBan: ban.roleAtBan,
      user: {
        id: user.id,
        displayName: user.displayName,
        username: user.username,
        avatarAsset: user.avatarAsset
      },
      reason: ban.reason,
      expiresAt: ban.expiresAt,
      revokedAt: ban.revokedAt,
      createdAt: ban.createdAt,
      updatedAt: ban.updatedAt
    };
  };
}

const roleSortValue = (role: "OWNER" | "MODERATOR" | "MEMBER") =>
  role === "OWNER" ? 0 : role === "MODERATOR" ? 1 : 2;

const canTestActorBanTarget = (
  actorRole: "OWNER" | "MODERATOR" | "MEMBER",
  targetRole: "OWNER" | "MODERATOR" | "MEMBER"
) => actorRole === "OWNER" || (actorRole === "MODERATOR" && targetRole === "MEMBER");

const canTestActorUnbanRole = (
  actorRole: "OWNER" | "MODERATOR" | "MEMBER",
  targetRole: "OWNER" | "MODERATOR" | "MEMBER" | null
) => actorRole === "OWNER" || (actorRole === "MODERATOR" && targetRole === "MEMBER");

const canTestManageBans = (role: "OWNER" | "MODERATOR" | "MEMBER") =>
  role === "OWNER" || role === "MODERATOR";

const canTestManageSettings = (
  role: "OWNER" | "MODERATOR" | "MEMBER" | null
) => role === "OWNER" || role === "MODERATOR";

const createSessionCookie = async (user: AuthUserRecord) => {
  const token = await createSessionToken({
    userId: user.id,
    sessionVersion: user.sessionVersion
  });

  return `${env.SESSION_COOKIE_NAME}=${token}`;
};

const validCreateClubPayload = () => ({
  title: "New Story Circle",
  linkName: "new-story-circle",
  description: "Spoiler-safe theories.",
  category: "BOOKS",
  visibility: "PUBLIC",
  rules: "Keep future chapters out of early discussions."
});
