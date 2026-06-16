import cookieParser from "cookie-parser";
import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import { env } from "../../config/env.js";
import { errorHandler } from "../../core/http/error-middleware.js";
import { requestIdMiddleware } from "../../core/http/request-id.js";
import { createSessionToken } from "../../core/security/session-token.js";
import { createAuthMiddleware } from "../auth/auth.middleware.js";
import type {
  AuthUserCredentialsRecord,
  AuthUserRecord,
  AuthUsersRepository,
  CreateAuthUserInput
} from "../auth/auth.repository.js";
import { createAuthService } from "../auth/auth.service.js";
import type { ProgressMode } from "../progress/progress.schema.js";
import { createCommentsController } from "./comments.controller.js";
import type {
  CreatePostCommentInput,
  CommentPostRecord,
  CommentRecord,
  CommentsRepository
} from "./comments.repository.js";
import {
  createCommentReactionsRouter,
  createCommentsRouter
} from "./comments.routes.js";
import {
  commentReactionEmojis,
  type CommentReactionEmoji,
  type CreatePostCommentRequest,
  type ToggleCommentReactionRequest
} from "./comments.schema.js";
import { createCommentsService } from "./comments.service.js";

describe("comments routes", () => {
  let repository: InMemoryCommentsRepository;
  let app: express.Express;

  beforeEach(() => {
    repository = new InMemoryCommentsRepository();
    app = createCommentsTestApp(repository);
  });

  it("rejects comment reads and writes without an authenticated session", async () => {
    const postId = crypto.randomUUID();

    await request(app)
      .get(`/api/posts/${postId}/comments`)
      .set("x-request-id", "comments-missing-session")
      .expect(401);

    await request(app)
      .post(`/api/posts/${postId}/comments`)
      .send(validCommentInput())
      .set("x-request-id", "comments-create-missing-session")
      .expect(401);
  });

  it("validates post ids and comment bodies", async () => {
    const user = repository.createStoredUser(validUserInput());

    await request(app)
      .get("/api/posts/not-a-uuid/comments")
      .set("Cookie", await createSessionCookie(user))
      .expect(400);

    const response = await request(app)
      .post(`/api/posts/${crypto.randomUUID()}/comments`)
      .set("Cookie", await createSessionCookie(user))
      .send({
        body: ""
      })
      .expect(400);

    expect(response.body.error).toMatchObject({
      code: "BAD_REQUEST",
      message: "Check the comment details and try again."
    });
  });

  it("rejects comment reaction toggles without an authenticated session", async () => {
    const response = await request(app)
      .post(`/api/comments/${crypto.randomUUID()}/reactions/toggle`)
      .set("x-request-id", "comment-reaction-missing-session")
      .send({
        emoji: "👍"
      })
      .expect(401);

    expect(response.body.error).toMatchObject({
      code: "UNAUTHORIZED",
      message: "Authentication required",
      requestId: "comment-reaction-missing-session"
    });
  });

  it("validates comment reaction toggle input", async () => {
    const user = repository.createStoredUser(validUserInput());

    await request(app)
      .post("/api/comments/not-a-uuid/reactions/toggle")
      .set("Cookie", await createSessionCookie(user))
      .send({
        emoji: "👍"
      })
      .expect(400);

    const response = await request(app)
      .post(`/api/comments/${crypto.randomUUID()}/reactions/toggle`)
      .set("Cookie", await createSessionCookie(user))
      .send({
        emoji: "🔥"
      })
      .expect(400);

    expect(response.body.error).toMatchObject({
      code: "BAD_REQUEST",
      message: "Check the reaction request and try again."
    });
  });

  it("returns not found for missing, hidden, deleted, or inaccessible posts", async () => {
    const user = repository.createStoredUser(validUserInput());
    const hiddenPost = repository.createPostFixture(user.id, {
      postStatus: "HIDDEN"
    });
    const deletedPost = repository.createPostFixture(user.id, {
      postDeletedAt: new Date()
    });
    const privatePost = repository.createPostFixture(user.id, {
      clubVisibility: "PRIVATE"
    });

    for (const postId of [
      crypto.randomUUID(),
      hiddenPost.id,
      deletedPost.id,
      privatePost.id
    ]) {
      const response = await request(app)
        .get(`/api/posts/${postId}/comments`)
        .set("Cookie", await createSessionCookie(user))
        .expect(404);

      expect(response.body.error).toMatchObject({
        code: "NOT_FOUND",
        message: "Post not found"
      });
    }
  });

  it("lets members create top-level comments inheriting the post milestone", async () => {
    const user = repository.createStoredUser(validUserInput());
    const post = repository.createPostFixture(user.id, {
      membershipUserId: user.id,
      progressPosition: 2,
      postMilestonePosition: 2
    });

    const response = await request(app)
      .post(`/api/posts/${post.id}/comments`)
      .set("Cookie", await createSessionCookie(user))
      .send({
        body: "  This chapter finally clicked.  "
      })
      .expect(201);

    expect(repository.comments).toHaveLength(1);
    expect(repository.comments[0]).toMatchObject({
      postId: post.id,
      body: "This chapter finally clicked.",
      parentId: null,
      requiredMilestone: post.requiredMilestone
    });
    expect(response.body.comment).toMatchObject({
      visibility: "VISIBLE",
      body: "This chapter finally clicked.",
      parentId: null,
      requiredMilestone: {
        id: post.requiredMilestone.id,
        position: 2,
        label: "Milestone 2"
      }
    });
  });

  it("enqueues an ID-only notification job for new comments", async () => {
    const author = repository.createStoredUser(validUserInput());
    const commenter = repository.createStoredUser({
      ...validUserInput(),
      email: "commenter@example.com"
    });
    const post = repository.createPostFixture(author.id, {
      postMilestonePosition: 1
    });
    repository.createMembership(commenter.id, post.clubId);
    repository.setProgress(commenter.id, post.clubId, 1);

    await request(app)
      .post(`/api/posts/${post.id}/comments`)
      .set("Cookie", await createSessionCookie(commenter))
      .send({
        body: "UNSAFE_COMMENT_BODY_SHOULD_NOT_LEAK"
      })
      .expect(201);

    expect(repository.enqueuedCommentNotificationJobs).toHaveLength(1);
    expect(repository.enqueuedCommentNotificationJobs[0]).toMatchObject({
      commentId: repository.comments[0].id
    });
    expect(JSON.stringify(repository.enqueuedCommentNotificationJobs[0])).not.toContain(
      "UNSAFE_COMMENT_BODY_SHOULD_NOT_LEAK"
    );
  });

  it("enqueues reply notification jobs without unsafe comment content", async () => {
    const postAuthor = repository.createStoredUser(validUserInput());
    const parentAuthor = repository.createStoredUser({
      ...validUserInput(),
      email: "parent-author@example.com"
    });
    const replier = repository.createStoredUser({
      ...validUserInput(),
      email: "replier@example.com"
    });
    const post = repository.createPostFixture(postAuthor.id, {
      postMilestonePosition: 1
    });
    repository.createMembership(parentAuthor.id, post.clubId);
    repository.createMembership(replier.id, post.clubId);
    repository.setProgress(parentAuthor.id, post.clubId, 1);
    repository.setProgress(replier.id, post.clubId, 1);
    const parent = repository.createComment(
      post.id,
      parentAuthor.id,
      post.requiredMilestone,
      {
        body: "PARENT_UNSAFE_BODY_SHOULD_NOT_LEAK"
      }
    );

    await request(app)
      .post(`/api/posts/${post.id}/comments`)
      .set("Cookie", await createSessionCookie(replier))
      .send({
        body: "REPLY_UNSAFE_BODY_SHOULD_NOT_LEAK",
        parentId: parent.id
      })
      .expect(201);

    await request(app)
      .post(`/api/posts/${post.id}/comments`)
      .set("Cookie", await createSessionCookie(parentAuthor))
      .send({
        body: "SELF_REPLY_SHOULD_NOT_NOTIFY",
        parentId: parent.id
      })
      .expect(201);

    expect(repository.enqueuedCommentNotificationJobs).toHaveLength(2);
    expect(
      JSON.stringify(repository.enqueuedCommentNotificationJobs)
    ).not.toContain(
      "UNSAFE_BODY"
    );
  });

  it("rejects comments from non-members, banned members, and users behind the inherited milestone", async () => {
    const user = repository.createStoredUser(validUserInput());
    const post = repository.createPostFixture(user.id, {
      progressPosition: 2,
      postMilestonePosition: 2
    });

    const nonMemberResponse = await request(app)
      .post(`/api/posts/${post.id}/comments`)
      .set("Cookie", await createSessionCookie(user))
      .send(validCommentInput())
      .expect(403);

    expect(nonMemberResponse.body.error).toMatchObject({
      code: "FORBIDDEN",
      message: "Join this club before commenting."
    });

    repository.createMembership(user.id, post.clubId);
    repository.createBan(user.id, post.clubId);

    const bannedResponse = await request(app)
      .post(`/api/posts/${post.id}/comments`)
      .set("Cookie", await createSessionCookie(user))
      .send(validCommentInput())
      .expect(403);

    expect(bannedResponse.body.error).toMatchObject({
      message: "You cannot comment in this club."
    });

    repository.revokeBans(user.id, post.clubId);
    repository.setProgress(user.id, post.clubId, 1);

    const lockedResponse = await request(app)
      .post(`/api/posts/${post.id}/comments`)
      .set("Cookie", await createSessionCookie(user))
      .send(validCommentInput())
      .expect(403);

    expect(lockedResponse.body.error).toMatchObject({
      message: "Reach the required milestone before commenting."
    });
  });

  it("inherits reply milestone from the parent and rejects parents from another post", async () => {
    const user = repository.createStoredUser(validUserInput());
    const post = repository.createPostFixture(user.id, {
      membershipUserId: user.id,
      progressPosition: 3,
      postMilestonePosition: 1
    });
    const otherPost = repository.createPostFixture(user.id, {
      membershipUserId: user.id,
      progressPosition: 3,
      postMilestonePosition: 1
    });
    const parentMilestone = repository.createMilestone(post.clubId, 3);
    const parent = repository.createComment(post.id, user.id, parentMilestone, {
      body: "Later parent"
    });
    const otherParent = repository.createComment(
      otherPost.id,
      user.id,
      otherPost.requiredMilestone,
      {
        body: "Wrong post"
      }
    );

    const response = await request(app)
      .post(`/api/posts/${post.id}/comments`)
      .set("Cookie", await createSessionCookie(user))
      .send({
        body: "Reply inherits parent",
        parentId: parent.id
      })
      .expect(201);

    expect(response.body.comment.requiredMilestone).toMatchObject({
      id: parentMilestone.id,
      position: 3
    });
    expect(repository.comments.at(-1)).toMatchObject({
      parentId: parent.id,
      requiredMilestone: parentMilestone
    });

    await request(app)
      .post(`/api/posts/${post.id}/comments`)
      .set("Cookie", await createSessionCookie(user))
      .send({
        body: "Invalid reply",
        parentId: otherParent.id
      })
      .expect(400);
  });

  it("rejects replies to replies", async () => {
    const user = repository.createStoredUser(validUserInput());
    const post = repository.createPostFixture(user.id, {
      membershipUserId: user.id,
      progressPosition: 2,
      postMilestonePosition: 1
    });
    const parent = repository.createComment(
      post.id,
      user.id,
      post.requiredMilestone,
      {
        body: "Parent"
      }
    );
    const reply = repository.createComment(
      post.id,
      user.id,
      post.requiredMilestone,
      {
        body: "Reply",
        parentId: parent.id
      }
    );

    const response = await request(app)
      .post(`/api/posts/${post.id}/comments`)
      .set("Cookie", await createSessionCookie(user))
      .send({
        body: "Too nested",
        parentId: reply.id
      })
      .expect(400);

    expect(response.body.error).toMatchObject({
      code: "BAD_REQUEST",
      message: "Replies can only be one level deep."
    });
  });

  it("allows comments and replies to require a later club milestone", async () => {
    const user = repository.createStoredUser(validUserInput());
    const post = repository.createPostFixture(user.id, {
      membershipUserId: user.id,
      progressPosition: 3,
      postMilestonePosition: 1
    });
    const laterMilestone = repository.createMilestone(post.clubId, 3);
    const parent = repository.createComment(
      post.id,
      user.id,
      post.requiredMilestone,
      {
        body: "Parent"
      }
    );

    const topLevelResponse = await request(app)
      .post(`/api/posts/${post.id}/comments`)
      .set("Cookie", await createSessionCookie(user))
      .send({
        body: "Future-aware top level",
        requiredMilestoneId: laterMilestone.id
      })
      .expect(201);

    expect(topLevelResponse.body.comment).toMatchObject({
      visibility: "VISIBLE",
      parentId: null,
      requiredMilestone: {
        id: laterMilestone.id,
        position: 3
      }
    });

    const replyResponse = await request(app)
      .post(`/api/posts/${post.id}/comments`)
      .set("Cookie", await createSessionCookie(user))
      .send({
        body: "Future-aware reply",
        parentId: parent.id,
        requiredMilestoneId: laterMilestone.id
      })
      .expect(201);

    expect(replyResponse.body.comment).toMatchObject({
      visibility: "VISIBLE",
      parentId: parent.id,
      requiredMilestone: {
        id: laterMilestone.id,
        position: 3
      }
    });
  });

  it("rejects unknown, cross-club, and earlier milestone overrides", async () => {
    const user = repository.createStoredUser(validUserInput());
    const post = repository.createPostFixture(user.id, {
      membershipUserId: user.id,
      progressPosition: 3,
      postMilestonePosition: 2
    });
    const otherPost = repository.createPostFixture(user.id, {
      membershipUserId: user.id,
      progressPosition: 3,
      postMilestonePosition: 1
    });
    const earlierMilestone = repository.createMilestone(post.clubId, 1);

    const unknownResponse = await request(app)
      .post(`/api/posts/${post.id}/comments`)
      .set("Cookie", await createSessionCookie(user))
      .send({
        body: "Unknown milestone",
        requiredMilestoneId: crypto.randomUUID()
      })
      .expect(400);

    expect(unknownResponse.body.error).toMatchObject({
      message: "Choose a milestone from this club."
    });

    const crossClubResponse = await request(app)
      .post(`/api/posts/${post.id}/comments`)
      .set("Cookie", await createSessionCookie(user))
      .send({
        body: "Cross-club milestone",
        requiredMilestoneId: otherPost.requiredMilestone.id
      })
      .expect(400);

    expect(crossClubResponse.body.error).toMatchObject({
      message: "Choose a milestone from this club."
    });

    const earlierResponse = await request(app)
      .post(`/api/posts/${post.id}/comments`)
      .set("Cookie", await createSessionCookie(user))
      .send({
        body: "Earlier milestone",
        requiredMilestoneId: earlierMilestone.id
      })
      .expect(400);

    expect(earlierResponse.body.error).toMatchObject({
      message: "Choose this discussion's milestone or a later one."
    });
  });

  it("rejects comments when the user is behind the selected later milestone", async () => {
    const user = repository.createStoredUser(validUserInput());
    const post = repository.createPostFixture(user.id, {
      membershipUserId: user.id,
      progressPosition: 2,
      postMilestonePosition: 1
    });
    const laterMilestone = repository.createMilestone(post.clubId, 3);

    const response = await request(app)
      .post(`/api/posts/${post.id}/comments`)
      .set("Cookie", await createSessionCookie(user))
      .send({
        body: "Not there yet",
        requiredMilestoneId: laterMilestone.id
      })
      .expect(403);

    expect(response.body.error).toMatchObject({
      code: "FORBIDDEN",
      message: "Reach the required milestone before commenting."
    });
  });

  it("omits locked comment bodies and authors independently from visible posts", async () => {
    const user = repository.createStoredUser(validUserInput());
    const post = repository.createPostFixture(user.id, {
      membershipUserId: user.id,
      progressPosition: 1,
      postMilestonePosition: 1
    });
    const futureMilestone = repository.createMilestone(post.clubId, 2);
    repository.createComment(post.id, user.id, post.requiredMilestone, {
      body: "VISIBLE_COMMENT_BODY"
    });
    repository.createComment(post.id, user.id, futureMilestone, {
      body: "LOCKED_COMMENT_BODY"
    });

    const response = await request(app)
      .get(`/api/posts/${post.id}/comments`)
      .set("Cookie", await createSessionCookie(user))
      .expect(200);

    expect(response.body.comments).toHaveLength(2);
    expect(response.body.comments[0]).toMatchObject({
      visibility: "VISIBLE",
      body: "VISIBLE_COMMENT_BODY"
    });
    expect(response.body.comments[1]).toMatchObject({
      visibility: "LOCKED",
      requiredMilestone: {
        id: futureMilestone.id,
        position: 2
      }
    });
    expect(response.body.comments[1]).not.toHaveProperty("body");
    expect(response.body.comments[1]).not.toHaveProperty("author");
    expect(JSON.stringify(response.body)).not.toContain("LOCKED_COMMENT_BODY");
  });

  it("keeps Brave normal comment responses locked until an explicit comment reveal", async () => {
    const user = repository.createStoredUser(validUserInput());
    const post = repository.createPostFixture(user.id, {
      membershipUserId: user.id,
      progressPosition: 1,
      postMilestonePosition: 1
    });
    const futureMilestone = repository.createMilestone(post.clubId, 2);
    repository.setProgress(user.id, post.clubId, 1, "BRAVE");
    const comment = repository.createComment(
      post.id,
      user.id,
      futureMilestone,
      {
        body: "BRAVE_COMMENT_BODY"
      }
    );

    const cookie = await createSessionCookie(user);
    const commentsResponse = await request(app)
      .get(`/api/posts/${post.id}/comments`)
      .set("Cookie", cookie)
      .expect(200);
    const revealResponse = await request(app)
      .post(`/api/posts/${post.id}/comments/${comment.id}/reveal`)
      .set("Cookie", cookie)
      .expect(200);

    expect(commentsResponse.body.comments[0]).toMatchObject({
      visibility: "LOCKED"
    });
    expect(JSON.stringify(commentsResponse.body)).not.toContain(
      "BRAVE_COMMENT_BODY"
    );
    expect(revealResponse.body.comment).toMatchObject({
      id: comment.id,
      visibility: "REVEALED",
      body: "BRAVE_COMMENT_BODY",
      author: {
        id: user.id,
        displayName: user.displayName,
        username: null
      }
    });
  });

  it("rejects Strict and Soft behind-progress comment reveals", async () => {
    for (const mode of ["STRICT", "SOFT"] as const) {
      const user = repository.createStoredUser({
        ...validUserInput(),
        email: `${mode.toLowerCase()}-comment-reveal@example.com`
      });
      const post = repository.createPostFixture(user.id, {
        membershipUserId: user.id,
        progressPosition: 1,
        postMilestonePosition: 1
      });
      const futureMilestone = repository.createMilestone(post.clubId, 2);
      repository.setProgress(user.id, post.clubId, 1, mode);
      const comment = repository.createComment(
        post.id,
        user.id,
        futureMilestone,
        {
          body: `${mode}_COMMENT_BODY_SHOULD_NOT_REVEAL`
        }
      );

      const response = await request(app)
        .post(`/api/posts/${post.id}/comments/${comment.id}/reveal`)
        .set("Cookie", await createSessionCookie(user))
        .expect(403);

      expect(response.body.error).toMatchObject({
        code: "FORBIDDEN",
        message: "Switch to Brave mode before revealing this comment."
      });
      expect(JSON.stringify(response.body)).not.toContain(
        `${mode}_COMMENT_BODY_SHOULD_NOT_REVEAL`
      );
    }
  });

  it("returns future comments through normal endpoints for Finished users", async () => {
    const user = repository.createStoredUser(validUserInput());
    const post = repository.createPostFixture(user.id, {
      membershipUserId: user.id,
      progressPosition: 1,
      postMilestonePosition: 1
    });
    const futureMilestone = repository.createMilestone(post.clubId, 3);
    repository.setProgress(user.id, post.clubId, 1, "FINISHED");
    repository.createComment(post.id, user.id, futureMilestone, {
      body: "Finished comment body"
    });

    const response = await request(app)
      .get(`/api/posts/${post.id}/comments`)
      .set("Cookie", await createSessionCookie(user))
      .expect(200);

    expect(response.body.comments).toHaveLength(1);
    expect(response.body.comments[0]).toMatchObject({
      visibility: "VISIBLE",
      body: "Finished comment body",
      author: {
        id: user.id,
        displayName: user.displayName,
        username: null
      }
    });
  });

  it("toggles comment reactions and returns updated aggregate counts", async () => {
    const user = repository.createStoredUser(validUserInput());
    const otherUser = repository.createStoredUser({
      ...validUserInput(),
      email: "other-comment-reactor@example.com"
    });
    const post = repository.createPostFixture(user.id, {
      membershipUserId: user.id,
      progressPosition: 1,
      postMilestonePosition: 1
    });
    repository.createMembership(otherUser.id, post.clubId);
    repository.setProgress(otherUser.id, post.clubId, 1);
    const comment = repository.createComment(
      post.id,
      user.id,
      post.requiredMilestone,
      {
        body: "Reaction-worthy comment"
      }
    );
    repository.createCommentReaction(comment.id, otherUser.id, "👍");
    repository.createCommentReaction(comment.id, otherUser.id, "❤️");

    const cookie = await createSessionCookie(user);
    const firstToggleResponse = await request(app)
      .post(`/api/comments/${comment.id}/reactions/toggle`)
      .set("Cookie", cookie)
      .send({
        emoji: "👍"
      })
      .expect(200);

    expect(firstToggleResponse.body.comment).toMatchObject({
      id: comment.id,
      visibility: "VISIBLE",
      counts: {
        reactionCount: 3,
        reactions: expect.arrayContaining([
          {
            emoji: "👍",
            count: 2,
            reactedByMe: true
          },
          {
            emoji: "❤️",
            count: 1,
            reactedByMe: false
          }
        ])
      }
    });
    expect(repository.commentReactions).toHaveLength(3);

    const secondToggleResponse = await request(app)
      .post(`/api/comments/${comment.id}/reactions/toggle`)
      .set("Cookie", cookie)
      .send({
        emoji: "👍"
      })
      .expect(200);

    expect(secondToggleResponse.body.comment.counts).toMatchObject({
      reactionCount: 2,
      reactions: expect.arrayContaining([
        {
          emoji: "👍",
          count: 1,
          reactedByMe: false
        }
      ])
    });
    expect(repository.commentReactions).toHaveLength(2);
  });

  it("returns comment reaction aggregates on visible and locked comment reads", async () => {
    const user = repository.createStoredUser(validUserInput());
    const otherUser = repository.createStoredUser({
      ...validUserInput(),
      email: "aggregate-comment-reactor@example.com"
    });
    const post = repository.createPostFixture(user.id, {
      membershipUserId: user.id,
      progressPosition: 1,
      postMilestonePosition: 1
    });
    const futureMilestone = repository.createMilestone(post.clubId, 2);
    const visibleComment = repository.createComment(
      post.id,
      user.id,
      post.requiredMilestone,
      {
        body: "Visible reaction count"
      }
    );
    const lockedComment = repository.createComment(
      post.id,
      user.id,
      futureMilestone,
      {
        body: "LOCKED_REACTION_COUNT_BODY"
      }
    );
    repository.createCommentReaction(visibleComment.id, user.id, "👍");
    repository.createCommentReaction(lockedComment.id, otherUser.id, "👀");

    const response = await request(app)
      .get(`/api/posts/${post.id}/comments`)
      .set("Cookie", await createSessionCookie(user))
      .expect(200);

    expect(response.body.comments).toHaveLength(2);
    expect(response.body.comments[0]).toMatchObject({
      visibility: "VISIBLE",
      counts: {
        reactionCount: 1,
        reactions: expect.arrayContaining([
          {
            emoji: "👍",
            count: 1,
            reactedByMe: true
          }
        ])
      }
    });
    expect(response.body.comments[1]).toMatchObject({
      visibility: "LOCKED",
      counts: {
        reactionCount: 1,
        reactions: expect.arrayContaining([
          {
            emoji: "👀",
            count: 1,
            reactedByMe: false
          }
        ])
      }
    });
    expect(JSON.stringify(response.body)).not.toContain(
      "LOCKED_REACTION_COUNT_BODY"
    );
  });

  it("denies private and locked comment reaction toggles without creating rows", async () => {
    const user = repository.createStoredUser(validUserInput());
    const privatePost = repository.createPostFixture(user.id, {
      clubVisibility: "PRIVATE",
      postMilestonePosition: 1,
      progressPosition: 1
    });
    const privateComment = repository.createComment(
      privatePost.id,
      user.id,
      privatePost.requiredMilestone,
      {
        body: "PRIVATE_COMMENT_BODY"
      }
    );
    const lockedPost = repository.createPostFixture(user.id, {
      membershipUserId: user.id,
      progressPosition: 1,
      postMilestonePosition: 1
    });
    const futureMilestone = repository.createMilestone(lockedPost.clubId, 2);
    const lockedComment = repository.createComment(
      lockedPost.id,
      user.id,
      futureMilestone,
      {
        body: "LOCKED_COMMENT_REACTION_BODY"
      }
    );

    const privateResponse = await request(app)
      .post(`/api/comments/${privateComment.id}/reactions/toggle`)
      .set("Cookie", await createSessionCookie(user))
      .send({
        emoji: "👍"
      })
      .expect(404);

    expect(privateResponse.body.error).toMatchObject({
      code: "NOT_FOUND",
      message: "Comment not found"
    });
    expect(JSON.stringify(privateResponse.body)).not.toContain(
      "PRIVATE_COMMENT_BODY"
    );

    const lockedResponse = await request(app)
      .post(`/api/comments/${lockedComment.id}/reactions/toggle`)
      .set("Cookie", await createSessionCookie(user))
      .send({
        emoji: "👀"
      })
      .expect(403);

    expect(lockedResponse.body.error).toMatchObject({
      code: "FORBIDDEN",
      message: "Reach the required milestone before reacting to this comment."
    });
    expect(JSON.stringify(lockedResponse.body)).not.toContain(
      "LOCKED_COMMENT_REACTION_BODY"
    );
    expect(repository.commentReactions).toHaveLength(0);
  });

  it("rejects comment reactions from banned members", async () => {
    const user = repository.createStoredUser(validUserInput());
    const post = repository.createPostFixture(user.id, {
      membershipUserId: user.id,
      progressPosition: 1,
      postMilestonePosition: 1
    });
    const comment = repository.createComment(
      post.id,
      user.id,
      post.requiredMilestone,
      {
        body: "Banned users cannot react"
      }
    );
    repository.createBan(user.id, post.clubId);

    const response = await request(app)
      .post(`/api/comments/${comment.id}/reactions/toggle`)
      .set("Cookie", await createSessionCookie(user))
      .send({
        emoji: "👍"
      })
      .expect(403);

    expect(response.body.error).toMatchObject({
      code: "FORBIDDEN",
      message: "You cannot react in this club."
    });
    expect(repository.commentReactions).toHaveLength(0);
  });

  it("excludes hidden and deleted comments and counts only visible active comments", async () => {
    const user = repository.createStoredUser(validUserInput());
    const post = repository.createPostFixture(user.id, {
      membershipUserId: user.id,
      progressPosition: 1,
      postMilestonePosition: 1
    });

    repository.createComment(post.id, user.id, post.requiredMilestone, {
      body: "Visible comment"
    });
    repository.createComment(post.id, user.id, post.requiredMilestone, {
      body: "Hidden comment",
      status: "HIDDEN"
    });
    repository.createComment(post.id, user.id, post.requiredMilestone, {
      body: "Deleted comment",
      deletedAt: new Date()
    });

    const response = await request(app)
      .get(`/api/posts/${post.id}/comments`)
      .set("Cookie", await createSessionCookie(user))
      .expect(200);

    expect(response.body.comments).toHaveLength(1);
    expect(response.body.comments[0].body).toBe("Visible comment");
    expect(repository.countVisibleComments(post.id)).toBe(1);
  });
});

