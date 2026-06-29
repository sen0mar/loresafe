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
  ClubMemberMutationResult,
  ClubMemberRecord,
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
        linkName: " New-Story-Circle ",
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
        linkName: "new-story-circle",
        description: "Spoiler-safe theories.",
        category: "Books",
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
      linkName: "public-story-circle",
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
      category: "Books",
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
        total: 2,
        pageCount: 2
      }
    });
    expect(JSON.stringify(response.body)).not.toContain("owner@example.com");
    expect(JSON.stringify(response.body)).not.toContain("$argon2id");

    await request(app)
      .get("/api/clubs/member-list-club/members")
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

    await request(app)
      .patch(`/api/clubs/ban-club/members/${readerMembershipId}/role`)
      .set("Cookie", await createSessionCookie(moderator))
      .send({ role: "MODERATOR" })
      .expect(403);

    const banResponse = await request(app)
      .post(`/api/clubs/ban-club/members/${readerMembershipId}/ban`)
      .set("Cookie", await createSessionCookie(moderator))
      .send({ reason: "Repeated spoilers" })
      .expect(200);

    expect(banResponse.body.member.activeBan).toMatchObject({
      id: expect.any(String),
      reason: "Repeated spoilers",
      expiresAt: null,
      createdAt: expect.any(String)
    });

    const membersResponse = await request(app)
      .get("/api/clubs/ban-club/members")
      .set("Cookie", await createSessionCookie(moderator))
      .expect(200);
    const activeBanByUserId = new Map(
      membersResponse.body.members.map(
        (member: { user: { id: string }; activeBan: unknown }) => [
          member.user.id,
          member.activeBan
        ]
      )
    );

    expect(activeBanByUserId.get(reader.id)).toMatchObject({
      reason: "Repeated spoilers"
    });
    expect(activeBanByUserId.get(owner.id)).toBeNull();
    expect(activeBanByUserId.get(moderator.id)).toBeNull();

    await request(app)
      .post(`/api/clubs/ban-club/members/${ownerMembershipId}/ban`)
      .set("Cookie", await createSessionCookie(moderator))
      .send({})
      .expect(403);

    const unbanResponse = await request(app)
      .post(`/api/clubs/ban-club/members/${readerMembershipId}/unban`)
      .set("Cookie", await createSessionCookie(moderator))
      .expect(200);

    expect(unbanResponse.body.member.activeBan).toBeNull();
    expect(repository.auditLogs.map((log) => log.action)).toEqual([
      "USER_BANNED",
      "USER_UNBANNED"
    ]);
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
      category: "Books",
      visibility: "PUBLIC"
    });
    const privateClub = repository.createClub({
      title: "Private Plot Room",
      linkName: "private-plot-room",
      description: "Hidden private discussion.",
      category: "Shows",
      visibility: "PRIVATE"
    });
    const inviteOnlyClub = repository.createClub({
      title: "Invite Arc Watch",
      linkName: "invite-arc-watch",
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
          linkName: "public-story-circle",
          description: "Safe public discussion.",
          category: "Books",
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
  linkName: string;
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
    id: string;
    userId: string;
    clubId: string;
    role: "OWNER" | "MODERATOR" | "MEMBER";
  }> = [];
  readonly bans: Array<{
    id: string;
    userId: string;
    clubId: string;
    reason: string | null;
    expiresAt: Date | null;
    revokedAt: Date | null;
    createdAt: Date;
  }> = [];
  readonly auditLogs: Array<{
    action: "CLUB_MEMBER_ROLE_UPDATED" | "USER_BANNED" | "USER_UNBANNED";
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
    category = null,
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
      reason?: string | null;
      expiresAt?: Date | null;
      revokedAt?: Date | null;
    } = {}
  ) => {
    const ban = {
      id: crypto.randomUUID(),
      userId,
      clubId,
      reason: input.reason ?? null,
      expiresAt: input.expiresAt ?? null,
      revokedAt: input.revokedAt ?? null,
      createdAt: new Date()
    };

    this.bans.push(ban);

    return ban.id;
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

  listClubMembersByLinkName = async (
    linkName: string,
    userId: string,
    { page, limit }: { page: number; limit: number }
  ) => {
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

    const members = this.memberships
      .filter((membership) => membership.clubId === club.id)
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
    input: { reason?: string | null; expiresAt?: string }
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

    if (!canTestActorBanTarget(context.actorRole, context.member.role)) {
      return { status: "ACTOR_NOT_ALLOWED" };
    }

    if (context.member.role === "OWNER" && context.ownerCount <= 1) {
      return { status: "LAST_OWNER" };
    }

    const activeBan = this.findActiveBan(context.member.userId, context.club.id);

    if (activeBan) {
      activeBan.reason = input.reason ?? null;
      activeBan.expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
    } else {
      this.createBan(context.member.userId, context.club.id, {
        reason: input.reason ?? null,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null
      });
    }

    this.createAuditLog(
      "USER_BANNED",
      actorId,
      context.club.id,
      context.member.userId
    );

    return {
      status: "SUCCESS",
      member: this.toClubMemberRecord(context.member)
    };
  };

  unbanClubMember = async (
    linkName: string,
    membershipId: string,
    actorId: string
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

    if (!canTestActorBanTarget(context.actorRole, context.member.role)) {
      return { status: "ACTOR_NOT_ALLOWED" };
    }

    for (const ban of this.bans) {
      if (
        ban.userId === context.member.userId &&
        ban.clubId === context.club.id &&
        this.isActiveBan(ban)
      ) {
        ban.revokedAt = new Date();
      }
    }

    this.createAuditLog(
      "USER_UNBANNED",
      actorId,
      context.club.id,
      context.member.userId
    );

    return {
      status: "SUCCESS",
      member: this.toClubMemberRecord(context.member)
    };
  };

  listPublicClubs = async (
    userId: string,
    { page, limit }: { page: number; limit: number }
  ) => {
    const publicClubs = Array.from(this.clubs.values())
      .filter(
        (club) =>
          club.visibility === "PUBLIC" && !this.hasActiveBan(userId, club.id)
      )
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
    action: "CLUB_MEMBER_ROLE_UPDATED" | "USER_BANNED" | "USER_UNBANNED",
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
}

const roleSortValue = (role: "OWNER" | "MODERATOR" | "MEMBER") =>
  role === "OWNER" ? 0 : role === "MODERATOR" ? 1 : 2;

const canTestActorBanTarget = (
  actorRole: "OWNER" | "MODERATOR" | "MEMBER",
  targetRole: "OWNER" | "MODERATOR" | "MEMBER"
) => actorRole === "OWNER" || (actorRole === "MODERATOR" && targetRole === "MEMBER");

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
  category: "Books",
  visibility: "PUBLIC",
  rules: "Keep future chapters out of early discussions."
});
