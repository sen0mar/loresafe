import cookieParser from "cookie-parser";
import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import { env } from "../../config/env.js";
import { errorHandler } from "../../core/http/error-middleware.js";
import { requestIdMiddleware } from "../../core/http/request-id.js";
import { createSessionToken } from "../../core/security/session-token.js";
import type { ObjectStorage } from "../../core/storage/r2-storage.js";
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
  type ListRecentlyUnlockedInput,
  type ProgressClubRecord,
  type ProgressHistoryRecord,
  type ProgressMilestoneRecord,
  type ProgressRepository,
  type RecentlyUnlockedRecord
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
import {
  postReactionEmojis,
  type PostReactionEmoji,
  type TogglePostReactionRequest
} from "./posts.schema.js";

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

  it("lets members create visible prediction posts with reveal metadata", async () => {
    const user = repository.createStoredUser(validUserInput());
    const club = repository.createClub("member-prediction-club");
    const requiredMilestone = repository.createMilestone(club.id, {
      position: 1,
      safeTitle: "Opening"
    });
    const revealMilestone = repository.createMilestone(club.id, {
      position: 2,
      safeTitle: "Reveal checkpoint"
    });
    repository.createMembership(user.id, club.id);
    repository.setProgress(user.id, club.id, requiredMilestone.id, "STRICT");

    const response = await request(app)
      .post("/api/clubs/member-prediction-club/posts")
      .set("Cookie", await createSessionCookie(user))
      .send({
        title: "  My careful prediction  ",
        body: "  I think the map is hiding something.  ",
        type: "PREDICTION",
        requiredMilestoneId: requiredMilestone.id,
        prediction: {
          revealMilestoneId: revealMilestone.id
        }
      })
      .expect(201);

    expect(repository.posts).toHaveLength(1);
    expect(repository.predictions).toHaveLength(1);
    expect(repository.posts[0]).toMatchObject({
      type: "PREDICTION",
      title: "My careful prediction",
      body: "I think the map is hiding something.",
      prediction: {
        status: "UNRESOLVED",
        revealMilestone: {
          id: revealMilestone.id,
          position: 2,
          safeTitle: "Reveal checkpoint"
        }
      }
    });
    expect(response.body.post).toMatchObject({
      visibility: "VISIBLE",
      type: "PREDICTION",
      title: "My careful prediction",
      bodyPreview: "I think the map is hiding something.",
      prediction: {
        status: "UNRESOLVED",
        revealMilestone: {
          id: revealMilestone.id,
          position: 2,
          label: "Reveal checkpoint"
        }
      }
    });
  });

  it("returns visible prediction metadata in feed and detail reads", async () => {
    const user = repository.createStoredUser(validUserInput());
    const club = repository.createClub("visible-prediction-club");
    const requiredMilestone = repository.createMilestone(club.id, {
      position: 1,
      safeTitle: "Opening"
    });
    const revealMilestone = repository.createMilestone(club.id, {
      position: 3,
      safeTitle: "Final reveal"
    });
    repository.createMembership(user.id, club.id);
    repository.setProgress(user.id, club.id, requiredMilestone.id, "STRICT");
    const post = repository.createPost(club.id, user.id, requiredMilestone.id, {
      title: "Visible prediction",
      body: "This prediction is safe to inspect.",
      type: "PREDICTION",
      prediction: {
        status: "UNRESOLVED",
        revealMilestone
      }
    });

    const cookie = await createSessionCookie(user);
    const feedResponse = await request(app)
      .get("/api/clubs/visible-prediction-club/posts")
      .set("Cookie", cookie)
      .expect(200);
    const detailResponse = await request(app)
      .get(`/api/posts/${post.id}`)
      .set("Cookie", cookie)
      .expect(200);

    const expectedPrediction = {
      status: "UNRESOLVED",
      revealMilestone: {
        id: revealMilestone.id,
        position: 3,
        label: "Final reveal"
      }
    };

    expect(feedResponse.body.posts[0]).toMatchObject({
      visibility: "VISIBLE",
      type: "PREDICTION",
      prediction: expectedPrediction
    });
    expect(detailResponse.body.post).toMatchObject({
      visibility: "VISIBLE",
      type: "PREDICTION",
      prediction: expectedPrediction
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

  it("validates prediction creation input", async () => {
    const user = repository.createStoredUser(validUserInput());
    const club = repository.createClub("invalid-prediction-club");
    const otherClub = repository.createClub("other-prediction-club");
    const openingMilestone = repository.createMilestone(club.id, {
      position: 1,
      safeTitle: "Opening"
    });
    const laterMilestone = repository.createMilestone(club.id, {
      position: 2,
      safeTitle: "Later"
    });
    const otherMilestone = repository.createMilestone(otherClub.id, {
      position: 2,
      safeTitle: "Other later"
    });
    repository.createMembership(user.id, club.id);

    for (const input of [
      validPostInput(openingMilestone.id, {
        type: "PREDICTION"
      }),
      validPostInput(openingMilestone.id, {
        prediction: {
          revealMilestoneId: laterMilestone.id
        }
      }),
      validPostInput(openingMilestone.id, {
        type: "PREDICTION",
        prediction: {
          revealMilestoneId: otherMilestone.id
        }
      }),
      validPostInput(laterMilestone.id, {
        type: "PREDICTION",
        prediction: {
          revealMilestoneId: openingMilestone.id
        }
      })
    ]) {
      await request(app)
        .post("/api/clubs/invalid-prediction-club/posts")
        .set("Cookie", await createSessionCookie(user))
        .send(input)
        .expect(400);
    }

    expect(repository.posts).toHaveLength(0);
    expect(repository.predictions).toHaveLength(0);
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
        unreadCommentCount: 0,
        reactions: expectedEmptyReactions()
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
        unreadCommentCount: 0,
        reactions: expectedEmptyReactions()
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

  it("keeps locked prediction metadata sanitized in feed and detail reads", async () => {
    const user = repository.createStoredUser(validUserInput());
    const club = repository.createClub("locked-prediction-story-circle");
    const firstMilestone = repository.createMilestone(club.id, {
      position: 1,
      safeTitle: "Opening"
    });
    const secondMilestone = repository.createMilestone(club.id, {
      position: 2,
      safeTitle: "Midpoint"
    });
    const revealMilestone = repository.createMilestone(club.id, {
      position: 3,
      safeTitle: "Prediction reveal metadata"
    });
    repository.createMembership(user.id, club.id);
    repository.setProgress(user.id, club.id, firstMilestone.id, "STRICT");
    const post = repository.createPost(club.id, user.id, secondMilestone.id, {
      title: "LOCKED_PREDICTION_TITLE_SHOULD_NOT_LEAK",
      body: "LOCKED_PREDICTION_BODY_SHOULD_NOT_LEAK",
      type: "PREDICTION",
      prediction: {
        status: "UNRESOLVED",
        revealMilestone
      }
    });

    const cookie = await createSessionCookie(user);
    const feedResponse = await request(app)
      .get("/api/clubs/locked-prediction-story-circle/posts")
      .set("Cookie", cookie)
      .expect(200);
    const detailResponse = await request(app)
      .get(`/api/posts/${post.id}`)
      .set("Cookie", cookie)
      .expect(200);

    for (const responseBody of [feedResponse.body, detailResponse.body]) {
      const serialized = JSON.stringify(responseBody);
      const card =
        "posts" in responseBody ? responseBody.posts[0] : responseBody.post;

      expect(card).toMatchObject({
        visibility: "LOCKED",
        type: "PREDICTION",
        requiredMilestone: {
          id: secondMilestone.id,
          position: 2,
          label: "Midpoint"
        }
      });
      expect(card).not.toHaveProperty("prediction");
      expect(card).not.toHaveProperty("title");
      expect(card).not.toHaveProperty("author");
      expect(serialized).not.toContain(
        "LOCKED_PREDICTION_TITLE_SHOULD_NOT_LEAK"
      );
      expect(serialized).not.toContain(
        "LOCKED_PREDICTION_BODY_SHOULD_NOT_LEAK"
      );
      expect(serialized).not.toContain("Prediction reveal metadata");
      expect(serialized).not.toContain("UNRESOLVED");
    }
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
        unreadCommentCount: 0,
        reactions: expectedEmptyReactions()
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

  it("does not sign protected media for users behind the required milestone", async () => {
    const storage = new FakeReadStorage();
    app = createPostsTestApp(repository, storage);
    const user = repository.createStoredUser(validUserInput());
    const club = repository.createClub("protected-media-story-circle");
    const opening = repository.createMilestone(club.id, {
      position: 1,
      safeTitle: "Opening"
    });
    const future = repository.createMilestone(club.id, {
      position: 2,
      safeTitle: "Future"
    });
    repository.createMembership(user.id, club.id);
    repository.setProgress(user.id, club.id, opening.id, "STRICT");
    repository.createPost(club.id, user.id, future.id, {
      title: "Unsafe image post",
      body: "Unsafe image body.",
      media: postImageMedia("private/post-images/club/spoiler.jpg", false)
    });

    const response = await request(app)
      .get("/api/clubs/protected-media-story-circle/posts")
      .set("Cookie", await createSessionCookie(user))
      .expect(200);

    expect(response.body.posts[0]).toMatchObject({
      visibility: "LOCKED"
    });
    expect(response.body.posts[0]).not.toHaveProperty("media");
    expect(JSON.stringify(response.body)).not.toContain("spoiler.jpg");
    expect(storage.signedKeys).toEqual([]);
  });

  it("signs locked post media only when the image is marked safe to preview", async () => {
    const storage = new FakeReadStorage();
    app = createPostsTestApp(repository, storage);
    const user = repository.createStoredUser(validUserInput());
    const club = repository.createClub("safe-preview-story-circle");
    const opening = repository.createMilestone(club.id, {
      position: 1,
      safeTitle: "Opening"
    });
    const future = repository.createMilestone(club.id, {
      position: 2,
      safeTitle: "Future"
    });
    repository.createMembership(user.id, club.id);
    repository.setProgress(user.id, club.id, opening.id, "STRICT");
    const media = postImageMedia("private/post-images/club/safe.jpg", true);
    repository.createPost(club.id, user.id, future.id, {
      title: "Unsafe title",
      body: "Unsafe body.",
      media
    });

    const response = await request(app)
      .get("/api/clubs/safe-preview-story-circle/posts")
      .set("Cookie", await createSessionCookie(user))
      .expect(200);

    expect(response.body.posts[0]).toMatchObject({
      visibility: "LOCKED",
      media: {
        id: media.id,
        contentType: "image/jpeg",
        sizeBytes: 1024,
        safePreview: true,
        url: "https://reads.example/private/post-images/club/safe.jpg",
        urlExpiresAt: "2026-06-16T12:05:00.000Z"
      }
    });
    expect(response.body.posts[0].media).not.toHaveProperty("objectKey");
    expect(storage.signedKeys).toEqual(["private/post-images/club/safe.jpg"]);
  });

  it("signs visible and Brave-revealed post media with expirations", async () => {
    const storage = new FakeReadStorage();
    app = createPostsTestApp(repository, storage);
    const user = repository.createStoredUser(validUserInput());
    const club = repository.createClub("revealed-media-story-circle");
    const opening = repository.createMilestone(club.id, {
      position: 1,
      safeTitle: "Opening"
    });
    const future = repository.createMilestone(club.id, {
      position: 2,
      safeTitle: "Future"
    });
    repository.createMembership(user.id, club.id);
    repository.setProgress(user.id, club.id, future.id, "STRICT");
    const visibleMedia = postImageMedia(
      "private/post-images/club/visible.jpg",
      false
    );
    repository.createPost(club.id, user.id, future.id, {
      title: "Visible media",
      body: "Visible media body.",
      media: visibleMedia
    });

    const visibleResponse = await request(app)
      .get("/api/clubs/revealed-media-story-circle/posts")
      .set("Cookie", await createSessionCookie(user))
      .expect(200);

    expect(visibleResponse.body.posts[0]).toMatchObject({
      visibility: "VISIBLE",
      media: {
        id: visibleMedia.id,
        urlExpiresAt: "2026-06-16T12:05:00.000Z"
      }
    });

    const braveUser = repository.createStoredUser({
      email: "brave-reader@example.com",
      displayName: "Brave Reader",
      passwordHash: "$argon2id$v=19$hash"
    });
    repository.createMembership(braveUser.id, club.id);
    repository.setProgress(braveUser.id, club.id, opening.id, "BRAVE");
    const revealMedia = postImageMedia(
      "private/post-images/club/revealed.jpg",
      false
    );
    const revealedPost = repository.createPost(club.id, user.id, future.id, {
      title: "Reveal media",
      body: "Reveal media body.",
      media: revealMedia
    });

    const normalDetailResponse = await request(app)
      .get(`/api/posts/${revealedPost.id}`)
      .set("Cookie", await createSessionCookie(braveUser))
      .expect(200);
    const revealResponse = await request(app)
      .post(`/api/posts/${revealedPost.id}/reveal`)
      .set("Cookie", await createSessionCookie(braveUser))
      .expect(200);

    expect(normalDetailResponse.body.post).not.toHaveProperty("media");
    expect(revealResponse.body.post).toMatchObject({
      visibility: "REVEALED",
      media: {
        id: revealMedia.id,
        url: "https://reads.example/private/post-images/club/revealed.jpg",
        urlExpiresAt: "2026-06-16T12:05:00.000Z"
      }
    });
  });

  it("does not sign media for hidden or deleted posts", async () => {
    const storage = new FakeReadStorage();
    app = createPostsTestApp(repository, storage);
    const user = repository.createStoredUser(validUserInput());
    const club = repository.createClub("hidden-media-story-circle");
    const milestone = repository.createMilestone(club.id, {
      position: 1,
      safeTitle: "Opening"
    });
    repository.createMembership(user.id, club.id);
    repository.setProgress(user.id, club.id, milestone.id, "STRICT");
    const hiddenPost = repository.createPost(club.id, user.id, milestone.id, {
      title: "Hidden media",
      body: "Hidden media body.",
      status: "HIDDEN",
      media: postImageMedia("private/post-images/club/hidden.jpg", true)
    });
    const deletedPost = repository.createPost(club.id, user.id, milestone.id, {
      title: "Deleted media",
      body: "Deleted media body.",
      deletedAt: new Date(),
      media: postImageMedia("private/post-images/club/deleted.jpg", true)
    });

    await request(app)
      .get("/api/clubs/hidden-media-story-circle/posts")
      .set("Cookie", await createSessionCookie(user))
      .expect(200)
      .expect((response) => {
        expect(response.body.posts).toEqual([]);
      });

    for (const postId of [hiddenPost.id, deletedPost.id]) {
      await request(app)
        .get(`/api/posts/${postId}`)
        .set("Cookie", await createSessionCookie(user))
        .expect(404);
    }

    expect(storage.signedKeys).toEqual([]);
  });

  it("rejects post reaction toggles without an authenticated session", async () => {
    const response = await request(app)
      .post(`/api/posts/${crypto.randomUUID()}/reactions/toggle`)
      .set("x-request-id", "post-reaction-missing-session")
      .send({ emoji: "👍" })
      .expect(401);

    expect(response.body).toEqual({
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required",
        requestId: "post-reaction-missing-session"
      }
    });
  });

  it("validates post reaction toggle input", async () => {
    const user = repository.createStoredUser(validUserInput());

    await request(app)
      .post("/api/posts/not-a-uuid/reactions/toggle")
      .set("Cookie", await createSessionCookie(user))
      .send({ emoji: "👍" })
      .expect(400);

    await request(app)
      .post(`/api/posts/${crypto.randomUUID()}/reactions/toggle`)
      .set("Cookie", await createSessionCookie(user))
      .send({ emoji: "🔥" })
      .expect(400);
  });

  it("hides private post text from non-members on reaction toggle", async () => {
    const owner = repository.createStoredUser(validUserInput());
    const reader = repository.createStoredUser({
      ...validUserInput(),
      email: "private-reaction-reader@example.com"
    });
    const club = repository.createClub("private-reaction-room", "PRIVATE");
    const milestone = repository.createMilestone(club.id, {
      position: 1,
      safeTitle: "Private opening"
    });
    repository.createMembership(owner.id, club.id, "OWNER");
    const post = repository.createPost(club.id, owner.id, milestone.id, {
      title: "PRIVATE_REACTION_TITLE",
      body: "PRIVATE_REACTION_BODY"
    });

    const response = await request(app)
      .post(`/api/posts/${post.id}/reactions/toggle`)
      .set("Cookie", await createSessionCookie(reader))
      .send({ emoji: "👍" })
      .expect(404);

    expect(response.body.error).toMatchObject({
      code: "NOT_FOUND",
      message: "Post not found"
    });
    expect(JSON.stringify(response.body)).not.toContain(
      "PRIVATE_REACTION_TITLE"
    );
    expect(JSON.stringify(response.body)).not.toContain(
      "PRIVATE_REACTION_BODY"
    );
    expect(repository.postReactions).toHaveLength(0);
  });

  it("rejects reactions on locked posts without leaking post text", async () => {
    const user = repository.createStoredUser(validUserInput());
    const club = repository.createClub("locked-reaction-story-circle");
    const firstMilestone = repository.createMilestone(club.id, {
      position: 1,
      safeTitle: "Opening"
    });
    const secondMilestone = repository.createMilestone(club.id, {
      position: 2,
      safeTitle: "Future"
    });
    repository.createMembership(user.id, club.id);
    repository.setProgress(user.id, club.id, firstMilestone.id, "STRICT");
    const post = repository.createPost(club.id, user.id, secondMilestone.id, {
      title: "LOCKED_REACTION_TITLE",
      body: "LOCKED_REACTION_BODY"
    });

    const response = await request(app)
      .post(`/api/posts/${post.id}/reactions/toggle`)
      .set("Cookie", await createSessionCookie(user))
      .send({ emoji: "👍" })
      .expect(403);

    expect(response.body.error).toMatchObject({
      code: "FORBIDDEN",
      message: "Reach the required milestone before reacting to this discussion."
    });
    expect(JSON.stringify(response.body)).not.toContain(
      "LOCKED_REACTION_TITLE"
    );
    expect(JSON.stringify(response.body)).not.toContain("LOCKED_REACTION_BODY");
    expect(repository.postReactions).toHaveLength(0);
  });

  it("toggles reactions once per user, emoji, and post", async () => {
    const user = repository.createStoredUser(validUserInput());
    const club = repository.createClub("reaction-toggle-story-circle");
    const milestone = repository.createMilestone(club.id, {
      position: 1,
      safeTitle: "Opening"
    });
    repository.createMembership(user.id, club.id);
    repository.setProgress(user.id, club.id, milestone.id, "STRICT");
    const post = repository.createPost(club.id, user.id, milestone.id, {
      title: "Reaction title",
      body: "Reaction body"
    });
    const cookie = await createSessionCookie(user);

    const addedResponse = await request(app)
      .post(`/api/posts/${post.id}/reactions/toggle`)
      .set("Cookie", cookie)
      .send({ emoji: "👍" })
      .expect(200);
    const duplicateAttemptResponse = await request(app)
      .post(`/api/posts/${post.id}/reactions/toggle`)
      .set("Cookie", cookie)
      .send({ emoji: "👍" })
      .expect(200);

    expect(repository.postReactions).toHaveLength(0);
    expect(addedResponse.body.post.counts).toMatchObject({
      reactionCount: 1,
      reactions: expect.arrayContaining([
        {
          emoji: "👍",
          count: 1,
          reactedByMe: true
        }
      ])
    });
    expect(duplicateAttemptResponse.body.post.counts).toMatchObject({
      reactionCount: 0,
      reactions: expect.arrayContaining([
        {
          emoji: "👍",
          count: 0,
          reactedByMe: false
        }
      ])
    });
  });

  it("aggregates different users and emojis without exposing identities", async () => {
    const firstUser = repository.createStoredUser(validUserInput());
    const secondUser = repository.createStoredUser({
      ...validUserInput(),
      email: "second-reaction-user@example.com"
    });
    const club = repository.createClub("reaction-aggregate-story-circle");
    const milestone = repository.createMilestone(club.id, {
      position: 1,
      safeTitle: "Opening"
    });
    repository.createMembership(firstUser.id, club.id);
    repository.createMembership(secondUser.id, club.id);
    repository.setProgress(firstUser.id, club.id, milestone.id, "STRICT");
    repository.setProgress(secondUser.id, club.id, milestone.id, "STRICT");
    const post = repository.createPost(club.id, firstUser.id, milestone.id, {
      title: "Aggregate title",
      body: "Aggregate body"
    });
    repository.createPostReaction(post.id, firstUser.id, "👍");
    repository.createPostReaction(post.id, secondUser.id, "👍");
    repository.createPostReaction(post.id, secondUser.id, "❤️");

    const response = await request(app)
      .get(`/api/posts/${post.id}`)
      .set("Cookie", await createSessionCookie(firstUser))
      .expect(200);

    expect(response.body.post.counts).toEqual({
      commentCount: 0,
      reactionCount: 3,
      unreadCommentCount: 0,
      reactions: [
        { emoji: "👍", count: 2, reactedByMe: true },
        { emoji: "❤️", count: 1, reactedByMe: false },
        { emoji: "😂", count: 0, reactedByMe: false },
        { emoji: "😮", count: 0, reactedByMe: false },
        { emoji: "👀", count: 0, reactedByMe: false }
      ]
    });
    expect(JSON.stringify(response.body.post.counts)).not.toContain(
      secondUser.id
    );
  });

  it("returns locked reaction aggregates without locked content", async () => {
    const reader = repository.createStoredUser(validUserInput());
    const reactor = repository.createStoredUser({
      ...validUserInput(),
      email: "locked-aggregate-reactor@example.com"
    });
    const club = repository.createClub("locked-aggregate-story-circle");
    const firstMilestone = repository.createMilestone(club.id, {
      position: 1,
      safeTitle: "Opening"
    });
    const secondMilestone = repository.createMilestone(club.id, {
      position: 2,
      safeTitle: "Future"
    });
    repository.createMembership(reader.id, club.id);
    repository.createMembership(reactor.id, club.id);
    repository.setProgress(reader.id, club.id, firstMilestone.id, "STRICT");
    repository.setProgress(reactor.id, club.id, secondMilestone.id, "STRICT");
    const post = repository.createPost(club.id, reactor.id, secondMilestone.id, {
      title: "LOCKED_AGGREGATE_TITLE",
      body: "LOCKED_AGGREGATE_BODY"
    });
    repository.createPostReaction(post.id, reactor.id, "👀");

    const response = await request(app)
      .get(`/api/posts/${post.id}`)
      .set("Cookie", await createSessionCookie(reader))
      .expect(200);

    expect(response.body.post).toMatchObject({
      id: post.id,
      visibility: "LOCKED",
      counts: {
        commentCount: 0,
        reactionCount: 1,
        unreadCommentCount: 0,
        reactions: [
          { emoji: "👍", count: 0, reactedByMe: false },
          { emoji: "❤️", count: 0, reactedByMe: false },
          { emoji: "😂", count: 0, reactedByMe: false },
          { emoji: "😮", count: 0, reactedByMe: false },
          { emoji: "👀", count: 1, reactedByMe: false }
        ]
      }
    });
    expect(response.body.post).not.toHaveProperty("title");
    expect(response.body.post).not.toHaveProperty("author");
    expect(JSON.stringify(response.body)).not.toContain(
      "LOCKED_AGGREGATE_TITLE"
    );
    expect(JSON.stringify(response.body)).not.toContain(
      "LOCKED_AGGREGATE_BODY"
    );
  });

  it("keeps Brave normal responses locked until an explicit post reveal", async () => {
    const user = repository.createStoredUser(validUserInput());
    const club = repository.createClub("brave-reveal-story-circle");
    const firstMilestone = repository.createMilestone(club.id, {
      position: 1,
      safeTitle: "Opening"
    });
    const secondMilestone = repository.createMilestone(club.id, {
      position: 2,
      safeTitle: "Midpoint"
    });
    repository.createMembership(user.id, club.id);
    repository.setProgress(user.id, club.id, firstMilestone.id, "BRAVE");
    const post = repository.createPost(club.id, user.id, secondMilestone.id, {
      title: "BRAVE_REVEALED_TITLE",
      body: "BRAVE_REVEALED_BODY"
    });

    const cookie = await createSessionCookie(user);
    const feedResponse = await request(app)
      .get("/api/clubs/brave-reveal-story-circle/posts")
      .set("Cookie", cookie)
      .expect(200);
    const detailResponse = await request(app)
      .get(`/api/posts/${post.id}`)
      .set("Cookie", cookie)
      .expect(200);
    const revealResponse = await request(app)
      .post(`/api/posts/${post.id}/reveal`)
      .set("Cookie", cookie)
      .expect(200);

    expect(feedResponse.body.posts[0]).toMatchObject({
      visibility: "LOCKED"
    });
    expect(detailResponse.body.post).toMatchObject({
      visibility: "LOCKED"
    });
    expect(JSON.stringify(feedResponse.body)).not.toContain(
      "BRAVE_REVEALED_BODY"
    );
    expect(JSON.stringify(detailResponse.body)).not.toContain(
      "BRAVE_REVEALED_BODY"
    );
    expect(revealResponse.body.post).toMatchObject({
      id: post.id,
      visibility: "REVEALED",
      title: "BRAVE_REVEALED_TITLE",
      body: "BRAVE_REVEALED_BODY",
      author: {
        id: user.id,
        displayName: user.displayName,
        username: null
      }
    });
  });

  it("returns prediction metadata when Brave reveals a locked prediction", async () => {
    const user = repository.createStoredUser(validUserInput());
    const club = repository.createClub("brave-prediction-story-circle");
    const firstMilestone = repository.createMilestone(club.id, {
      position: 1,
      safeTitle: "Opening"
    });
    const secondMilestone = repository.createMilestone(club.id, {
      position: 2,
      safeTitle: "Midpoint"
    });
    const revealMilestone = repository.createMilestone(club.id, {
      position: 3,
      safeTitle: "Prediction reveal"
    });
    repository.createMembership(user.id, club.id);
    repository.setProgress(user.id, club.id, firstMilestone.id, "BRAVE");
    const post = repository.createPost(club.id, user.id, secondMilestone.id, {
      title: "BRAVE_PREDICTION_TITLE",
      body: "BRAVE_PREDICTION_BODY",
      type: "PREDICTION",
      prediction: {
        status: "UNRESOLVED",
        revealMilestone
      }
    });

    const revealResponse = await request(app)
      .post(`/api/posts/${post.id}/reveal`)
      .set("Cookie", await createSessionCookie(user))
      .expect(200);

    expect(revealResponse.body.post).toMatchObject({
      id: post.id,
      visibility: "REVEALED",
      type: "PREDICTION",
      title: "BRAVE_PREDICTION_TITLE",
      body: "BRAVE_PREDICTION_BODY",
      prediction: {
        status: "UNRESOLVED",
        revealMilestone: {
          id: revealMilestone.id,
          position: 3,
          label: "Prediction reveal"
        }
      }
    });
  });

  it("rejects Strict and Soft behind-progress post reveals", async () => {
    for (const mode of ["STRICT", "SOFT"] as const) {
      const user = repository.createStoredUser({
        ...validUserInput(),
        email: `${mode.toLowerCase()}-reveal@example.com`
      });
      const club = repository.createClub(`${mode.toLowerCase()}-reveal-club`);
      const firstMilestone = repository.createMilestone(club.id, {
        position: 1,
        safeTitle: "Opening"
      });
      const secondMilestone = repository.createMilestone(club.id, {
        position: 2,
        safeTitle: "Future"
      });
      repository.createMembership(user.id, club.id);
      repository.setProgress(user.id, club.id, firstMilestone.id, mode);
      const post = repository.createPost(
        club.id,
        user.id,
        secondMilestone.id,
        {
          title: `${mode}_TITLE_SHOULD_NOT_REVEAL`,
          body: `${mode}_BODY_SHOULD_NOT_REVEAL`
        }
      );

      const response = await request(app)
        .post(`/api/posts/${post.id}/reveal`)
        .set("Cookie", await createSessionCookie(user))
        .expect(403);

      expect(response.body.error).toMatchObject({
        code: "FORBIDDEN",
        message: "Switch to Brave mode before revealing this discussion."
      });
      expect(JSON.stringify(response.body)).not.toContain(
        `${mode}_BODY_SHOULD_NOT_REVEAL`
      );
    }
  });

  it("returns future posts through normal endpoints for Finished users", async () => {
    const user = repository.createStoredUser(validUserInput());
    const club = repository.createClub("finished-posts-story-circle");
    const firstMilestone = repository.createMilestone(club.id, {
      position: 1,
      safeTitle: "Opening"
    });
    const finalMilestone = repository.createMilestone(club.id, {
      position: 3,
      safeTitle: "Finale"
    });
    repository.createMembership(user.id, club.id);
    repository.setProgress(user.id, club.id, firstMilestone.id, "FINISHED");
    const post = repository.createPost(club.id, user.id, finalMilestone.id, {
      title: "Finished future title",
      body: "Finished future body"
    });

    const cookie = await createSessionCookie(user);
    const safeResponse = await request(app)
      .get("/api/clubs/finished-posts-story-circle/posts?tab=safe")
      .set("Cookie", cookie)
      .expect(200);
    const lockedResponse = await request(app)
      .get("/api/clubs/finished-posts-story-circle/posts?tab=locked")
      .set("Cookie", cookie)
      .expect(200);
    const detailResponse = await request(app)
      .get(`/api/posts/${post.id}`)
      .set("Cookie", cookie)
      .expect(200);

    expect(safeResponse.body.posts).toHaveLength(1);
    expect(safeResponse.body.posts[0]).toMatchObject({
      visibility: "VISIBLE",
      title: "Finished future title",
      bodyPreview: "Finished future body"
    });
    expect(lockedResponse.body.posts).toHaveLength(0);
    expect(detailResponse.body.post).toMatchObject({
      visibility: "VISIBLE",
      title: "Finished future title",
      bodyPreview: "Finished future body"
    });
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
      body: "This opening chapter sets the tone without future context.",
      commentCount: 3
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
      },
      counts: {
        commentCount: 3
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

  it("returns posts newly safe after the latest forward progress update", async () => {
    const user = repository.createStoredUser(validUserInput());
    const club = repository.createClub("recently-unlocked-story-circle");
    const firstMilestone = repository.createMilestone(club.id, {
      position: 1,
      safeTitle: "Opening"
    });
    const secondMilestone = repository.createMilestone(club.id, {
      position: 2,
      safeTitle: "Midpoint"
    });
    const thirdMilestone = repository.createMilestone(club.id, {
      position: 3,
      safeTitle: "Finale"
    });
    repository.createMembership(user.id, club.id);
    repository.setProgress(user.id, club.id, firstMilestone.id, "STRICT");
    repository.createPost(club.id, user.id, secondMilestone.id, {
      title: "Midpoint unlocked title",
      body: "Midpoint body is newly safe."
    });
    repository.createPost(club.id, user.id, thirdMilestone.id, {
      title: "Finale unlocked title",
      body: "Finale body is newly safe too."
    });

    await request(app)
      .patch("/api/clubs/recently-unlocked-story-circle/progress")
      .set("Cookie", await createSessionCookie(user))
      .send({
        currentMilestoneId: thirdMilestone.id,
        mode: "STRICT"
      })
      .expect(200);

    const response = await request(app)
      .get("/api/clubs/recently-unlocked-story-circle/recently-unlocked")
      .set("Cookie", await createSessionCookie(user))
      .expect(200);

    expect(response.body.unlock).toMatchObject({
      historyId: expect.any(String),
      fromPosition: 1,
      toPosition: 3,
      unlockedAt: expect.any(String)
    });
    expect(response.body.posts).toHaveLength(2);
    expect(response.body.posts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          visibility: "VISIBLE",
          title: "Midpoint unlocked title",
          bodyPreview: "Midpoint body is newly safe.",
          requiredMilestone: {
            id: secondMilestone.id,
            position: 2,
            label: "Midpoint"
          }
        }),
        expect.objectContaining({
          visibility: "VISIBLE",
          title: "Finale unlocked title",
          bodyPreview: "Finale body is newly safe too.",
          requiredMilestone: {
            id: thirdMilestone.id,
            position: 3,
            label: "Finale"
          }
        })
      ])
    );
  });

  it("returns no recently unlocked posts when progress moves backward without leaking future content", async () => {
    const user = repository.createStoredUser(validUserInput());
    const club = repository.createClub("backward-unlocked-story-circle");
    const firstMilestone = repository.createMilestone(club.id, {
      position: 1,
      safeTitle: "Opening"
    });
    const thirdMilestone = repository.createMilestone(club.id, {
      position: 3,
      safeTitle: "Future"
    });
    repository.createMembership(user.id, club.id);
    repository.setProgress(user.id, club.id, thirdMilestone.id, "STRICT");
    repository.createPost(club.id, user.id, thirdMilestone.id, {
      title: "FUTURE_TITLE_SHOULD_NOT_LEAK",
      body: "FUTURE_BODY_SHOULD_NOT_LEAK"
    });

    await request(app)
      .patch("/api/clubs/backward-unlocked-story-circle/progress")
      .set("Cookie", await createSessionCookie(user))
      .send({
        currentMilestoneId: firstMilestone.id,
        mode: "STRICT"
      })
      .expect(200);

    const response = await request(app)
      .get("/api/clubs/backward-unlocked-story-circle/recently-unlocked")
      .set("Cookie", await createSessionCookie(user))
      .expect(200);

    expect(response.body).toMatchObject({
      unlock: {
        historyId: expect.any(String),
        fromPosition: 3,
        toPosition: 1,
        unlockedAt: expect.any(String)
      },
      posts: [],
      pagination: {
        limit: 20,
        nextCursor: null,
        hasMore: false
      }
    });
    expect(JSON.stringify(response.body)).not.toContain(
      "FUTURE_TITLE_SHOULD_NOT_LEAK"
    );
    expect(JSON.stringify(response.body)).not.toContain(
      "FUTURE_BODY_SHOULD_NOT_LEAK"
    );
  });

  it("returns an empty recently unlocked page when no progress history exists", async () => {
    const user = repository.createStoredUser(validUserInput());
    const club = repository.createClub("no-history-unlocked-story-circle");
    const milestone = repository.createMilestone(club.id, {
      position: 1,
      safeTitle: "Opening"
    });
    repository.createMembership(user.id, club.id);
    repository.setProgress(user.id, club.id, milestone.id, "STRICT");
    repository.createPost(club.id, user.id, milestone.id, {
      title: "Existing safe title",
      body: "Existing safe body."
    });

    const response = await request(app)
      .get("/api/clubs/no-history-unlocked-story-circle/recently-unlocked")
      .set("Cookie", await createSessionCookie(user))
      .expect(200);

    expect(response.body).toEqual({
      unlock: {
        historyId: null,
        fromPosition: 0,
        toPosition: 0,
        unlockedAt: null
      },
      posts: [],
      pagination: {
        limit: 20,
        nextCursor: null,
        hasMore: false
      }
    });
  });

  it("rejects recently unlocked reads from club non-members", async () => {
    const user = repository.createStoredUser(validUserInput());
    const club = repository.createClub("nonmember-unlocked-story-circle");
    const milestone = repository.createMilestone(club.id, {
      position: 1,
      safeTitle: "Opening"
    });
    repository.createPost(club.id, user.id, milestone.id, {
      title: "PRIVATE_UNLOCK_TITLE_SHOULD_NOT_LEAK",
      body: "PRIVATE_UNLOCK_BODY_SHOULD_NOT_LEAK"
    });

    const response = await request(app)
      .get("/api/clubs/nonmember-unlocked-story-circle/recently-unlocked")
      .set("Cookie", await createSessionCookie(user))
      .set("x-request-id", "recently-unlocked-nonmember")
      .expect(403);

    expect(response.body).toEqual({
      error: {
        code: "FORBIDDEN",
        message: "Join this club to view progress.",
        requestId: "recently-unlocked-nonmember"
      }
    });
    expect(JSON.stringify(response.body)).not.toContain(
      "PRIVATE_UNLOCK_TITLE_SHOULD_NOT_LEAK"
    );
    expect(JSON.stringify(response.body)).not.toContain(
      "PRIVATE_UNLOCK_BODY_SHOULD_NOT_LEAK"
    );
  });

  it("returns posts unlocked by switching to Finished mode", async () => {
    const user = repository.createStoredUser(validUserInput());
    const club = repository.createClub("finished-unlocked-story-circle");
    const firstMilestone = repository.createMilestone(club.id, {
      position: 1,
      safeTitle: "Opening"
    });
    const secondMilestone = repository.createMilestone(club.id, {
      position: 2,
      safeTitle: "Middle"
    });
    const thirdMilestone = repository.createMilestone(club.id, {
      position: 3,
      safeTitle: "End"
    });
    repository.createMembership(user.id, club.id);
    repository.setProgress(user.id, club.id, firstMilestone.id, "STRICT");
    repository.createPost(club.id, user.id, secondMilestone.id, {
      title: "Finished middle title",
      body: "Finished middle body."
    });
    repository.createPost(club.id, user.id, thirdMilestone.id, {
      title: "Finished end title",
      body: "Finished end body."
    });

    await request(app)
      .patch("/api/clubs/finished-unlocked-story-circle/progress")
      .set("Cookie", await createSessionCookie(user))
      .send({
        currentMilestoneId: firstMilestone.id,
        mode: "FINISHED"
      })
      .expect(200);

    const response = await request(app)
      .get("/api/clubs/finished-unlocked-story-circle/recently-unlocked")
      .set("Cookie", await createSessionCookie(user))
      .expect(200);

    expect(response.body.unlock).toMatchObject({
      fromPosition: 1,
      toPosition: 3
    });
    expect(response.body.posts.map((post: { title: string }) => post.title)).toEqual(
      expect.arrayContaining(["Finished middle title", "Finished end title"])
    );
  });

  it("validates recently unlocked slugs and query params", async () => {
    const user = repository.createStoredUser(validUserInput());

    await request(app)
      .get("/api/clubs/Invalid Slug/recently-unlocked")
      .set("Cookie", await createSessionCookie(user))
      .expect(400);

    await request(app)
      .get("/api/clubs/public-story-circle/recently-unlocked?limit=100")
      .set("Cookie", await createSessionCookie(user))
      .expect(400);
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

  it("returns unanswered posts using real visible non-deleted comment counts", async () => {
    const user = repository.createStoredUser(validUserInput());
    const club = repository.createClub("unanswered-story-circle");
    const milestone = repository.createMilestone(club.id, {
      position: 1,
      safeTitle: "Opening"
    });
    repository.createMembership(user.id, club.id);
    repository.setProgress(user.id, club.id, milestone.id, "STRICT");
    const unansweredPost = repository.createPost(club.id, user.id, milestone.id, {
      title: "Needs a reply",
      body: "Nobody has answered this yet."
    });
    const answeredPost = repository.createPost(club.id, user.id, milestone.id, {
      title: "Already answered",
      body: "This one has a real answer."
    });
    repository.createComment(answeredPost.id, user.id, milestone.id, {
      body: "This is a visible answer."
    });

    const cookie = await createSessionCookie(user);
    const beforeCommentResponse = await request(app)
      .get("/api/clubs/unanswered-story-circle/posts?tab=unanswered")
      .set("Cookie", cookie)
      .expect(200);

    expect(beforeCommentResponse.body.posts).toHaveLength(1);
    expect(beforeCommentResponse.body.posts[0]).toMatchObject({
      visibility: "VISIBLE",
      title: "Needs a reply",
      counts: {
        commentCount: 0
      }
    });
    expect(JSON.stringify(beforeCommentResponse.body)).not.toContain(
      "Already answered"
    );

    repository.createComment(unansweredPost.id, user.id, milestone.id, {
      body: "Now this post has an answer."
    });

    const afterCommentResponse = await request(app)
      .get("/api/clubs/unanswered-story-circle/posts?tab=unanswered")
      .set("Cookie", cookie)
      .expect(200);

    expect(afterCommentResponse.body.posts).toHaveLength(0);
  });

  it("ignores hidden and deleted comments when filtering unanswered posts", async () => {
    const user = repository.createStoredUser(validUserInput());
    const club = repository.createClub("hidden-comment-unanswered-circle");
    const milestone = repository.createMilestone(club.id, {
      position: 1,
      safeTitle: "Opening"
    });
    repository.createMembership(user.id, club.id);
    repository.setProgress(user.id, club.id, milestone.id, "STRICT");
    const post = repository.createPost(club.id, user.id, milestone.id, {
      title: "Still unanswered",
      body: "Hidden and deleted comments should not count."
    });
    repository.createComment(post.id, user.id, milestone.id, {
      body: "Hidden answer.",
      status: "HIDDEN"
    });
    repository.createComment(post.id, user.id, milestone.id, {
      body: "Deleted answer.",
      deletedAt: new Date()
    });

    const response = await request(app)
      .get("/api/clubs/hidden-comment-unanswered-circle/posts?tab=unanswered")
      .set("Cookie", await createSessionCookie(user))
      .expect(200);

    expect(response.body.posts).toHaveLength(1);
    expect(response.body.posts[0]).toMatchObject({
      title: "Still unanswered",
      counts: {
        commentCount: 0
      }
    });
  });

  it("keeps locked unanswered posts sanitized", async () => {
    const user = repository.createStoredUser(validUserInput());
    const club = repository.createClub("locked-unanswered-story-circle");
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
      title: "LOCKED_UNANSWERED_TITLE_SHOULD_NOT_LEAK",
      body: "LOCKED_UNANSWERED_BODY_SHOULD_NOT_LEAK"
    });

    const response = await request(app)
      .get("/api/clubs/locked-unanswered-story-circle/posts?tab=unanswered")
      .set("Cookie", await createSessionCookie(user))
      .expect(200);

    expect(response.body.posts).toHaveLength(1);
    expect(response.body.posts[0]).toMatchObject({
      visibility: "LOCKED",
      requiredMilestone: {
        position: 2,
        label: "Midpoint"
      },
      counts: {
        commentCount: 0
      }
    });
    expect(response.body.posts[0]).not.toHaveProperty("title");
    expect(response.body.posts[0]).not.toHaveProperty("author");
    expect(JSON.stringify(response.body)).not.toContain(
      "LOCKED_UNANSWERED_TITLE_SHOULD_NOT_LEAK"
    );
    expect(JSON.stringify(response.body)).not.toContain(
      "LOCKED_UNANSWERED_BODY_SHOULD_NOT_LEAK"
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
  repository: AuthUsersRepository & PostsRepository & ProgressRepository,
  storage: Pick<ObjectStorage, "createPresignedRead"> = new FakeReadStorage()
) => {
  const app = express();
  const authService = createAuthService(repository);
  const authMiddleware = createAuthMiddleware(authService);
  const postsService = createPostsService(repository, storage);
  const postsController = createPostsController(postsService);
  const progressService = createProgressService(repository, storage);
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

class FakeReadStorage implements Pick<ObjectStorage, "createPresignedRead"> {
  readonly signedKeys: string[] = [];

  createPresignedRead = async (objectKey: string) => {
    this.signedKeys.push(objectKey);

    return {
      readUrl: `https://reads.example/${objectKey}`,
      expiresAt: new Date("2026-06-16T12:05:00.000Z")
    };
  };
}

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

type StoredComment = {
  id: string;
  postId: string;
  authorId: string;
  requiredMilestoneId: string;
  status: "VISIBLE" | "HIDDEN";
  deletedAt: Date | null;
};

type StoredPostReaction = {
  id: string;
  postId: string;
  userId: string;
  emoji: PostReactionEmoji;
};

type StoredPrediction = NonNullable<ClubPostRecord["prediction"]>;

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
  readonly comments: StoredComment[] = [];
  readonly postReactions: StoredPostReaction[] = [];
  readonly predictions: Array<StoredPrediction & { postId: string }> = [];
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
	      commentCount?: number;
	      prediction?: StoredPrediction | null;
	      media?: ClubPostRecord["media"];
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
	      prediction: input.prediction ?? null,
	      media: input.media ?? null,
	      commentCount: input.commentCount ?? 0,
      reactionCount: 0,
      reactions: this.emptyReactions(),
      createdAt: now,
      updatedAt: now,
      deletedAt: input.deletedAt ?? null
    };

    this.posts.push(post);

    if (post.prediction) {
      this.predictions.push({
        postId: post.id,
        ...post.prediction
      });
    }

    return post;
  };

  createComment = (
    postId: string,
    authorId: string,
    requiredMilestoneId: string,
    input: {
      body: string;
      status?: "VISIBLE" | "HIDDEN";
      deletedAt?: Date | null;
    }
  ) => {
    const post = this.posts.find((storedPost) => storedPost.id === postId);
    const author = this.findStoredUser(authorId);
    const requiredMilestone = this.findMilestone(requiredMilestoneId);

    if (!post || !author || !requiredMilestone) {
      throw new Error("Comment fixture requires existing post, author, and milestone.");
    }

    const comment = {
      id: crypto.randomUUID(),
      postId,
      authorId,
      requiredMilestoneId,
      status: input.status ?? "VISIBLE",
      deletedAt: input.deletedAt ?? null
    };

    this.comments.push(comment);
    post.commentCount = this.visibleCommentCountForPost(post.id);

    return comment;
  };

  createPostReaction = (
    postId: string,
    userId: string,
    emoji: PostReactionEmoji
  ) => {
    if (
      this.postReactions.some(
        (reaction) =>
          reaction.postId === postId &&
          reaction.userId === userId &&
          reaction.emoji === emoji
      )
    ) {
      return null;
    }

    const reaction = {
      id: crypto.randomUUID(),
      postId,
      userId,
      emoji
    };

    this.postReactions.push(reaction);

    return reaction;
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

    const revealMilestone = input.prediction
      ? this.findMilestoneForClub(input.prediction.revealMilestoneId, clubId)
      : null;

    if (
      input.type === "PREDICTION" &&
      (!revealMilestone ||
        revealMilestone.position < requiredMilestone.position)
    ) {
      return null;
    }

    return this.createPost(clubId, authorId, requiredMilestone.id, {
      title: input.title,
      body: input.body,
      type: input.type,
      prediction:
        input.type === "PREDICTION" && revealMilestone
          ? {
              status: "UNRESOLVED",
              revealMilestone
            }
          : null
    });
  };

  listClubPosts = async (
    clubId: string,
    {
      authorId,
      cursor,
      currentMilestonePosition,
      limit,
      mode,
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
          this.matchesFeedTab(post, tab, authorId, progressPosition, mode) &&
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
      posts: pagePosts.map((post) => this.withReactions(post, authorId)),
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
      post: this.withReactions(post, userId),
      club: {
        id: club.id,
        slug: club.slug,
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

  togglePostReaction = async (
    postId: string,
    userId: string,
    input: TogglePostReactionRequest
  ): Promise<PostDetailRecord | null> => {
    const existingReactionIndex = this.postReactions.findIndex(
      (reaction) =>
        reaction.postId === postId &&
        reaction.userId === userId &&
        reaction.emoji === input.emoji
    );

    if (existingReactionIndex >= 0) {
      this.postReactions.splice(existingReactionIndex, 1);
    } else {
      this.createPostReaction(postId, userId, input.emoji);
    }

    return this.findPostForDetail(postId, userId);
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

  listRecentlyUnlockedPostsForUserClub = async (
    userId: string,
    clubId: string,
    { cursor, limit }: ListRecentlyUnlockedInput
  ): Promise<RecentlyUnlockedRecord> => {
    const progress = this.findProgress(userId, clubId);
    const currentProgress = {
      mode: progress?.mode ?? "STRICT",
      currentMilestonePosition:
        this.findMilestone(progress?.currentMilestoneId ?? null)?.position ??
        null
    };
    const latestHistory = this.history.find(
      (historyRow) =>
        historyRow.userId === userId && historyRow.clubId === clubId
    );

    if (!latestHistory) {
      return this.emptyRecentlyUnlockedResult(currentProgress);
    }

    const totalMilestones = this.milestones.filter(
      (milestone) => milestone.clubId === clubId
    ).length;
    const fromPosition = this.safeProgressPosition({
      mode: latestHistory.fromMode,
      milestonePosition: latestHistory.fromMilestone?.position ?? null,
      totalMilestones
    });
    const toPosition = this.safeProgressPosition({
      mode: latestHistory.toMode,
      milestonePosition: latestHistory.toMilestone?.position ?? null,
      totalMilestones
    });
    const unlock = {
      historyId: latestHistory.id,
      fromPosition,
      toPosition,
      unlockedAt: latestHistory.createdAt
    };
    const currentSafePosition = this.safeProgressPosition({
      mode: currentProgress.mode,
      milestonePosition: currentProgress.currentMilestonePosition,
      totalMilestones
    });
    const effectiveToPosition = Math.min(toPosition, currentSafePosition);

    if (effectiveToPosition <= fromPosition) {
      return {
        ...this.emptyRecentlyUnlockedResult(currentProgress),
        unlock
      };
    }

    const visiblePosts = this.posts
      .filter(
        (post) =>
          post.clubId === clubId &&
          post.status === "VISIBLE" &&
          post.deletedAt === null &&
          post.requiredMilestone.position > fromPosition &&
          post.requiredMilestone.position <= effectiveToPosition &&
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
      unlock,
      posts: pagePosts.map((post) => this.withReactions(post, userId)),
      nextCursor:
        visiblePosts.length > limit && lastPost
          ? {
              createdAt: lastPost.createdAt,
              id: lastPost.id
            }
          : null,
      hasMore: visiblePosts.length > limit,
      currentProgress
    };
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
    progressPosition: number,
    mode: ProgressMode
  ) => {
    if (tab === "safe") {
      if (mode === "FINISHED") {
        return true;
      }

      return post.requiredMilestone.position <= progressPosition;
    }

    if (tab === "locked") {
      if (mode === "FINISHED") {
        return false;
      }

      return post.requiredMilestone.position > progressPosition;
    }

    if (tab === "my-posts") {
      return post.author.id === authorId;
    }

    if (tab === "unanswered") {
      return this.visibleCommentCountForPost(post.id) === 0;
    }

    return true;
  };

  private visibleCommentCountForPost = (postId: string) =>
    this.comments.filter(
      (comment) =>
        comment.postId === postId &&
        comment.status === "VISIBLE" &&
        comment.deletedAt === null
    ).length;

  private emptyReactions = () =>
    postReactionEmojis.map((emoji) => ({
      emoji,
      count: 0,
      reactedByMe: false
    }));

  private withReactions = (
    post: ClubPostRecord & {
      clubId: string;
      milestoneId: string;
      deletedAt: Date | null;
    },
    userId: string
  ): ClubPostRecord & {
    clubId: string;
    milestoneId: string;
    deletedAt: Date | null;
  } => {
    const reactions = postReactionEmojis.map((emoji) => {
      const matchingReactions = this.postReactions.filter(
        (reaction) => reaction.postId === post.id && reaction.emoji === emoji
      );

      return {
        emoji,
        count: matchingReactions.length,
        reactedByMe: matchingReactions.some(
          (reaction) => reaction.userId === userId
        )
      };
    });

    return {
      ...post,
      reactionCount: reactions.reduce(
        (total, reaction) => total + reaction.count,
        0
      ),
      reactions
    };
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

  private safeProgressPosition = ({
    milestonePosition,
    mode,
    totalMilestones
  }: {
    mode: ProgressMode;
    milestonePosition: number | null;
    totalMilestones: number;
  }) => {
    if (mode === "FINISHED") {
      return totalMilestones;
    }

    return milestonePosition ?? 0;
  };

  private emptyRecentlyUnlockedResult = (
    currentProgress: RecentlyUnlockedRecord["currentProgress"]
  ): RecentlyUnlockedRecord => ({
    unlock: {
      historyId: null,
      fromPosition: 0,
      toPosition: 0,
      unlockedAt: null
    },
    posts: [],
    nextCursor: null,
    hasMore: false,
    currentProgress
  });

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

const postImageMedia = (
  objectKey: string,
  safePreview: boolean
): NonNullable<ClubPostRecord["media"]> => ({
  id: crypto.randomUUID(),
  contentType: "image/jpeg",
  sizeBytes: 1024,
  safePreview,
  objectKey
});

const expectedEmptyReactions = () =>
  postReactionEmojis.map((emoji) => ({
    emoji,
    count: 0,
    reactedByMe: false
  }));