const createCommentsTestApp = (
  repository: AuthUsersRepository & CommentsRepository
) => {
  const app = express();
  const authService = createAuthService(repository);
  const authMiddleware = createAuthMiddleware(authService);
  const commentsService = createCommentsService(repository);
  const commentsController = createCommentsController(commentsService);

  app.use(requestIdMiddleware);
  app.use(express.json());
  app.use(cookieParser());
  app.use("/api/posts", createCommentsRouter(commentsController, authMiddleware));
  app.use(
    "/api/comments",
    createCommentReactionsRouter(commentsController, authMiddleware)
  );
  app.use(errorHandler);

  return app;
};

type StoredClub = {
  id: string;
  title: string;
  visibility: "PUBLIC" | "PRIVATE" | "INVITE_ONLY";
};

type StoredPost = CommentPostRecord & {
  status: "VISIBLE" | "HIDDEN";
  deletedAt: Date | null;
};

type StoredNotification = {
  id: string;
  userId: string;
  type: "POST_COMMENT" | "COMMENT_REPLY";
  safeText: string;
  clubId: string;
  postId: string;
  commentId: string;
  requiredMilestoneId: string;
  createdAt: Date;
};

class InMemoryCommentsRepository
  implements AuthUsersRepository, CommentsRepository
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
    revokedAt: Date | null;
  }> = [];
  readonly progressRows: Array<{
    userId: string;
    clubId: string;
    position: number | null;
    mode: ProgressMode;
  }> = [];
  readonly milestones: Array<CommentRecord["requiredMilestone"] & { clubId: string }> =
    [];
  readonly posts: StoredPost[] = [];
  readonly comments: Array<CommentRecord & { deletedAt: Date | null }> = [];
  readonly notifications: StoredNotification[] = [];
  readonly enqueuedCommentNotificationJobs: Array<{ commentId: string }> = [];
  readonly commentReactions: Array<{
    id: string;
    commentId: string;
    userId: string;
    emoji: CommentReactionEmoji;
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

  createPostFixture = (
    authorId: string,
    input: {
      clubVisibility?: StoredClub["visibility"];
      membershipUserId?: string;
      postDeletedAt?: Date | null;
      postMilestonePosition?: number;
      postStatus?: StoredPost["status"];
      progressPosition?: number | null;
    } = {}
  ) => {
    const club = {
      id: crypto.randomUUID(),
      title: "Fixture Story Club",
      visibility: input.clubVisibility ?? "PUBLIC"
    };
    const requiredMilestone = this.createMilestone(
      club.id,
      input.postMilestonePosition ?? 1
    );
    const post: StoredPost = {
      id: crypto.randomUUID(),
      clubId: club.id,
      authorId,
      requiredMilestone,
      status: input.postStatus ?? "VISIBLE",
      deletedAt: input.postDeletedAt ?? null,
      club: {
        title: club.title,
        visibility: club.visibility,
        currentUserRole: null,
        isCurrentUserBanned: false,
        progress: {
          mode: "STRICT",
          currentMilestonePosition: null
        }
      }
    };

    this.clubs.set(club.id, club);
    this.posts.push(post);

    if (input.membershipUserId) {
      this.createMembership(input.membershipUserId, club.id);
    }

    if (input.progressPosition !== undefined) {
      this.setProgress(authorId, club.id, input.progressPosition);
    }

    return post;
  };

  createMilestone = (clubId: string, position: number) => {
    const milestone = {
      id: crypto.randomUUID(),
      position,
      safeTitle: `Milestone ${position}`,
      clubId
    };

    this.milestones.push(milestone);

    return milestone;
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

  createBan = (userId: string, clubId: string) => {
    this.bans.push({
      userId,
      clubId,
      revokedAt: null
    });
  };

  revokeBans = (userId: string, clubId: string) => {
    for (const ban of this.bans) {
      if (ban.userId === userId && ban.clubId === clubId) {
        ban.revokedAt = new Date();
      }
    }
  };

  setProgress = (
    userId: string,
    clubId: string,
    position: number | null,
    mode: ProgressMode = "STRICT"
  ) => {
    const existingProgress = this.progressRows.find(
      (progress) => progress.userId === userId && progress.clubId === clubId
    );

    if (existingProgress) {
      existingProgress.position = position;
      existingProgress.mode = mode;
      return;
    }

    this.progressRows.push({
      userId,
      clubId,
      position,
      mode
    });
  };

  createComment = (
    postId: string,
    authorId: string,
    requiredMilestone: CommentRecord["requiredMilestone"],
    input: {
      body: string;
      deletedAt?: Date | null;
      parentId?: string | null;
      status?: CommentRecord["status"];
    }
  ) => {
    const author = this.findStoredUser(authorId);

    if (!author) {
      throw new Error("Comment fixture requires an existing author.");
    }

    const now = new Date(Date.UTC(2026, 0, 1, 12, this.comments.length));
    const comment = {
      id: crypto.randomUUID(),
      postId,
      parentId: input.parentId ?? null,
      status: input.status ?? "VISIBLE",
      body: input.body,
      author: {
        id: author.id,
        displayName: author.displayName,
        username: author.username
      },
      requiredMilestone,
      reactionCount: 0,
      reactions: emptyCommentReactions(),
      createdAt: now,
      updatedAt: now,
      deletedAt: input.deletedAt ?? null
    };

    this.comments.push(comment);

    return comment;
  };

  createCommentReaction = (
    commentId: string,
    userId: string,
    emoji: CommentReactionEmoji
  ) => {
    const reaction = {
      id: crypto.randomUUID(),
      commentId,
      userId,
      emoji
    };

    this.commentReactions.push(reaction);

    return reaction;
  };

  countVisibleComments = (postId: string) =>
    this.comments.filter(
      (comment) =>
        comment.postId === postId &&
        comment.status === "VISIBLE" &&
        comment.deletedAt === null
    ).length;

  findPostForComments = async (
    postId: string,
    userId: string
  ): Promise<CommentPostRecord | null> => {
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
      id: post.id,
      clubId: post.clubId,
      authorId: post.authorId,
      requiredMilestone: post.requiredMilestone,
      club: {
        title: club.title,
        visibility: club.visibility,
        currentUserRole: this.findMembership(userId, club.id)?.role ?? null,
        isCurrentUserBanned: this.hasActiveBan(userId, club.id),
        progress: {
          mode: progress?.mode ?? "STRICT",
          currentMilestonePosition: progress?.position ?? null
        }
      }
    };
  };

  findVisibleCommentForPost = async (
    commentId: string,
    postId: string
  ): Promise<CommentRecord | null> => {
    const comment = this.comments.find(
      (storedComment) =>
        storedComment.id === commentId &&
        storedComment.postId === postId &&
        storedComment.status === "VISIBLE" &&
        storedComment.deletedAt === null
    );

    return comment ? this.withCommentReactions(comment) : null;
  };

  findMilestoneForClub = async (milestoneId: string, clubId: string) =>
    this.milestones.find(
      (milestone) => milestone.id === milestoneId && milestone.clubId === clubId
    ) ?? null;

  listVisibleCommentsForPost = async (postId: string, userId: string) =>
    this.comments
      .filter(
        (comment) =>
          comment.postId === postId &&
          comment.status === "VISIBLE" &&
          comment.deletedAt === null
      )
      .sort(
        (firstComment, secondComment) =>
          firstComment.createdAt.getTime() - secondComment.createdAt.getTime() ||
          firstComment.id.localeCompare(secondComment.id)
      )
      .map((comment) => this.withCommentReactions(comment, userId));

  findVisibleCommentForReaction = async (
    commentId: string,
    userId: string
  ) => {
    const comment = this.comments.find(
      (storedComment) =>
        storedComment.id === commentId &&
        storedComment.status === "VISIBLE" &&
        storedComment.deletedAt === null
    );

    if (!comment) {
      return null;
    }

    const post = await this.findPostForComments(comment.postId, userId);

    if (!post) {
      return null;
    }

    return {
      comment: this.withCommentReactions(comment, userId),
      post
    };
  };

  createPostComment = async (
    postId: string,
    authorId: string,
    input: CreatePostCommentInput
  ): Promise<CommentRecord | null> => {
    const post = this.posts.find((storedPost) => storedPost.id === postId);
    const milestone = this.milestones.find(
      (storedMilestone) => storedMilestone.id === input.requiredMilestoneId
    );

    if (!post || !milestone) {
      return null;
    }

    if (input.parentId) {
      const parent = this.comments.find(
        (comment) =>
          comment.id === input.parentId &&
          comment.postId === postId &&
          comment.status === "VISIBLE" &&
          comment.deletedAt === null
      );

      if (!parent || parent.parentId !== null) {
        return null;
      }
    }

    const comment = this.createComment(postId, authorId, milestone, {
      body: input.body,
      parentId: input.parentId ?? null
    });

    this.enqueuedCommentNotificationJobs.push({
      commentId: comment.id
    });

    return comment;
  };

  toggleCommentReaction = async (
    commentId: string,
    userId: string,
    input: ToggleCommentReactionRequest
  ) => {
    const existingReactionIndex = this.commentReactions.findIndex(
      (reaction) =>
        reaction.commentId === commentId &&
        reaction.userId === userId &&
        reaction.emoji === input.emoji
    );

    if (existingReactionIndex >= 0) {
      this.commentReactions.splice(existingReactionIndex, 1);
    } else {
      this.createCommentReaction(commentId, userId, input.emoji);
    }

    return this.findVisibleCommentForReaction(commentId, userId);
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

  private hasActiveBan = (userId: string, clubId: string) =>
    this.bans.some(
      (ban) =>
        ban.userId === userId && ban.clubId === clubId && ban.revokedAt === null
    );

  private withCommentReactions = (
    comment: CommentRecord & { deletedAt: Date | null },
    userId?: string
  ): CommentRecord => {
    const reactions = commentReactionEmojis.map((emoji) => {
      const matchingReactions = this.commentReactions.filter(
        (reaction) => reaction.commentId === comment.id && reaction.emoji === emoji
      );

      return {
        emoji,
        count: matchingReactions.length,
        reactedByMe:
          userId !== undefined &&
          matchingReactions.some((reaction) => reaction.userId === userId)
      };
    });

    return {
      ...comment,
      reactionCount: reactions.reduce(
        (total, reaction) => total + reaction.count,
        0
      ),
      reactions
    };
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

const validCommentInput = () => ({
  body: "This is a spoiler-safe comment."
});

const emptyCommentReactions = () =>
  commentReactionEmojis.map((emoji) => ({
    emoji,
    count: 0,
    reactedByMe: false
  }));
