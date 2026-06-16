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
  type ClubProgressRecord,
  type ProgressClubRecord,
  type ProgressHistoryRecord,
  type ProgressMilestoneRecord,
  type ProgressRepository
} from "../progress/progress.repository.js";
import { createProgressController } from "../progress/progress.controller.js";
import { createProgressRouter } from "../progress/progress.routes.js";
import { createProgressService } from "../progress/progress.service.js";
import type {
  ProgressMode,
  UpdateProgressRequest
} from "../progress/progress.schema.js";
import { createPostsController } from "./posts.controller.js";
import type {
  ClubFeedRecord,
  ClubPostCreationClubRecord,
  ClubPostRecord,
  ClubPostsCursor,
  ListClubPostsInput,
  ListClubPostsResult,
  PostDetailRecord,
  PostsRepository
} from "./posts.repository.js";
import {
  createPostDetailsRouter,
  createPostsRouter
} from "./posts.routes.js";
import { createPostsService } from "./posts.service.js";
import type { CreateClubPostRequest } from "./posts.schema.js";

describe("posts routes", () => {
  let repository: InMemoryPostsRepository;
  let app: express.Express;

  beforeEach(() => {
    repository = new InMemoryPostsRepository();
    app = createPostsTestApp(repository);
  });

  it("rejects feed reads without an authenticated session", async () => {
    const response = await request(app)
      .get("/api/clubs/public-story-circle/posts")
      .set("x-request-id", "posts-missing-session")
      .expect(401);

    expect(response.body).toEqual({
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required",
        requestId: "posts-missing-session"
      }
    });
  });

  it("rejects post detail reads without an authenticated session", async () => {
    const response = await request(app)
      .get(`/api/posts/${crypto.randomUUID()}`)
      .set("x-request-id", "post-detail-missing-session")
      .expect(401);

    expect(response.body).toEqual({
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required",
        requestId: "post-detail-missing-session"
      }
    });
  });

  it("rejects post creation without an authenticated session", async () => {
    const response = await request(app)
      .post("/api/clubs/public-story-circle/posts")
      .set("x-request-id", "posts-create-missing-session")
      .send(validPostInput(crypto.randomUUID()))
      .expect(401);

    expect(response.body).toEqual({
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required",
        requestId: "posts-create-missing-session"
      }
    });
  });

  it("lets members create visible posts at their current milestone", async () => {
    const user = repository.createStoredUser(validUserInput());
    const club = repository.createClub("member-post-club");
    const milestone = repository.createMilestone(club.id, {
      position: 1,
      safeTitle: "Opening"
    });
    repository.createMembership(user.id, club.id);
    repository.setProgress(user.id, club.id, milestone.id, "STRICT");

    const response = await request(app)
      .post("/api/clubs/member-post-club/posts")
      .set("Cookie", await createSessionCookie(user))
      .send({
        title: "  Opening thoughts  ",
        body: "  This is safe for the opening checkpoint.  ",
        type: "QUESTION",
        requiredMilestoneId: milestone.id
      })
      .expect(201);

    expect(repository.posts).toHaveLength(1);
    expect(repository.posts[0]).toMatchObject({
      clubId: club.id,
      title: "Opening thoughts",
      body: "This is safe for the opening checkpoint.",
      type: "QUESTION",
      milestoneId: milestone.id
    });
    expect(response.body.post).toMatchObject({
      visibility: "VISIBLE",
      type: "QUESTION",
      title: "Opening thoughts",
      bodyPreview: "This is safe for the opening checkpoint.",
      author: {
        id: user.id,
        displayName: "Reader",
        username: null
      },
      requiredMilestone: {
        id: milestone.id,
        position: 1,
        label: "Opening"
      }
    });
  });

  it("rejects post creation from public-club non-members", async () => {
    const reader = repository.createStoredUser(validUserInput());
    const club = repository.createClub("public-nonmember-post-club");
    const milestone = repository.createMilestone(club.id, {
      position: 1,
      safeTitle: "Opening"
    });

    const response = await request(app)
      .post("/api/clubs/public-nonmember-post-club/posts")
      .set("Cookie", await createSessionCookie(reader))
      .send(validPostInput(milestone.id))
      .expect(403);

    expect(response.body.error).toMatchObject({
      code: "FORBIDDEN",
      message: "Join this club before creating posts."
    });
    expect(repository.posts).toHaveLength(0);
  });

  it("validates post detail ids", async () => {
    const user = repository.createStoredUser(validUserInput());

    const response = await request(app)
      .get("/api/posts/not-a-uuid")
      .set("Cookie", await createSessionCookie(user))
      .expect(400);

    expect(response.body.error).toMatchObject({
      code: "BAD_REQUEST",
      message: "Check the post request and try again."
    });
  });

  it("returns not found for missing, hidden, and deleted post details", async () => {
    const user = repository.createStoredUser(validUserInput());
    const club = repository.createClub("unlisted-post-club");
    const milestone = repository.createMilestone(club.id, {
      position: 1,
      safeTitle: "Opening"
    });
    repository.createMembership(user.id, club.id);
    const hiddenPost = repository.createPost(club.id, user.id, milestone.id, {
      title: "Hidden title",
      body: "HIDDEN_BODY_SHOULD_NOT_LEAK",
      status: "HIDDEN"
    });
    const deletedPost = repository.createPost(club.id, user.id, milestone.id, {
      title: "Deleted title",
      body: "DELETED_BODY_SHOULD_NOT_LEAK",
      deletedAt: new Date()
    });

    for (const postId of [
      crypto.randomUUID(),
      hiddenPost.id,
      deletedPost.id
    ]) {
      const response = await request(app)
        .get(`/api/posts/${postId}`)
        .set("Cookie", await createSessionCookie(user))
        .expect(404);

      expect(response.body.error).toMatchObject({
        code: "NOT_FOUND",
        message: "Post not found"
      });
      expect(JSON.stringify(response.body)).not.toContain(
        "HIDDEN_BODY_SHOULD_NOT_LEAK"
      );
      expect(JSON.stringify(response.body)).not.toContain(
        "DELETED_BODY_SHOULD_NOT_LEAK"
      );
    }
  });

  it("rejects post creation from banned members", async () => {
    const user = repository.createStoredUser(validUserInput());
    const club = repository.createClub("banned-post-club");
    const milestone = repository.createMilestone(club.id, {
      position: 1,
      safeTitle: "Opening"
    });
    repository.createMembership(user.id, club.id);
    repository.createBan(user.id, club.id);

    const response = await request(app)
      .post("/api/clubs/banned-post-club/posts")
      .set("Cookie", await createSessionCookie(user))
      .send(validPostInput(milestone.id))
      .expect(403);

    expect(response.body.error).toMatchObject({
      code: "FORBIDDEN",
      message: "You cannot create posts in this club."
    });
    expect(repository.posts).toHaveLength(0);
  });

  it("validates post creation input", async () => {
    const user = repository.createStoredUser(validUserInput());
    const club = repository.createClub("invalid-post-club");
    const milestone = repository.createMilestone(club.id, {
      position: 1,
      safeTitle: "Opening"
    });
    repository.createMembership(user.id, club.id);

    for (const input of [
      validPostInput(milestone.id, { title: "" }),
      validPostInput(milestone.id, { body: "" }),
      { ...validPostInput(milestone.id), type: "NOT_A_TYPE" },
      validPostInput("not-a-uuid")
    ]) {
      await request(app)
        .post("/api/clubs/invalid-post-club/posts")
        .set("Cookie", await createSessionCookie(user))
        .send(input)
        .expect(400);
    }

    expect(repository.posts).toHaveLength(0);
  });

  it("rejects required milestones from another club", async () => {
    const user = repository.createStoredUser(validUserInput());
    const club = repository.createClub("milestone-owner-post-club");
    const otherClub = repository.createClub("other-post-club");
    const otherMilestone = repository.createMilestone(otherClub.id, {
      position: 1,
      safeTitle: "Other opening"
    });
    repository.createMembership(user.id, club.id);

    const response = await request(app)
      .post("/api/clubs/milestone-owner-post-club/posts")
      .set("Cookie", await createSessionCookie(user))
      .send(validPostInput(otherMilestone.id))
      .expect(400);

    expect(response.body.error).toMatchObject({
      code: "BAD_REQUEST",
      message: "Choose a milestone from this club."
    });
    expect(repository.posts).toHaveLength(0);
  });

  it("returns a locked card when members create posts beyond their progress", async () => {
    const user = repository.createStoredUser(validUserInput());
    const club = repository.createClub("future-post-club");
    const firstMilestone = repository.createMilestone(club.id, {
      position: 1,
      safeTitle: "Opening"
    });
    const futureMilestone = repository.createMilestone(club.id, {
      position: 3,
      safeTitle: "Finale"
    });
    repository.createMembership(user.id, club.id);
    repository.setProgress(user.id, club.id, firstMilestone.id, "STRICT");

    const response = await request(app)
      .post("/api/clubs/future-post-club/posts")
      .set("Cookie", await createSessionCookie(user))
      .send({
        title: "Future title should not echo",
        body: "FUTURE_BODY_SHOULD_NOT_LEAK",
        type: "THEORY",
        requiredMilestoneId: futureMilestone.id
      })
      .expect(201);

    expect(response.body.post).toEqual({
      id: expect.any(String),
      visibility: "LOCKED",
      type: "THEORY",
      status: "VISIBLE",
      requiredMilestone: {
        id: futureMilestone.id,
        position: 3,
        label: "Finale"
      },
      counts: {
        commentCount: 0,
        reactionCount: 0,
        unreadCommentCount: 0
      },
      lockReason: "Reach milestone 3: Finale to unlock this discussion.",
      createdAt: expect.any(String),
      updatedAt: expect.any(String)
    });
    expect(JSON.stringify(response.body)).not.toContain(
      "Future title should not echo"
    );
    expect(JSON.stringify(response.body)).not.toContain(
      "FUTURE_BODY_SHOULD_NOT_LEAK"
    );
  });

  it("hides private club feed and post text from non-members", async () => {
    const owner = repository.createStoredUser(validUserInput());
    const reader = repository.createStoredUser({
      ...validUserInput(),
      email: "reader-two@example.com"
    });
    const club = repository.createClub("private-story-room", "PRIVATE");
    const milestone = repository.createMilestone(club.id, {
      position: 1,
      safeTitle: "Private opening"
    });
    repository.createMembership(owner.id, club.id, "OWNER");
    repository.createPost(club.id, owner.id, milestone.id, {
      title: "Private plot thread",
      body: "PRIVATE_POST_BODY_SHOULD_NOT_LEAK"
    });

    const response = await request(app)
      .get("/api/clubs/private-story-room/posts")
      .set("x-request-id", "posts-private-non-member")
      .set("Cookie", await createSessionCookie(reader))
      .expect(404);

    expect(response.body).toEqual({
      error: {
        code: "NOT_FOUND",
        message: "Club not found",
        requestId: "posts-private-non-member"
      }
    });
    expect(JSON.stringify(response.body)).not.toContain("Private plot thread");
    expect(JSON.stringify(response.body)).not.toContain(
      "PRIVATE_POST_BODY_SHOULD_NOT_LEAK"
    );
  });

  it("hides private club post detail and post text from non-members", async () => {
    const owner = repository.createStoredUser(validUserInput());
    const reader = repository.createStoredUser({
      ...validUserInput(),
      email: "private-detail-reader@example.com"
    });
    const club = repository.createClub("private-detail-room", "PRIVATE");
    const milestone = repository.createMilestone(club.id, {
      position: 1,
      safeTitle: "Private opening"
    });
    repository.createMembership(owner.id, club.id, "OWNER");
    const post = repository.createPost(club.id, owner.id, milestone.id, {
      title: "Private direct title",
      body: "PRIVATE_DIRECT_BODY_SHOULD_NOT_LEAK"
    });

    const response = await request(app)
      .get(`/api/posts/${post.id}`)
      .set("x-request-id", "post-detail-private-non-member")
      .set("Cookie", await createSessionCookie(reader))
      .expect(404);

    expect(response.body).toEqual({
      error: {
        code: "NOT_FOUND",
        message: "Post not found",
        requestId: "post-detail-private-non-member"
      }
    });
    expect(JSON.stringify(response.body)).not.toContain("Private direct title");
    expect(JSON.stringify(response.body)).not.toContain(
      "PRIVATE_DIRECT_BODY_SHOULD_NOT_LEAK"
    );
  });

  it("returns locked cards without title, body preview, or author data for behind-progress users", async () => {
    const user = repository.createStoredUser(validUserInput());
    const club = repository.createClub("public-story-circle");
    const firstMilestone = repository.createMilestone(club.id, {
      position: 1,
      safeTitle: "Opening"
    });
    const secondMilestone = repository.createMilestone(club.id, {
      position: 2,
      safeTitle: "Spoiler-safe midpoint"
    });
    repository.createMembership(user.id, club.id);
    repository.setProgress(user.id, club.id, firstMilestone.id, "STRICT");
    repository.createPost(club.id, user.id, secondMilestone.id, {
      title: "Unsafe title should not leak",
      body: "LOCKED_SECRET_BODY_SHOULD_NOT_LEAK"
    });

    const response = await request(app)
      .get("/api/clubs/public-story-circle/posts")
      .set("Cookie", await createSessionCookie(user))
      .expect(200);

    expect(response.body.posts).toHaveLength(1);
    expect(response.body.posts[0]).toEqual({
      id: expect.any(String),
      visibility: "LOCKED",
      type: "DISCUSSION",
      status: "VISIBLE",
      requiredMilestone: {
        id: secondMilestone.id,
        position: 2,
        label: "Spoiler-safe midpoint"
      },
      counts: {
        commentCount: 0,
        reactionCount: 0,
        unreadCommentCount: 0
      },
      lockReason:
        "Reach milestone 2: Spoiler-safe midpoint to unlock this discussion.",
      createdAt: expect.any(String),
      updatedAt: expect.any(String)
    });
    expect(response.body.posts[0]).not.toHaveProperty("title");
    expect(response.body.posts[0]).not.toHaveProperty("body");
    expect(response.body.posts[0]).not.toHaveProperty("bodyPreview");
    expect(response.body.posts[0]).not.toHaveProperty("author");
    expect(JSON.stringify(response.body)).not.toContain(
      "Unsafe title should not leak"
    );
    expect(JSON.stringify(response.body)).not.toContain(
      "LOCKED_SECRET_BODY_SHOULD_NOT_LEAK"
    );
  });

  it("returns locked post detail without title, body preview, author, or media fields", async () => {
    const user = repository.createStoredUser(validUserInput());
    const club = repository.createClub("locked-detail-story-circle");
    const firstMilestone = repository.createMilestone(club.id, {
      position: 1,
      safeTitle: "Opening"
    });
    const secondMilestone = repository.createMilestone(club.id, {
      position: 2,
      safeTitle: "Spoiler-safe midpoint"
    });
    repository.createMembership(user.id, club.id);
    repository.setProgress(user.id, club.id, firstMilestone.id, "STRICT");
    const post = repository.createPost(club.id, user.id, secondMilestone.id, {
      title: "Direct unsafe title should not leak",
      body: "DIRECT_LOCKED_SECRET_BODY_SHOULD_NOT_LEAK"
    });

    const response = await request(app)
      .get(`/api/posts/${post.id}`)
      .set("Cookie", await createSessionCookie(user))
      .expect(200);

    expect(response.body.post).toEqual({
      id: post.id,
      visibility: "LOCKED",
      type: "DISCUSSION",
      status: "VISIBLE",
      requiredMilestone: {
        id: secondMilestone.id,
        position: 2,
        label: "Spoiler-safe midpoint"
      },
      counts: {
        commentCount: 0,
        reactionCount: 0,
        unreadCommentCount: 0
      },
      lockReason:
        "Reach milestone 2: Spoiler-safe midpoint to unlock this discussion.",
      createdAt: expect.any(String),
      updatedAt: expect.any(String)
    });
    expect(response.body.post).not.toHaveProperty("title");
    expect(response.body.post).not.toHaveProperty("body");
    expect(response.body.post).not.toHaveProperty("bodyPreview");
    expect(response.body.post).not.toHaveProperty("author");
    expect(response.body.post).not.toHaveProperty("media");
    expect(JSON.stringify(response.body)).not.toContain(
      "Direct unsafe title should not leak"
    );
    expect(JSON.stringify(response.body)).not.toContain(
      "DIRECT_LOCKED_SECRET_BODY_SHOULD_NOT_LEAK"
    );
  });

  it("returns visible card title and body preview at the required milestone", async () => {
    const user = repository.createStoredUser(validUserInput());
    const club = repository.createClub("visible-story-circle");
    const milestone = repository.createMilestone(club.id, {
      position: 1,
      safeTitle: "Opening"
    });
    repository.createMembership(user.id, club.id);
    repository.setProgress(user.id, club.id, milestone.id, "STRICT");
    repository.createPost(club.id, user.id, milestone.id, {
      title: "Opening thoughts",
      body: "This opening chapter sets the tone without future context."
    });

    const response = await request(app)
      .get("/api/clubs/visible-story-circle/posts")
      .set("Cookie", await createSessionCookie(user))
      .expect(200);

    expect(response.body.posts[0]).toMatchObject({
      visibility: "VISIBLE",
      title: "Opening thoughts",
      bodyPreview: "This opening chapter sets the tone without future context.",
      author: {
        id: user.id,
        displayName: "Reader",
        username: null
      }
    });
  });

  it("returns the same visible sanitizer shape for feed and direct detail", async () => {
    const user = repository.createStoredUser(validUserInput());
    const club = repository.createClub("matching-detail-story-circle");
    const milestone = repository.createMilestone(club.id, {
      position: 1,
      safeTitle: "Opening"
    });
    repository.createMembership(user.id, club.id);
    repository.setProgress(user.id, club.id, milestone.id, "STRICT");
    const post = repository.createPost(club.id, user.id, milestone.id, {
      title: "Opening detail thoughts",
      body: "The feed and detail views should agree."
    });

    const feedResponse = await request(app)
      .get("/api/clubs/matching-detail-story-circle/posts")
      .set("Cookie", await createSessionCookie(user))
      .expect(200);
    const detailResponse = await request(app)
      .get(`/api/posts/${post.id}`)
      .set("Cookie", await createSessionCookie(user))
      .expect(200);

    expect(detailResponse.body.post).toEqual(feedResponse.body.posts[0]);
  });

  it("changes card visibility after progress is updated", async () => {
    const user = repository.createStoredUser(validUserInput());
    const club = repository.createClub("progress-story-circle");
    const firstMilestone = repository.createMilestone(club.id, {
      position: 1,
      safeTitle: "Opening"
    });
    const secondMilestone = repository.createMilestone(club.id, {
      position: 2,
      safeTitle: "Midpoint"
    });
    repository.createMembership(user.id, club.id);
    repository.setProgress(user.id, club.id, firstMilestone.id, "STRICT");
    repository.createPost(club.id, user.id, secondMilestone.id, {
      title: "Midpoint unlocked title",
      body: "Midpoint body is visible after progress catches up."
    });

    const beforeProgressUpdate = await request(app)
      .get("/api/clubs/progress-story-circle/posts")
      .set("Cookie", await createSessionCookie(user))
      .expect(200);

    expect(beforeProgressUpdate.body.posts[0].visibility).toBe("LOCKED");

    await request(app)
      .patch("/api/clubs/progress-story-circle/progress")
      .set("Cookie", await createSessionCookie(user))
      .send({
        currentMilestoneId: secondMilestone.id,
        mode: "STRICT"
      })
      .expect(200);

    const afterProgressUpdate = await request(app)
      .get("/api/clubs/progress-story-circle/posts")
      .set("Cookie", await createSessionCookie(user))
      .expect(200);

    expect(afterProgressUpdate.body.posts[0]).toMatchObject({
      visibility: "VISIBLE",
      title: "Midpoint unlocked title",
      bodyPreview: "Midpoint body is visible after progress catches up."
    });
  });

  it("changes detail visibility after progress is updated", async () => {
    const user = repository.createStoredUser(validUserInput());
    const club = repository.createClub("detail-progress-story-circle");
    const firstMilestone = repository.createMilestone(club.id, {
      position: 1,
      safeTitle: "Opening"
    });
    const secondMilestone = repository.createMilestone(club.id, {
      position: 2,
      safeTitle: "Midpoint"
    });
    repository.createMembership(user.id, club.id);
    repository.setProgress(user.id, club.id, firstMilestone.id, "STRICT");
    const post = repository.createPost(club.id, user.id, secondMilestone.id, {
      title: "Midpoint detail unlocked title",
      body: "Midpoint detail body is visible after progress catches up."
    });

    const beforeProgressUpdate = await request(app)
      .get(`/api/posts/${post.id}`)
      .set("Cookie", await createSessionCookie(user))
      .expect(200);

    expect(beforeProgressUpdate.body.post.visibility).toBe("LOCKED");

    await request(app)
      .patch("/api/clubs/detail-progress-story-circle/progress")
      .set("Cookie", await createSessionCookie(user))
      .send({
        currentMilestoneId: secondMilestone.id,
        mode: "STRICT"
      })
      .expect(200);

    const afterProgressUpdate = await request(app)
      .get(`/api/posts/${post.id}`)
      .set("Cookie", await createSessionCookie(user))
      .expect(200);

    expect(afterProgressUpdate.body.post).toMatchObject({
      visibility: "VISIBLE",
      title: "Midpoint detail unlocked title",
      bodyPreview:
        "Midpoint detail body is visible after progress catches up."
    });
  });

  it("validates feed tab, cursor, and limit query params", async () => {
    const user = repository.createStoredUser(validUserInput());
    const club = repository.createClub("pagination-story-circle");
    const milestone = repository.createMilestone(club.id, {
      position: 1,
      safeTitle: "Opening"
    });
    repository.createMembership(user.id, club.id);
    repository.setProgress(user.id, club.id, milestone.id, "STRICT");
    repository.createPost(club.id, user.id, milestone.id, {
      title: "First post",
      body: "First body."
    });
    repository.createPost(club.id, user.id, milestone.id, {
      title: "Second post",
      body: "Second body."
    });

    for (const path of [
      "/api/clubs/pagination-story-circle/posts?tab=unknown",
      "/api/clubs/pagination-story-circle/posts?cursor=not-a-cursor",
      "/api/clubs/pagination-story-circle/posts?limit=51"
    ]) {
      const response = await request(app)
        .get(path)
        .set("Cookie", await createSessionCookie(user))
        .expect(400);

      expect(response.body.error).toMatchObject({
        code: "BAD_REQUEST",
        message: "Check the feed request and try again."
      });
    }

    const response = await request(app)
      .get("/api/clubs/pagination-story-circle/posts?limit=1")
      .set("Cookie", await createSessionCookie(user))
      .expect(200);

    expect(response.body.posts).toHaveLength(1);
    expect(response.body.pagination).toEqual({
      limit: 1,
      nextCursor: expect.any(String),
      hasMore: true
    });
  });

  it("filters safe, locked, and all feed tabs before returning sanitized cards", async () => {
    const user = repository.createStoredUser(validUserInput());
    const club = repository.createClub("tabbed-story-circle");
    const firstMilestone = repository.createMilestone(club.id, {
      position: 1,
      safeTitle: "Opening"
    });
    const secondMilestone = repository.createMilestone(club.id, {
      position: 2,
      safeTitle: "Midpoint"
    });
    repository.createMembership(user.id, club.id);
    repository.setProgress(user.id, club.id, firstMilestone.id, "STRICT");
    repository.createPost(club.id, user.id, firstMilestone.id, {
      title: "Safe title",
      body: "Safe body."
    });
    repository.createPost(club.id, user.id, secondMilestone.id, {
      title: "Locked title should not leak",
      body: "LOCKED_TAB_BODY_SHOULD_NOT_LEAK"
    });

    const cookie = await createSessionCookie(user);
    const safeResponse = await request(app)
      .get("/api/clubs/tabbed-story-circle/posts?tab=safe")
      .set("Cookie", cookie)
      .expect(200);
    const lockedResponse = await request(app)
      .get("/api/clubs/tabbed-story-circle/posts?tab=locked")
      .set("Cookie", cookie)
      .expect(200);
    const allResponse = await request(app)
      .get("/api/clubs/tabbed-story-circle/posts?tab=all")
      .set("Cookie", cookie)
      .expect(200);

    expect(safeResponse.body.posts).toHaveLength(1);
    expect(safeResponse.body.posts[0]).toMatchObject({
      visibility: "VISIBLE",
      title: "Safe title"
    });
    expect(lockedResponse.body.posts).toHaveLength(1);
    expect(lockedResponse.body.posts[0]).toMatchObject({
      visibility: "LOCKED",
      requiredMilestone: {
        position: 2,
        label: "Midpoint"
      }
    });
    expect(lockedResponse.body.posts[0]).not.toHaveProperty("title");
    expect(lockedResponse.body.posts[0]).not.toHaveProperty("author");
    expect(JSON.stringify(lockedResponse.body)).not.toContain(
      "LOCKED_TAB_BODY_SHOULD_NOT_LEAK"
    );
    expect(
      allResponse.body.posts.map(
        (post: { visibility: string }) => post.visibility
      )
    ).toEqual(["LOCKED", "VISIBLE"]);
  });

  it("returns only current-user posts for the my-posts tab and still sanitizes locked posts", async () => {
    const user = repository.createStoredUser(validUserInput());
    const otherUser = repository.createStoredUser({
      ...validUserInput(),
      email: "other-post-author@example.com"
    });
    const club = repository.createClub("my-posts-story-circle");
    const firstMilestone = repository.createMilestone(club.id, {
      position: 1,
      safeTitle: "Opening"
    });
    const secondMilestone = repository.createMilestone(club.id, {
      position: 2,
      safeTitle: "Future"
    });
    repository.createMembership(user.id, club.id);
    repository.createMembership(otherUser.id, club.id);
    repository.setProgress(user.id, club.id, firstMilestone.id, "STRICT");
    repository.createPost(club.id, user.id, firstMilestone.id, {
      title: "My safe post",
      body: "My safe body."
    });
    repository.createPost(club.id, otherUser.id, firstMilestone.id, {
      title: "Other user post",
      body: "Other user body."
    });
    repository.createPost(club.id, user.id, secondMilestone.id, {
      title: "My future title should not leak",
      body: "MY_FUTURE_BODY_SHOULD_NOT_LEAK"
    });

    const response = await request(app)
      .get("/api/clubs/my-posts-story-circle/posts?tab=my-posts")
      .set("Cookie", await createSessionCookie(user))
      .expect(200);

    expect(response.body.posts).toHaveLength(2);
    expect(
      response.body.posts.map((post: { visibility: string }) => post.visibility)
    ).toEqual(["LOCKED", "VISIBLE"]);
    expect(JSON.stringify(response.body)).toContain("My safe post");
    expect(JSON.stringify(response.body)).not.toContain("Other user post");
    expect(JSON.stringify(response.body)).not.toContain(
      "MY_FUTURE_BODY_SHOULD_NOT_LEAK"
    );
  });

  it("paginates cursor results without duplicates or skipped same-timestamp posts", async () => {
    const user = repository.createStoredUser(validUserInput());
    const club = repository.createClub("cursor-story-circle");
    const milestone = repository.createMilestone(club.id, {
      position: 1,
      safeTitle: "Opening"
    });
    const sharedCreatedAt = new Date(Date.UTC(2026, 0, 2, 12));
    repository.createMembership(user.id, club.id);
    repository.setProgress(user.id, club.id, milestone.id, "STRICT");
    const posts = [
      repository.createPost(club.id, user.id, milestone.id, {
        title: "Same time A",
        body: "A.",
        createdAt: sharedCreatedAt
      }),
      repository.createPost(club.id, user.id, milestone.id, {
        title: "Same time B",
        body: "B.",
        createdAt: sharedCreatedAt
      }),
      repository.createPost(club.id, user.id, milestone.id, {
        title: "Same time C",
        body: "C.",
        createdAt: sharedCreatedAt
      })
    ].sort((firstPost, secondPost) =>
      firstPost.id.localeCompare(secondPost.id)
    );
    const cookie = await createSessionCookie(user);
    const receivedIds: string[] = [];
    let cursor: string | null = null;

    for (let page = 0; page < posts.length; page += 1) {
      const cursorQuery: string = cursor
        ? `&cursor=${encodeURIComponent(cursor)}`
        : "";
      const responseBody: {
        posts: Array<{ id: string }>;
        pagination: { nextCursor: string | null };
      } = (
        await request(app)
          .get(
            `/api/clubs/cursor-story-circle/posts?tab=safe&limit=1${cursorQuery}`
          )
          .set("Cookie", cookie)
          .expect(200)
      ).body;

      expect(responseBody.posts).toHaveLength(1);
      receivedIds.push(responseBody.posts[0].id);
      cursor = responseBody.pagination.nextCursor;
    }

    expect(receivedIds).toEqual(posts.map((post) => post.id));
    expect(new Set(receivedIds).size).toBe(posts.length);
    expect(cursor).toBeNull();
  });
});

