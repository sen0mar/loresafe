import cookieParser from "cookie-parser";
import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import { env } from "../../config/env.js";
import { normalizeNameReservationKey } from "../../core/identity/user-names.js";
import { errorHandler } from "../../core/http/error-middleware.js";
import { requestIdMiddleware } from "../../core/http/request-id.js";
import { hashPassword } from "../../core/security/password.js";
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
import type { ClubCategory } from "../clubs/clubs.schema.js";
import {
  type DeleteCurrentUserAccountResult,
  type JoinedClubRecord,
  type ListJoinedClubsInput,
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

  it("rejects account deletion without an authenticated session", async () => {
    const response = await request(app)
      .delete("/api/users/me")
      .set("x-request-id", "account-delete-missing-session")
      .send({
        confirmation: "delete",
        password: "correct horse battery staple"
      })
      .expect(401);

    expect(response.body).toEqual({
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required",
        requestId: "account-delete-missing-session"
      }
    });
  });

  it("rejects account deletion without the exact confirmation", async () => {
    const user = await repository.createUser({
      email: "reader@example.com",
      displayName: "Existing Reader",
      username: "story_fan",
      passwordHash: "$argon2id$v=19$hash"
    });

    const response = await request(app)
      .delete("/api/users/me")
      .set("x-request-id", "account-delete-invalid-confirmation")
      .set("Cookie", await createSessionCookie(user))
      .send({
        confirmation: "Delete",
        password: "correct horse battery staple"
      })
      .expect(400);

    expect(response.body).toEqual({
      error: {
        code: "BAD_REQUEST",
        message:
          'Enter your current password and type "delete" to confirm account deletion.',
        requestId: "account-delete-invalid-confirmation"
      }
    });
    expect(await repository.findActiveUserById(user.id)).toEqual(user);
  });

  it("rejects account deletion when current-password reauthentication fails", async () => {
    const user = await repository.createUser({
      email: "reader@example.com",
      displayName: "Existing Reader",
      username: "story_fan",
      passwordHash: await hashPassword("correct horse battery staple")
    });

    const response = await request(app)
      .delete("/api/users/me")
      .set("x-request-id", "account-delete-invalid-password")
      .set("Cookie", await createSessionCookie(user))
      .send({
        confirmation: "delete",
        password: "wrong password"
      })
      .expect(403);

    expect(response.body).toEqual({
      error: {
        code: "FORBIDDEN",
        message: "Invalid credentials",
        requestId: "account-delete-invalid-password"
      }
    });
    expect(await repository.findActiveUserById(user.id)).toEqual(user);
    expect(user.sessionVersion).toBe(1);
  });

  it("blocks account deletion when the user is the sole owner of a club", async () => {
    const user = await repository.createUser({
      email: "owner@example.com",
      displayName: "Club Owner",
      username: "club_owner",
      passwordHash: await hashPassword("correct horse battery staple")
    });
    const club = repository.createClub({
      title: "Solo Owner Club",
      linkName: "solo-owner-club",
      visibility: "PUBLIC"
    });

    repository.createMembership(user.id, club.id, "OWNER");
    repository.createPost(user.id, club.id);

    const response = await request(app)
      .delete("/api/users/me")
      .set("x-request-id", "account-delete-sole-owner")
      .set("Cookie", await createSessionCookie(user))
      .send({
        confirmation: "delete",
        password: "correct horse battery staple"
      })
      .expect(409);

    expect(response.body).toEqual({
      error: {
        code: "CONFLICT",
        message:
          "Transfer ownership of every club where you are the only owner " +
          "before deleting your account.",
        requestId: "account-delete-sole-owner"
      }
    });
    expect(await repository.findActiveUserById(user.id)).toEqual(user);
    expect(repository.posts).toHaveLength(1);
    expect(repository.processedStorageDeletionIds).toHaveLength(0);
  });

  it("deletes the account and cascades user-owned data", async () => {
    const user = await repository.createUser({
      email: "reader@example.com",
      displayName: "Existing Reader",
      username: "story_fan",
      passwordHash: await hashPassword("correct horse battery staple")
    });
    const otherOwner = await repository.createUser({
      email: "owner@example.com",
      displayName: "Other Owner",
      username: "other_owner",
      passwordHash: "$argon2id$v=19$hash"
    });
    const otherUser = await repository.createUser({
      email: "other@example.com",
      displayName: "Other Reader",
      username: "other_reader",
      passwordHash: "$argon2id$v=19$hash"
    });
    const club = repository.createClub({
      title: "Shared Club",
      linkName: "shared-club",
      visibility: "PUBLIC"
    });
    const userPost = repository.createPost(user.id, club.id);
    const otherPost = repository.createPost(otherUser.id, club.id);
    const userComment = repository.createComment(user.id, otherPost.id);
    const otherReply = repository.createComment(otherUser.id, otherPost.id, {
      parentId: userComment.id
    });

    repository.createMembership(user.id, club.id, "OWNER");
    repository.createMembership(otherOwner.id, club.id, "OWNER");
    repository.createMembership(otherUser.id, club.id, "MEMBER");
    repository.createPostReaction(user.id, otherPost.id);
    repository.createCommentReaction(user.id, otherReply.id);
    repository.createNotification(user.id, otherPost.id, otherReply.id);
    repository.createReport(user.id, userPost.id, null);
    repository.createProgress(user.id, club.id);
    repository.createFileAsset(user.id, "public/avatars/user/avatar.webp");
    repository.createFileAsset(user.id, "private/post-images/club/post.webp");
    repository.createFileAsset(
      otherUser.id,
      "public/avatars/other/avatar.webp"
    );

    const cookie = await createSessionCookie(user);
    const response = await request(app)
      .delete("/api/users/me")
      .set("Cookie", cookie)
      .send({
        confirmation: "delete",
        password: "correct horse battery staple"
      })
      .expect(204);

    expect(response.headers["set-cookie"]?.[0]).toContain(
      `${env.SESSION_COOKIE_NAME}=;`
    );
    expect(user.sessionVersion).toBe(2);
    expect(await repository.findActiveUserById(user.id)).toBeNull();
    expect(repository.nameReservations.has("story_fan")).toBe(false);
    expect(repository.nameReservations.has("existing reader")).toBe(false);
    expect(
      repository.memberships.some((membership) => membership.userId === user.id)
    ).toBe(false);
    expect(repository.posts.some((post) => post.authorId === user.id)).toBe(
      false
    );
    expect(
      repository.comments.some((comment) => comment.authorId === user.id)
    ).toBe(false);
    expect(
      repository.postReactions.some((reaction) => reaction.userId === user.id)
    ).toBe(false);
    expect(
      repository.commentReactions.some(
        (reaction) => reaction.userId === user.id
      )
    ).toBe(false);
    expect(
      repository.notifications.some(
        (notification) => notification.userId === user.id
      )
    ).toBe(false);
    expect(
      repository.reports.some((report) => report.reporterId === user.id)
    ).toBe(false);
    expect(
      repository.progressRows.some((progress) => progress.userId === user.id)
    ).toBe(false);
    expect(
      repository.fileAssets.some((asset) => asset.ownerId === user.id)
    ).toBe(false);
    expect(repository.fileAssets).toEqual([
      {
        ownerId: otherUser.id,
        objectKey: "public/avatars/other/avatar.webp"
      }
    ]);
    expect(
      repository.comments.find((comment) => comment.id === otherReply.id)
        ?.parentId
    ).toBeNull();
    expect(repository.processedStorageDeletionIds).toHaveLength(2);
    expect(
      repository.processedStorageDeletionIds.map((deletionId) =>
        repository.storageDeletionObjectKeys.get(deletionId)
      )
    ).toEqual([
      "public/avatars/user/avatar.webp",
      "private/post-images/club/post.webp"
    ]);

    await request(app).get("/api/auth/me").set("Cookie", cookie).expect(401);
  });

  it("returns all clubs joined by the current user with safe sidebar fields", async () => {
    const user = await repository.createUser({
      email: "reader@example.com",
      displayName: "Existing Reader",
      username: "story_fan",
      passwordHash: "$argon2id$v=19$hash"
    });
    const otherUser = await repository.createUser({
      email: "other@example.com",
      displayName: "Other Reader",
      passwordHash: "$argon2id$v=19$hash"
    });
    const publicClub = repository.createClub({
      title: "Public Story Circle",
      linkName: "public-story-circle",
      visibility: "PUBLIC"
    });
    const privateClub = repository.createClub({
      title: "Private Plot Room",
      linkName: "private-plot-room",
      visibility: "PRIVATE"
    });
    const inviteOnlyClub = repository.createClub({
      title: "Invite Arc Watch",
      linkName: "invite-arc-watch",
      visibility: "INVITE_ONLY"
    });
    const unjoinedClub = repository.createClub({
      title: "Unjoined Spoiler Room",
      linkName: "unjoined-spoiler-room",
      visibility: "PRIVATE"
    });
    const publicJoinedAt = new Date("2026-01-01T00:00:00.000Z");
    const inviteJoinedAt = new Date("2026-01-02T00:00:00.000Z");
    const privateJoinedAt = new Date("2026-01-03T00:00:00.000Z");

    repository.createMembership(
      user.id,
      publicClub.id,
      "MEMBER",
      publicJoinedAt
    );
    repository.createMembership(
      user.id,
      inviteOnlyClub.id,
      "MODERATOR",
      inviteJoinedAt
    );
    repository.createMembership(
      user.id,
      privateClub.id,
      "OWNER",
      privateJoinedAt
    );
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
          linkName: "private-plot-room",
          coverUrl: null,
          visibility: "PRIVATE",
          role: "OWNER",
          memberCount: 1,
          joinedAt: privateJoinedAt.toISOString()
        },
        {
          id: inviteOnlyClub.id,
          title: "Invite Arc Watch",
          linkName: "invite-arc-watch",
          coverUrl: null,
          visibility: "INVITE_ONLY",
          role: "MODERATOR",
          memberCount: 1,
          joinedAt: inviteJoinedAt.toISOString()
        },
        {
          id: publicClub.id,
          title: "Public Story Circle",
          linkName: "public-story-circle",
          coverUrl: null,
          visibility: "PUBLIC",
          role: "MEMBER",
          memberCount: 2,
          joinedAt: publicJoinedAt.toISOString()
        }
      ],
      pagination: {
        limit: 20,
        nextCursor: null,
        hasMore: false
      }
    });
    expect(Object.keys(response.body.clubs[0]).sort()).toEqual(
      [
        "id",
        "joinedAt",
        "memberCount",
        "role",
        "linkName",
        "title",
        "visibility",
        "coverUrl"
      ].sort()
    );
    expect(JSON.stringify(response.body)).not.toContain(
      "Unjoined Spoiler Room"
    );
  });

  it("paginates joined clubs by newest membership first", async () => {
    const user = await repository.createUser({
      email: "reader@example.com",
      displayName: "Existing Reader",
      passwordHash: "$argon2id$v=19$hash"
    });

    const oldestClub = repository.createClub({
      title: "Oldest Club",
      linkName: "oldest-club",
      visibility: "PUBLIC"
    });
    const middleClub = repository.createClub({
      title: "Middle Club",
      linkName: "middle-club",
      visibility: "PUBLIC"
    });
    const newestClub = repository.createClub({
      title: "Newest Club",
      linkName: "newest-club",
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

    const firstPage = await request(app)
      .get("/api/users/me/clubs?limit=2")
      .set("Cookie", await createSessionCookie(user))
      .expect(200);
    const response = await request(app)
      .get(
        `/api/users/me/clubs?limit=2&cursor=${encodeURIComponent(firstPage.body.pagination.nextCursor)}`
      )
      .set("Cookie", await createSessionCookie(user))
      .expect(200);

    expect(
      response.body.clubs.map((club: { linkName: string }) => club.linkName)
    ).toEqual(["oldest-club"]);
    expect(response.body.pagination).toEqual({
      limit: 2,
      nextCursor: null,
      hasMore: false
    });
  });

  it("searches only the current user's joined clubs", async () => {
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
    const privateClub = repository.createClub({
      title: "Nebula Private Room",
      linkName: "nebula-private-room",
      visibility: "PRIVATE",
      category: "BOOKS"
    });
    const inviteClub = repository.createClub({
      title: "Invite Arc Watch",
      linkName: "invite-arc-watch",
      visibility: "INVITE_ONLY",
      category: "ANIME"
    });
    const unjoinedClub = repository.createClub({
      title: "Nebula Unjoined Room",
      linkName: "nebula-unjoined-room",
      visibility: "PRIVATE",
      category: "BOOKS"
    });

    repository.createMembership(
      user.id,
      privateClub.id,
      "OWNER",
      new Date("2026-01-03T00:00:00.000Z")
    );
    repository.createMembership(
      user.id,
      inviteClub.id,
      "MEMBER",
      new Date("2026-01-02T00:00:00.000Z")
    );
    repository.createMembership(otherUser.id, unjoinedClub.id);

    const response = await request(app)
      .get("/api/users/me/clubs?q=nebula")
      .set("Cookie", await createSessionCookie(user))
      .expect(200);

    expect(
      response.body.clubs.map((club: { title: string }) => club.title)
    ).toEqual(["Nebula Private Room"]);
    expect(JSON.stringify(response.body)).not.toContain("Nebula Unjoined Room");
  });

  it("searches joined clubs by safe metadata and paginates filtered results", async () => {
    const user = await repository.createUser({
      email: "reader@example.com",
      displayName: "Existing Reader",
      passwordHash: "$argon2id$v=19$hash"
    });
    const oldestAnime = repository.createClub({
      title: "First Anime Room",
      linkName: "first-anime-room",
      visibility: "PUBLIC",
      category: "ANIME"
    });
    const newestAnime = repository.createClub({
      title: "Second Anime Room",
      linkName: "second-anime-room",
      visibility: "INVITE_ONLY",
      category: "ANIME"
    });
    const bookClub = repository.createClub({
      title: "Book Room",
      linkName: "book-room",
      visibility: "PRIVATE",
      category: "BOOKS"
    });

    repository.createMembership(
      user.id,
      oldestAnime.id,
      "MEMBER",
      new Date("2026-01-01T00:00:00.000Z")
    );
    repository.createMembership(
      user.id,
      newestAnime.id,
      "MODERATOR",
      new Date("2026-01-03T00:00:00.000Z")
    );
    repository.createMembership(
      user.id,
      bookClub.id,
      "OWNER",
      new Date("2026-01-02T00:00:00.000Z")
    );

    const firstPage = await request(app)
      .get("/api/users/me/clubs?q=anime&limit=1")
      .set("Cookie", await createSessionCookie(user))
      .expect(200);
    const response = await request(app)
      .get(
        `/api/users/me/clubs?q=anime&limit=1&cursor=${encodeURIComponent(firstPage.body.pagination.nextCursor)}`
      )
      .set("Cookie", await createSessionCookie(user))
      .expect(200);

    expect(
      response.body.clubs.map((club: { title: string }) => club.title)
    ).toEqual(["First Anime Room"]);
    expect(response.body.pagination).toEqual({
      limit: 1,
      nextCursor: null,
      hasMore: false
    });
  });

  it("keeps active club bans out of joined club search results", async () => {
    const user = await repository.createUser({
      email: "reader@example.com",
      displayName: "Existing Reader",
      passwordHash: "$argon2id$v=19$hash"
    });
    const visibleClub = repository.createClub({
      title: "Nebula Safe Room",
      linkName: "nebula-safe-room",
      visibility: "PUBLIC"
    });
    const bannedClub = repository.createClub({
      title: "Nebula Banned Room",
      linkName: "nebula-banned-room",
      visibility: "PUBLIC"
    });

    repository.createMembership(user.id, visibleClub.id);
    repository.createMembership(user.id, bannedClub.id);
    repository.createActiveBan(user.id, bannedClub.id);

    const response = await request(app)
      .get("/api/users/me/clubs?q=nebula")
      .set("Cookie", await createSessionCookie(user))
      .expect(200);

    expect(
      response.body.clubs.map((club: { title: string }) => club.title)
    ).toEqual(["Nebula Safe Room"]);
  });

  it("rejects invalid joined club search queries", async () => {
    const user = await repository.createUser({
      email: "reader@example.com",
      displayName: "Existing Reader",
      passwordHash: "$argon2id$v=19$hash"
    });

    const response = await request(app)
      .get(`/api/users/me/clubs?q=${"x".repeat(121)}`)
      .set("x-request-id", "joined-clubs-invalid-query")
      .set("Cookie", await createSessionCookie(user))
      .expect(400);

    expect(response.body).toEqual({
      error: {
        code: "BAD_REQUEST",
        message: "Check the joined clubs query and try again.",
        requestId: "joined-clubs-invalid-query"
      }
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
        bio: "  Safe discussions only.  "
      })
      .expect(200);

    expect(response.body).toEqual({
      user: {
        id: user.id,
        email: "reader@example.com",
        displayName: "Updated Reader",
        username: "existing_reader",
        bio: "Safe discussions only.",
        avatarUrl: null,
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
      username: "existing_reader",
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

  it("rejects username update attempts", async () => {
    const user = await repository.createUser({
      email: "reader@example.com",
      displayName: "Existing Reader",
      passwordHash: "$argon2id$v=19$hash"
    });

    const response = await request(app)
      .patch("/api/users/me")
      .set("x-request-id", "profile-username-locked")
      .set("Cookie", await createSessionCookie(user))
      .send({
        username: "new_name"
      })
      .expect(400);

    expect(response.body).toEqual({
      error: {
        code: "BAD_REQUEST",
        message: "Check the profile fields and try again.",
        requestId: "profile-username-locked"
      }
    });
  });

  it("rejects duplicate active display names", async () => {
    const user = await repository.createUser({
      email: "reader@example.com",
      displayName: "Existing Reader",
      passwordHash: "$argon2id$v=19$hash"
    });
    await repository.createUser({
      email: "other@example.com",
      displayName: "Other Reader",
      passwordHash: "$argon2id$v=19$hash"
    });

    const response = await request(app)
      .patch("/api/users/me")
      .set("x-request-id", "profile-duplicate-display-name")
      .set("Cookie", await createSessionCookie(user))
      .send({
        displayName: "other reader"
      })
      .expect(409);

    expect(response.body).toEqual({
      error: {
        code: "CONFLICT",
        message: "That display name is already taken.",
        requestId: "profile-duplicate-display-name"
      }
    });
  });

  it("allows a user to set their display name to their own username", async () => {
    const user = await repository.createUser({
      email: "reader@example.com",
      displayName: "Existing Reader",
      username: "story_fan",
      passwordHash: "$argon2id$v=19$hash"
    });

    const response = await request(app)
      .patch("/api/users/me")
      .set("Cookie", await createSessionCookie(user))
      .send({
        displayName: "Story_Fan"
      })
      .expect(200);

    expect(response.body.user).toMatchObject({
      id: user.id,
      displayName: "Story_Fan",
      username: "story_fan"
    });
  });

  it("rejects display names reserved by another user's username", async () => {
    const user = await repository.createUser({
      email: "reader@example.com",
      displayName: "Existing Reader",
      passwordHash: "$argon2id$v=19$hash"
    });
    await repository.createUser({
      email: "other@example.com",
      displayName: "Other Reader",
      username: "taken_name",
      passwordHash: "$argon2id$v=19$hash"
    });

    const response = await request(app)
      .patch("/api/users/me")
      .set("x-request-id", "profile-display-username-conflict")
      .set("Cookie", await createSessionCookie(user))
      .send({
        displayName: "Taken_Name"
      })
      .expect(409);

    expect(response.body).toEqual({
      error: {
        code: "CONFLICT",
        message: "That display name is already taken.",
        requestId: "profile-display-username-conflict"
      }
    });
  });

  it("releases the previous display name after a successful display-name change", async () => {
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

    await request(app)
      .patch("/api/users/me")
      .set("Cookie", await createSessionCookie(user))
      .send({
        displayName: "Updated Reader"
      })
      .expect(200);

    const response = await request(app)
      .patch("/api/users/me")
      .set("Cookie", await createSessionCookie(otherUser))
      .send({
        displayName: "Existing Reader"
      })
      .expect(200);

    expect(response.body.user).toMatchObject({
      id: otherUser.id,
      displayName: "Existing Reader"
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

const createUsersTestApp = (repository: InMemoryUsersRepository) => {
  const app = express();
  const authService = createAuthService(repository);
  const authController = createAuthController(authService);
  const authMiddleware = createAuthMiddleware(authService);
  const usersService = createUsersService(repository, {
    processCommittedDeletions: async (deletionIds) => {
      repository.processedStorageDeletionIds.push(...deletionIds);
    }
  });
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
  readonly nameReservations = new Map<string, string>();
  readonly clubs = new Map<string, StoredClub>();
  readonly memberships: StoredMembership[] = [];
  readonly activeBans: StoredClubBan[] = [];
  readonly posts: StoredPost[] = [];
  readonly comments: StoredComment[] = [];
  readonly postReactions: StoredPostReaction[] = [];
  readonly commentReactions: StoredCommentReaction[] = [];
  readonly notifications: StoredNotification[] = [];
  readonly reports: StoredReport[] = [];
  readonly progressRows: StoredProgress[] = [];
  readonly fileAssets: StoredFileAsset[] = [];
  readonly processedStorageDeletionIds: string[] = [];
  readonly storageDeletionObjectKeys = new Map<string, string>();

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

  findActiveUserCredentialsById = async (userId: string) => {
    const user = await this.findActiveUserById(userId);

    return user
      ? {
          passwordHash: user.passwordHash,
          sessionVersion: user.sessionVersion
        }
      : null;
  };

  findActiveUserByReservedName = async (normalizedName: string) => {
    const reservedUserId = this.nameReservations.get(normalizedName);

    if (!reservedUserId) {
      return null;
    }

    for (const user of this.usersByEmail.values()) {
      if (user.id === reservedUserId) {
        return user;
      }
    }

    return null;
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
    this.reserveName(lockedUsername, user.id);
    this.reserveName(displayName, user.id);

    return user;
  };

  createClub = ({
    category = "BOOKS",
    title,
    linkName,
    visibility,
    createdAt = new Date()
  }: CreateStoredClubInput) => {
    const club = {
      id: crypto.randomUUID(),
      title,
      linkName,
      category,
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

  createActiveBan = (userId: string, clubId: string) => {
    this.activeBans.push({
      userId,
      clubId
    });
  };

  createPost = (authorId: string, clubId: string) => {
    const post = {
      id: crypto.randomUUID(),
      authorId,
      clubId
    };

    this.posts.push(post);

    return post;
  };

  createComment = (
    authorId: string,
    postId: string,
    input: { parentId?: string | null } = {}
  ) => {
    const comment = {
      id: crypto.randomUUID(),
      authorId,
      postId,
      parentId: input.parentId ?? null
    };

    this.comments.push(comment);

    return comment;
  };

  createPostReaction = (userId: string, postId: string) => {
    this.postReactions.push({
      userId,
      postId
    });
  };

  createCommentReaction = (userId: string, commentId: string) => {
    this.commentReactions.push({
      userId,
      commentId
    });
  };

  createNotification = (
    userId: string,
    postId: string | null,
    commentId: string | null
  ) => {
    this.notifications.push({
      userId,
      postId,
      commentId
    });
  };

  createReport = (
    reporterId: string,
    postId: string | null,
    commentId: string | null
  ) => {
    this.reports.push({
      reporterId,
      postId,
      commentId
    });
  };

  createProgress = (userId: string, clubId: string) => {
    this.progressRows.push({
      userId,
      clubId
    });
  };

  createFileAsset = (ownerId: string, objectKey: string) => {
    this.fileAssets.push({
      ownerId,
      objectKey
    });
  };

  listJoinedClubsForUser = async (
    userId: string,
    { cursor, limit, q }: ListJoinedClubsInput
  ) => {
    const joinedMemberships = this.memberships
      .filter((membership) => membership.userId === userId)
      .filter(
        (membership) =>
          !this.activeBans.some(
            (ban) => ban.userId === userId && ban.clubId === membership.clubId
          )
      )
      .filter((membership) => this.matchesJoinedClubSearch(membership, q))
      .sort(
        (leftMembership, rightMembership) =>
          rightMembership.createdAt.getTime() -
            leftMembership.createdAt.getTime() ||
          leftMembership.id.localeCompare(rightMembership.id)
      );
    const start = cursor
      ? joinedMemberships.findIndex(
          (membership) => membership.id === cursor.id
        ) + 1
      : 0;
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
          linkName: club.linkName,
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
      hasMore: start + limit < joinedMemberships.length,
      nextCursor:
        start + limit < joinedMemberships.length && clubs.length > 0
          ? {
              createdAt: joinedMemberships[start + clubs.length - 1]!.createdAt,
              id: joinedMemberships[start + clubs.length - 1]!.id
            }
          : null
    };
  };

  deleteCurrentUserAccount = async (
    userId: string,
    expectedSessionVersion: number
  ): Promise<DeleteCurrentUserAccountResult> => {
    const user = await this.findActiveUserById(userId);

    if (!user) {
      return "USER_NOT_FOUND";
    }

    if (user.sessionVersion !== expectedSessionVersion) {
      return "REAUTH_REQUIRED";
    }

    const isSoleOwner = this.memberships.some(
      (membership) =>
        membership.userId === userId &&
        membership.role === "OWNER" &&
        !this.memberships.some(
          (otherMembership) =>
            otherMembership.clubId === membership.clubId &&
            otherMembership.role === "OWNER" &&
            otherMembership.userId !== userId
        )
    );

    if (isSoleOwner) {
      return "SOLE_OWNER";
    }

    user.sessionVersion += 1;

    const objectKeys = this.fileAssets
      .filter((asset) => asset.ownerId === userId)
      .map((asset) => asset.objectKey);
    const userCommentIds = new Set(
      this.comments
        .filter((comment) => comment.authorId === userId)
        .map((comment) => comment.id)
    );

    this.comments.forEach((comment) => {
      if (
        comment.authorId !== userId &&
        userCommentIds.has(comment.parentId ?? "")
      ) {
        comment.parentId = null;
      }
    });

    const deletedPostIds = new Set(
      this.posts
        .filter((post) => post.authorId === userId)
        .map((post) => post.id)
    );
    const deletedCommentIds = new Set(
      this.comments
        .filter(
          (comment) =>
            comment.authorId === userId || deletedPostIds.has(comment.postId)
        )
        .map((comment) => comment.id)
    );

    this.usersByEmail.delete(user.email);
    for (const [reservedName, reservedUserId] of this.nameReservations) {
      if (reservedUserId === userId) {
        this.nameReservations.delete(reservedName);
      }
    }

    removeMatching(
      this.memberships,
      (membership) => membership.userId === userId
    );
    removeMatching(this.activeBans, (ban) => ban.userId === userId);
    removeMatching(this.posts, (post) => post.authorId === userId);
    removeMatching(
      this.comments,
      (comment) =>
        comment.authorId === userId || deletedPostIds.has(comment.postId)
    );
    removeMatching(
      this.postReactions,
      (reaction) =>
        reaction.userId === userId || deletedPostIds.has(reaction.postId)
    );
    removeMatching(
      this.commentReactions,
      (reaction) =>
        reaction.userId === userId || deletedCommentIds.has(reaction.commentId)
    );
    removeMatching(
      this.notifications,
      (notification) =>
        notification.userId === userId ||
        (!!notification.postId && deletedPostIds.has(notification.postId)) ||
        (!!notification.commentId &&
          deletedCommentIds.has(notification.commentId))
    );
    removeMatching(
      this.reports,
      (report) =>
        report.reporterId === userId ||
        (!!report.postId && deletedPostIds.has(report.postId)) ||
        (!!report.commentId && deletedCommentIds.has(report.commentId))
    );
    removeMatching(this.progressRows, (progress) => progress.userId === userId);
    removeMatching(this.fileAssets, (asset) => asset.ownerId === userId);

    const deletionIds = objectKeys.map((objectKey) => {
      const deletionId = crypto.randomUUID();

      this.storageDeletionObjectKeys.set(deletionId, objectKey);
      return deletionId;
    });

    return {
      status: "DELETED",
      deletionIds
    };
  };

  private matchesJoinedClubSearch = (
    membership: StoredMembership,
    searchQuery: string
  ) => {
    const normalizedQuery = normalizeSearchText(searchQuery);

    if (!normalizedQuery) {
      return true;
    }

    const club = this.clubs.get(membership.clubId);

    if (!club) {
      return false;
    }

    const searchableFields = [
      club.title,
      club.linkName.replaceAll("-", " "),
      club.visibility.replaceAll("_", " "),
      clubCategoryLabels[club.category],
      membership.role,
      membership.role === "MODERATOR" ? "mod" : ""
    ];

    return searchableFields.some((field) =>
      normalizeSearchText(field).includes(normalizedQuery)
    );
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

    if (input.displayName !== undefined) {
      const nextDisplayNameKey = normalizeNameReservationKey(input.displayName);
      const currentDisplayNameKey = normalizeNameReservationKey(
        user.displayName
      );
      const currentUsernameKey = normalizeNameReservationKey(
        user.username ?? ""
      );
      const reservedUserId = this.nameReservations.get(nextDisplayNameKey);

      if (reservedUserId && reservedUserId !== userId) {
        throw createUniqueConstraintError();
      }

      this.nameReservations.set(nextDisplayNameKey, userId);

      if (
        nextDisplayNameKey !== currentDisplayNameKey &&
        currentDisplayNameKey !== currentUsernameKey
      ) {
        this.nameReservations.delete(currentDisplayNameKey);
      }
    }

    const updatedUser = {
      ...user,
      ...input,
      updatedAt: new Date()
    };

    this.usersByEmail.set(updatedUser.email, updatedUser);

    return updatedUser;
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

const createUniqueConstraintError = () => ({
  code: "P2002",
  meta: {
    target: ["normalized_name"]
  }
});

type StoredClub = {
  id: string;
  title: string;
  linkName: string;
  category: ClubCategory;
  visibility: "PUBLIC" | "PRIVATE" | "INVITE_ONLY";
  createdAt: Date;
  updatedAt: Date;
};

type CreateStoredClubInput = {
  title: string;
  linkName: string;
  category?: ClubCategory;
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

type StoredClubBan = {
  userId: string;
  clubId: string;
};

type StoredPost = {
  id: string;
  authorId: string;
  clubId: string;
};

type StoredComment = {
  id: string;
  authorId: string;
  postId: string;
  parentId: string | null;
};

type StoredPostReaction = {
  userId: string;
  postId: string;
};

type StoredCommentReaction = {
  userId: string;
  commentId: string;
};

type StoredNotification = {
  userId: string;
  postId: string | null;
  commentId: string | null;
};

type StoredReport = {
  reporterId: string;
  postId: string | null;
  commentId: string | null;
};

type StoredProgress = {
  userId: string;
  clubId: string;
};

type StoredFileAsset = {
  ownerId: string;
  objectKey: string;
};

const clubCategoryLabels = {
  BOOKS: "books",
  TV_SHOWS: "tv shows television shows",
  ANIME: "anime",
  MANGA: "manga",
  MOVIES: "movies films",
  GAMES: "games",
  PODCASTS: "podcasts",
  COURSES: "courses",
  COMICS_GRAPHIC_NOVELS: "comics graphic novels",
  WEB_SERIALS: "web serials",
  CUSTOM_TIMELINE: "custom timeline"
} satisfies Record<ClubCategory, string>;

const normalizeSearchText = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replaceAll("-", " ")
    .replaceAll("_", " ")
    .replace(/\s+/g, " ");

const createSessionCookie = async (user: AuthUserRecord) => {
  const sessionToken = await createSessionToken({
    userId: user.id,
    sessionVersion: user.sessionVersion
  });

  return `${env.SESSION_COOKIE_NAME}=${sessionToken}`;
};

const removeMatching = <TItem>(
  items: TItem[],
  predicate: (item: TItem) => boolean
) => {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (predicate(items[index])) {
      items.splice(index, 1);
    }
  }
};