const createPostsTestApp = (
  repository: AuthUsersRepository & PostsRepository & ProgressRepository
) => {
  const app = express();
  const authService = createAuthService(repository);
  const authMiddleware = createAuthMiddleware(authService);
  const postsService = createPostsService(repository);
  const postsController = createPostsController(postsService);
  const progressService = createProgressService(repository);
  const progressController = createProgressController(progressService);

  app.use(requestIdMiddleware);
  app.use(express.json());
  app.use(cookieParser());
  app.use(
    "/api/posts",
    createPostDetailsRouter(postsController, authMiddleware)
  );
  app.use("/api/clubs", createPostsRouter(postsController, authMiddleware));
  app.use(
    "/api/clubs",
    createProgressRouter(progressController, authMiddleware)
  );
  app.use(errorHandler);

  return app;
};

type StoredClub = {
  id: string;
  slug: string;
  visibility: "PUBLIC" | "PRIVATE" | "INVITE_ONLY";
};

type StoredProgress = {
  id: string;
  userId: string;
  clubId: string;
  currentMilestoneId: string | null;
  mode: ProgressMode;
  createdAt: Date;
  updatedAt: Date;
};

type StoredProgressHistory = ProgressHistoryRecord & {
  userId: string;
  clubId: string;
};

class InMemoryPostsRepository
  implements AuthUsersRepository, PostsRepository, ProgressRepository
{
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
  readonly bans: Array<{
    userId: string;
    clubId: string;
    expiresAt: Date | null;
    revokedAt: Date | null;
  }> = [];
  readonly milestones: Array<ProgressMilestoneRecord & { clubId: string }> = [];
  readonly progressRows: StoredProgress[] = [];
  readonly history: StoredProgressHistory[] = [];
  readonly posts: Array<
    ClubPostRecord & {
      clubId: string;
      milestoneId: string;
      deletedAt: Date | null;
    }
  > = [];

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

  createUser = async (input: CreateAuthUserInput) =>
    this.createStoredUser(input);

  createStoredUser = ({
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

  createClub = (
    slug: string,
    visibility: StoredClub["visibility"] = "PUBLIC"
  ) => {
    const club = {
      id: crypto.randomUUID(),
      slug,
      visibility
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

  createMilestone = (
    clubId: string,
    input: Partial<ProgressMilestoneRecord> &
      Pick<ProgressMilestoneRecord, "position" | "safeTitle">
  ) => {
    const milestone = {
      id: crypto.randomUUID(),
      clubId,
      fullTitle: null,
      spoilerName: false,
      ...input
    };

    this.milestones.push(milestone);

    return milestone;
  };

  createPost = (
    clubId: string,
    authorId: string,
    milestoneId: string,
    input: {
      title: string;
      body: string;
      type?: ClubPostRecord["type"];
      status?: ClubPostRecord["status"];
      deletedAt?: Date | null;
      createdAt?: Date;
    }
  ) => {
    const author = this.findStoredUser(authorId);
    const requiredMilestone = this.findMilestone(milestoneId);

    if (!author || !requiredMilestone) {
      throw new Error("Post fixture requires existing author and milestone.");
    }

    const now =
      input.createdAt ?? new Date(Date.UTC(2026, 0, 1, 12, this.posts.length));
    const post = {
      id: crypto.randomUUID(),
      clubId,
      milestoneId,
      type: input.type ?? "DISCUSSION",
      status: input.status ?? "VISIBLE",
      title: input.title,
      body: input.body,
      author: {
        id: author.id,
        displayName: author.displayName,
        username: author.username
      },
      requiredMilestone,
      createdAt: now,
      updatedAt: now,
      deletedAt: input.deletedAt ?? null
    };

    this.posts.push(post);

    return post;
  };

  setProgress = (
    userId: string,
    clubId: string,
    milestoneId: string | null,
    mode: ProgressMode
  ) => {
    const now = new Date();
    this.progressRows.push({
      id: crypto.randomUUID(),
      userId,
      clubId,
      currentMilestoneId: milestoneId,
      mode,
      createdAt: now,
      updatedAt: now
    });
  };

  findClubForFeed = async (
    slug: string,
    userId: string
  ): Promise<ClubFeedRecord | null> => {
    const club = this.findStoredClubBySlug(slug);

    if (!club) {
      return null;
    }

    const progress = this.findProgress(userId, club.id);

    return {
      id: club.id,
      visibility: club.visibility,
      currentUserRole: this.findMembership(userId, club.id)?.role ?? null,
      progress: {
        mode: progress?.mode ?? "STRICT",
        currentMilestonePosition:
          this.findMilestone(progress?.currentMilestoneId ?? null)?.position ??
          null
      }
    };
  };

  findClubForPostCreation = async (
    slug: string,
    userId: string
  ): Promise<ClubPostCreationClubRecord | null> => {
    const club = this.findStoredClubBySlug(slug);

    if (!club) {
      return null;
    }

    const progress = this.findProgress(userId, club.id);

    return {
      id: club.id,
      visibility: club.visibility,
      currentUserRole: this.findMembership(userId, club.id)?.role ?? null,
      isCurrentUserBanned: this.hasActiveBan(userId, club.id),
      progress: {
        mode: progress?.mode ?? "STRICT",
        currentMilestonePosition:
          this.findMilestone(progress?.currentMilestoneId ?? null)?.position ??
          null
      }
    };
  };

  createClubPost = async (
    clubId: string,
    authorId: string,
    input: CreateClubPostRequest
  ) => {
    const requiredMilestone = this.findMilestoneForClub(
      input.requiredMilestoneId,
      clubId
    );

    if (!requiredMilestone) {
      return null;
    }

    return this.createPost(clubId, authorId, requiredMilestone.id, {
      title: input.title,
      body: input.body,
      type: input.type
    });
  };

  listClubPosts = async (
    clubId: string,
    {
      authorId,
      cursor,
      currentMilestonePosition,
      limit,
      tab
    }: ListClubPostsInput
  ): Promise<ListClubPostsResult> => {
    const progressPosition = currentMilestonePosition ?? 0;
    const visiblePosts = this.posts
      .filter(
        (post) =>
          post.clubId === clubId &&
          post.status === "VISIBLE" &&
          post.deletedAt === null &&
          this.matchesFeedTab(post, tab, authorId, progressPosition) &&
          this.isAfterCursor(post, cursor)
      )
      .sort(
        (firstPost, secondPost) =>
          secondPost.createdAt.getTime() - firstPost.createdAt.getTime() ||
          firstPost.id.localeCompare(secondPost.id)
      );
    const pagePosts = visiblePosts.slice(0, limit);
    const lastPost = pagePosts[pagePosts.length - 1];

    return {
      posts: pagePosts,
      nextCursor:
        visiblePosts.length > limit && lastPost
          ? {
              createdAt: lastPost.createdAt,
              id: lastPost.id
            }
          : null,
      hasMore: visiblePosts.length > limit
    };
  };

  findPostForDetail = async (
    postId: string,
    userId: string
  ): Promise<PostDetailRecord | null> => {
    const post = this.posts.find(
      (storedPost) =>
        storedPost.id === postId &&
        storedPost.status === "VISIBLE" &&
        storedPost.deletedAt === null
    );

    if (!post) {
      return null;
    }

    const club = this.clubs.get(post.clubId);

    if (!club) {
      return null;
    }

    const progress = this.findProgress(userId, club.id);

    return {
      post,
      club: {
        id: club.id,
        visibility: club.visibility,
        currentUserRole: this.findMembership(userId, club.id)?.role ?? null,
        progress: {
          mode: progress?.mode ?? "STRICT",
          currentMilestonePosition:
            this.findMilestone(progress?.currentMilestoneId ?? null)
              ?.position ?? null
        }
      }
    };
  };

  findClubForProgress = async (
    slug: string,
    userId: string
  ): Promise<ProgressClubRecord | null> => {
    const club = this.findStoredClubBySlug(slug);

    if (!club) {
      return null;
    }

    return {
      id: club.id,
      currentUserRole: this.findMembership(userId, club.id)?.role ?? null
    };
  };

  getProgressForUserClub = async (
    userId: string,
    clubId: string
  ): Promise<ClubProgressRecord> => {
    const progress = this.findProgress(userId, clubId);

    return this.toClubProgressRecord(userId, clubId, progress);
  };

  advanceProgressToNextMilestoneForUserClub = async (
    userId: string,
    clubId: string
  ): Promise<ClubProgressRecord> => {
    const existingProgress = this.findProgress(userId, clubId);
    const currentMilestone = this.findMilestone(
      existingProgress?.currentMilestoneId ?? null
    );
    const currentPosition = currentMilestone?.position ?? null;
    const nextMilestone = this.milestones
      .filter(
        (milestone) =>
          milestone.clubId === clubId &&
          (currentPosition === null || milestone.position > currentPosition)
      )
      .sort(
        (firstMilestone, secondMilestone) =>
          firstMilestone.position - secondMilestone.position
      )[0];

    if (!nextMilestone) {
      return this.toClubProgressRecord(userId, clubId, existingProgress);
    }

    const mode = existingProgress?.mode ?? "STRICT";
    return this.updateProgressForUserClub(userId, clubId, {
      currentMilestoneId: nextMilestone.id,
      mode
    }) as Promise<ClubProgressRecord>;
  };

  updateProgressForUserClub = async (
    userId: string,
    clubId: string,
    input: UpdateProgressRequest
  ): Promise<ClubProgressRecord | null> => {
    if (
      input.currentMilestoneId &&
      !this.milestones.some(
        (milestone) =>
          milestone.id === input.currentMilestoneId && milestone.clubId === clubId
      )
    ) {
      return null;
    }

    const existingProgress = this.findProgress(userId, clubId);
    const fromMode = existingProgress?.mode ?? "STRICT";
    const fromMilestoneId = existingProgress?.currentMilestoneId ?? null;
    const hasChanged =
      fromMode !== input.mode ||
      fromMilestoneId !== input.currentMilestoneId;
    const now = new Date();
    const progress =
      existingProgress ??
      {
        id: crypto.randomUUID(),
        userId,
        clubId,
        currentMilestoneId: null,
        mode: "STRICT" as ProgressMode,
        createdAt: now,
        updatedAt: now
      };

    progress.currentMilestoneId = input.currentMilestoneId;
    progress.mode = input.mode;
    progress.updatedAt = now;

    if (!existingProgress) {
      this.progressRows.push(progress);
    }

    if (hasChanged) {
      this.history.unshift({
        id: crypto.randomUUID(),
        userId,
        clubId,
        fromMode,
        toMode: input.mode,
        fromMilestone: this.findMilestone(fromMilestoneId),
        toMilestone: this.findMilestone(input.currentMilestoneId),
        createdAt: now
      });
    }

    return this.toClubProgressRecord(userId, clubId, progress);
  };

  private toClubProgressRecord = (
    userId: string,
    clubId: string,
    progress: StoredProgress | undefined
  ): ClubProgressRecord => ({
    id: progress?.id ?? null,
    mode: progress?.mode ?? "STRICT",
    currentMilestone: this.findMilestone(progress?.currentMilestoneId ?? null),
    totalMilestones: this.milestones.filter(
      (milestone) => milestone.clubId === clubId
    ).length,
    history: this.history
      .filter(
        (historyRow) =>
          historyRow.userId === userId && historyRow.clubId === clubId
      )
      .slice(0, 5),
    updatedAt: progress?.updatedAt ?? null
  });

  private findStoredClubBySlug = (slug: string) => {
    for (const club of this.clubs.values()) {
      if (club.slug === slug) {
        return club;
      }
    }

    return null;
  };

  private findStoredUser = (id: string) => {
    for (const user of this.usersByEmail.values()) {
      if (user.id === id) {
        return user;
      }
    }

    return null;
  };

  private findMembership = (userId: string, clubId: string) =>
    this.memberships.find(
      (membership) =>
        membership.clubId === clubId && membership.userId === userId
    );

  private findProgress = (userId: string, clubId: string) =>
    this.progressRows.find(
      (progress) => progress.userId === userId && progress.clubId === clubId
    );

  private hasActiveBan = (userId: string, clubId: string) => {
    const now = new Date();

    return this.bans.some(
      (ban) =>
        ban.userId === userId &&
        ban.clubId === clubId &&
        !ban.revokedAt &&
        (!ban.expiresAt || ban.expiresAt > now)
    );
  };

  private matchesFeedTab = (
    post: ClubPostRecord & {
      clubId: string;
      milestoneId: string;
      deletedAt: Date | null;
    },
    tab: ListClubPostsInput["tab"],
    authorId: string,
    progressPosition: number
  ) => {
    if (tab === "safe") {
      return post.requiredMilestone.position <= progressPosition;
    }

    if (tab === "locked") {
      return post.requiredMilestone.position > progressPosition;
    }

    if (tab === "my-posts") {
      return post.author.id === authorId;
    }

    return true;
  };

  private isAfterCursor = (
    post: ClubPostRecord,
    cursor: ClubPostsCursor | null
  ) => {
    if (!cursor) {
      return true;
    }

    const createdAtTime = post.createdAt.getTime();
    const cursorTime = cursor.createdAt.getTime();

    return (
      createdAtTime < cursorTime ||
      (createdAtTime === cursorTime && post.id > cursor.id)
    );
  };

  private findMilestoneForClub = (milestoneId: string, clubId: string) => {
    const milestone = this.milestones.find(
      (storedMilestone) =>
        storedMilestone.id === milestoneId && storedMilestone.clubId === clubId
    );

    if (!milestone) {
      return null;
    }

    const { clubId: _clubId, ...milestoneRecord } = milestone;

    return milestoneRecord;
  };

  private findMilestone = (milestoneId: string | null) => {
    if (!milestoneId) {
      return null;
    }

    const milestone = this.milestones.find(
      (storedMilestone) => storedMilestone.id === milestoneId
    );

    if (!milestone) {
      return null;
    }

    const { clubId: _clubId, ...milestoneRecord } = milestone;

    return milestoneRecord;
  };
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

const validPostInput = (
  requiredMilestoneId: string,
  overrides: Partial<CreateClubPostRequest> = {}
) => ({
  title: "Opening thoughts",
  body: "This is a spoiler-safe post body.",
  type: "DISCUSSION" as const,
  requiredMilestoneId,
  ...overrides
});
