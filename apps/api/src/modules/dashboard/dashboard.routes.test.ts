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
import type { ClubPostRecord } from "../posts/posts.repository.js";
import type { ProgressMode } from "../progress/progress.schema.js";
import { createDashboardController } from "./dashboard.controller.js";
import { createDashboardRouter } from "./dashboard.routes.js";
import { createDashboardService } from "./dashboard.service.js";
import type {
  ClubDashboardStatsRecord,
  DashboardClubRecord,
  DashboardRepository,
  PopularDiscussionRecord,
  ProgressSummaryRecord,
  RecentlyUnlockedSummaryRecord
} from "./dashboard.repository.js";

describe("dashboard routes", () => {
  let repository: InMemoryDashboardRepository;
  let app: express.Express;

  beforeEach(() => {
    repository = new InMemoryDashboardRepository();
    app = createDashboardTestApp(repository);
  });

  it("rejects dashboard reads without an authenticated session", async () => {
    await request(app)
      .get("/api/clubs/public-story-circle/stats")
      .set("x-request-id", "dashboard-missing-session")
      .expect(401);
  });

  it("returns real club stats from visible records only", async () => {
    const user = repository.createStoredUser(validUserInput());
    const otherUser = repository.createStoredUser({
      ...validUserInput(),
      email: "other@example.com",
      displayName: "Other Reader"
    });
    const club = repository.createClub("stats-story-circle");
    const firstMilestone = repository.createMilestone(club.id, 1, "Opening");
    const secondMilestone = repository.createMilestone(club.id, 2, "Midpoint");
    const membership = repository.createMembership(user.id, club.id);
    repository.setProgress(user.id, club.id, firstMilestone.id, "STRICT");
    const safePost = repository.createPost(club.id, user.id, firstMilestone);
    const lockedPost = repository.createPost(club.id, user.id, secondMilestone);
    repository.createPost(club.id, otherUser.id, firstMilestone);
    repository.createPost(club.id, user.id, firstMilestone, {
      status: "HIDDEN"
    });
    repository.createPost(club.id, user.id, firstMilestone, {
      deletedAt: new Date()
    });
    repository.createComment(safePost.id, user.id);
    repository.createComment(lockedPost.id, user.id);
    repository.createComment(safePost.id, otherUser.id);
    repository.createComment(safePost.id, user.id, { status: "HIDDEN" });
    repository.createPostReaction(safePost.id, user.id, "👍");
    repository.createPostReaction(lockedPost.id, user.id, "❤️");

    const response = await request(app)
      .get("/api/clubs/stats-story-circle/stats")
      .set("Cookie", await createSessionCookie(user))
      .expect(200);

    expect(response.body.stats).toEqual({
      memberCount: 1,
      milestoneCount: 2,
      visiblePostCount: 3,
      visibleCommentCount: 3,
      postReactionCount: 2,
      safePostCount: 2,
      lockedPostCount: 1,
      viewer: {
        joinedAt: membership.createdAt.toISOString(),
        postCount: 2,
        commentCount: 2
      }
    });
  });

  it("treats finished progress as fully safe in stats", async () => {
    const user = repository.createStoredUser(validUserInput());
    const club = repository.createClub("finished-stats-story-circle");
    const milestone = repository.createMilestone(club.id, 1, "Opening");
    repository.createMembership(user.id, club.id);
    repository.setProgress(user.id, club.id, null, "FINISHED");
    repository.createPost(club.id, user.id, milestone);

    const response = await request(app)
      .get("/api/clubs/finished-stats-story-circle/stats")
      .set("Cookie", await createSessionCookie(user))
      .expect(200);

    expect(response.body.stats).toMatchObject({
      visiblePostCount: 1,
      safePostCount: 1,
      lockedPostCount: 0
    });
  });

  it("returns bounded popular discussions and keeps locked cards sanitized", async () => {
    const user = repository.createStoredUser(validUserInput());
    const club = repository.createClub("popular-story-circle");
    const firstMilestone = repository.createMilestone(club.id, 1, "Opening");
    const secondMilestone = repository.createMilestone(club.id, 2, "Midpoint");
    repository.createMembership(user.id, club.id);
    repository.setProgress(user.id, club.id, firstMilestone.id, "STRICT");
    const safePost = repository.createPost(club.id, user.id, firstMilestone, {
      title: "Safe popular title",
      body: "Safe popular body."
    });
    const lockedPost = repository.createPost(
      club.id,
      user.id,
      secondMilestone,
      {
        title: "UNSAFE_POPULAR_TITLE",
        body: "UNSAFE_POPULAR_BODY"
      }
    );
    repository.createComment(safePost.id, user.id);
    repository.createComment(lockedPost.id, user.id);
    repository.createPostReaction(lockedPost.id, user.id, "👍");

    const response = await request(app)
      .get("/api/clubs/popular-story-circle/popular-discussions?limit=1")
      .set("Cookie", await createSessionCookie(user))
      .expect(200);

    expect(response.body.discussions).toHaveLength(1);
    expect(response.body.discussions[0]).toMatchObject({
      engagementScore: 2,
      post: {
        visibility: "LOCKED",
        requiredMilestone: {
          position: 2,
          label: "Midpoint"
        }
      }
    });
    expect(response.body.discussions[0].post).not.toHaveProperty("title");
    expect(response.body.discussions[0].post).not.toHaveProperty("author");
    expect(JSON.stringify(response.body)).not.toContain("UNSAFE_POPULAR");
  });

  it("returns recently unlocked summaries without leaking future content", async () => {
    const user = repository.createStoredUser(validUserInput());
    const club = repository.createClub("unlock-summary-story-circle");
    const opening = repository.createMilestone(club.id, 1, "Opening");
    const middle = repository.createMilestone(club.id, 2, "Middle");
    const ending = repository.createMilestone(club.id, 3, "Ending");
    repository.createMembership(user.id, club.id);
    repository.setProgress(user.id, club.id, opening.id, "STRICT");
    repository.addProgressHistory(user.id, club.id, null, opening.id);
    repository.setProgress(user.id, club.id, middle.id, "STRICT");
    repository.addProgressHistory(user.id, club.id, opening.id, middle.id);
    repository.createPost(club.id, user.id, middle, {
      title: "Newly safe title",
      body: "Newly safe body."
    });
    repository.createPost(club.id, user.id, ending, {
      title: "UNSAFE_FUTURE_TITLE",
      body: "UNSAFE_FUTURE_BODY"
    });

    const response = await request(app)
      .get(
        "/api/clubs/unlock-summary-story-circle/recently-unlocked/summary?limit=3"
      )
      .set("Cookie", await createSessionCookie(user))
      .expect(200);

    expect(response.body.unlock).toMatchObject({
      fromPosition: 1,
      toPosition: 2
    });
    expect(response.body.posts).toHaveLength(1);
    expect(response.body.posts[0]).toMatchObject({
      visibility: "VISIBLE",
      title: "Newly safe title"
    });
    expect(JSON.stringify(response.body)).not.toContain("UNSAFE_FUTURE");
  });

  it("rejects private non-member reads and member-only progress summaries", async () => {
    const user = repository.createStoredUser(validUserInput());
    repository.createClub("private-dashboard-story", "PRIVATE");
    repository.createClub("public-dashboard-story");

    await request(app)
      .get("/api/clubs/private-dashboard-story/stats")
      .set("Cookie", await createSessionCookie(user))
      .expect(404);

    await request(app)
      .get("/api/clubs/public-dashboard-story/progress/summary")
      .set("Cookie", await createSessionCookie(user))
      .expect(403);
  });

  it("validates dashboard link names and bounded limits", async () => {
    const user = repository.createStoredUser(validUserInput());

    await request(app)
      .get("/api/clubs/Invalid Link Name/stats")
      .set("Cookie", await createSessionCookie(user))
      .expect(400);

    await request(app)
      .get("/api/clubs/public-story-circle/popular-discussions?limit=50")
      .set("Cookie", await createSessionCookie(user))
      .expect(400);

    await request(app)
      .get("/api/clubs/public-story-circle/recently-unlocked/summary?limit=50")
      .set("Cookie", await createSessionCookie(user))
      .expect(400);
  });
});

const createDashboardTestApp = (
  repository: AuthUsersRepository & DashboardRepository
) => {
  const app = express();
  const authService = createAuthService(repository);
  const authMiddleware = createAuthMiddleware(authService);
  const dashboardService = createDashboardService(
    repository,
    new FakeReadStorage()
  );
  const dashboardController = createDashboardController(dashboardService);

  app.use(requestIdMiddleware);
  app.use(express.json());
  app.use(cookieParser());
  app.use(
    "/api/clubs",
    createDashboardRouter(dashboardController, authMiddleware)
  );
  app.use(errorHandler);

  return app;
};

class FakeReadStorage implements Pick<ObjectStorage, "createPresignedRead"> {
  createPresignedRead = async (objectKey: string) => ({
    readUrl: `https://reads.example/${objectKey}`,
    expiresAt: new Date("2026-06-16T12:05:00.000Z")
  });
}

class InMemoryDashboardRepository
  implements AuthUsersRepository, DashboardRepository
{
  readonly usersByEmail = new Map<
    string,
    AuthUserRecord & { passwordHash: string }
  >();
  readonly clubs = new Map<string, StoredClub>();
  readonly memberships: StoredMembership[] = [];
  readonly milestones: StoredMilestone[] = [];
  readonly progressRows: StoredProgress[] = [];
  readonly historyRows: StoredProgressHistory[] = [];
  readonly posts: StoredPost[] = [];
  readonly comments: StoredComment[] = [];
  readonly postReactions: StoredPostReaction[] = [];

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
    linkName: string,
    visibility: StoredClub["visibility"] = "PUBLIC"
  ) => {
    const club = {
      id: crypto.randomUUID(),
      linkName,
      visibility
    };

    this.clubs.set(club.id, club);

    return club;
  };

  createMembership = (
    userId: string,
    clubId: string,
    role: StoredMembership["role"] = "MEMBER"
  ) => {
    const membership = {
      id: crypto.randomUUID(),
      userId,
      clubId,
      role,
      createdAt: new Date()
    };

    this.memberships.push(membership);

    return membership;
  };

  createMilestone = (clubId: string, position: number, safeTitle: string) => {
    const milestone = {
      id: crypto.randomUUID(),
      clubId,
      position,
      safeTitle
    };

    this.milestones.push(milestone);

    return milestone;
  };

  setProgress = (
    userId: string,
    clubId: string,
    currentMilestoneId: string | null,
    mode: ProgressMode
  ) => {
    const existing = this.progressRows.find(
      (progress) => progress.userId === userId && progress.clubId === clubId
    );
    const now = new Date();

    if (existing) {
      existing.currentMilestoneId = currentMilestoneId;
      existing.mode = mode;
      existing.updatedAt = now;
      return;
    }

    this.progressRows.push({
      id: crypto.randomUUID(),
      userId,
      clubId,
      currentMilestoneId,
      mode,
      updatedAt: now
    });
  };

  addProgressHistory = (
    userId: string,
    clubId: string,
    fromMilestoneId: string | null,
    toMilestoneId: string | null
  ) => {
    this.historyRows.unshift({
      id: crypto.randomUUID(),
      userId,
      clubId,
      fromMode: "STRICT",
      toMode: "STRICT",
      fromMilestoneId,
      toMilestoneId,
      createdAt: new Date()
    });
  };

  createPost = (
    clubId: string,
    authorId: string,
    requiredMilestone: StoredMilestone,
    input: Partial<StoredPost> = {}
  ) => {
    const now = input.createdAt ?? new Date();
    const post = {
      id: crypto.randomUUID(),
      clubId,
      authorId,
      type: "DISCUSSION" as const,
      status: input.status ?? "VISIBLE",
      title: input.title ?? "Post title",
      body: input.body ?? "Post body.",
      requiredMilestone,
      deletedAt: input.deletedAt ?? null,
      createdAt: now,
      updatedAt: now
    };

    this.posts.push(post);

    return post;
  };

  createComment = (
    postId: string,
    authorId: string,
    input: Partial<StoredComment> = {}
  ) => {
    this.comments.push({
      id: crypto.randomUUID(),
      postId,
      authorId,
      status: input.status ?? "VISIBLE",
      deletedAt: input.deletedAt ?? null
    });
  };

  createPostReaction = (
    postId: string,
    userId: string,
    emoji: StoredPostReaction["emoji"]
  ) => {
    this.postReactions.push({
      postId,
      userId,
      emoji
    });
  };

  findClubForDashboard = async (
    linkName: string,
    userId: string
  ): Promise<DashboardClubRecord | null> => {
    const club = [...this.clubs.values()].find(
      (storedClub) => storedClub.linkName === linkName
    );

    if (!club) {
      return null;
    }

    const progress = this.findProgress(userId, club.id);
    const currentMilestone = this.findMilestone(
      progress?.currentMilestoneId ?? null
    );

    return {
      id: club.id,
      visibility: club.visibility,
      currentUserRole: this.findMembership(userId, club.id)?.role ?? null,
      isCurrentUserBanned: false,
      progress: {
        mode: progress?.mode ?? "STRICT",
        currentMilestonePosition: currentMilestone?.position ?? null
      }
    };
  };

  getClubDashboardStats = async (
    userId: string,
    club: DashboardClubRecord
  ): Promise<ClubDashboardStatsRecord> => {
    const visiblePosts = this.visiblePostsForClub(club.id);
    const safePostCount =
      club.progress.mode === "FINISHED"
        ? visiblePosts.length
        : visiblePosts.filter(
            (post) =>
              post.requiredMilestone.position <=
              (club.progress.currentMilestonePosition ?? 0)
          ).length;
    const visiblePostIds = new Set(visiblePosts.map((post) => post.id));
    const viewerMembership = this.findMembership(userId, club.id);

    return {
      memberCount: this.memberships.filter(
        (membership) => membership.clubId === club.id
      ).length,
      milestoneCount: this.milestones.filter(
        (milestone) => milestone.clubId === club.id
      ).length,
      visiblePostCount: visiblePosts.length,
      visibleCommentCount: this.comments.filter(
        (comment) =>
          visiblePostIds.has(comment.postId) &&
          comment.status === "VISIBLE" &&
          !comment.deletedAt
      ).length,
      postReactionCount: this.postReactions.filter((reaction) =>
        visiblePostIds.has(reaction.postId)
      ).length,
      safePostCount,
      lockedPostCount: visiblePosts.length - safePostCount,
      viewer: {
        joinedAt: viewerMembership?.createdAt ?? null,
        postCount: visiblePosts.filter((post) => post.authorId === userId)
          .length,
        commentCount: this.comments.filter(
          (comment) =>
            comment.authorId === userId &&
            visiblePostIds.has(comment.postId) &&
            comment.status === "VISIBLE" &&
            !comment.deletedAt
        ).length
      }
    };
  };

  getPopularDiscussions = async (
    userId: string,
    clubId: string,
    limit: number
  ): Promise<PopularDiscussionRecord[]> => {
    const progress = this.findProgress(userId, clubId);
    const currentMilestone = this.findMilestone(
      progress?.currentMilestoneId ?? null
    );
    const membership = this.findMembership(userId, clubId);
    const rankedPosts = this.visiblePostsForClub(clubId)
      .map((post) => ({
        post,
        engagementScore:
          this.visibleCommentCount(post.id) +
          this.postReactions.filter((reaction) => reaction.postId === post.id)
            .length
      }))
      .sort(
        (first, second) =>
          second.engagementScore - first.engagementScore ||
          second.post.createdAt.getTime() - first.post.createdAt.getTime() ||
          first.post.id.localeCompare(second.post.id)
      )
      .slice(0, limit);

    return rankedPosts.map((rankedPost) => ({
      post: this.toPostRecord(rankedPost.post, userId),
      engagementScore: rankedPost.engagementScore,
      viewer: {
        mode: progress?.mode ?? "STRICT",
        currentMilestonePosition: currentMilestone?.position ?? null,
        currentUserRole: membership?.role ?? null
      }
    }));
  };

  getProgressSummary = async (
    userId: string,
    clubId: string
  ): Promise<ProgressSummaryRecord> => {
    const progress = this.findProgress(userId, clubId);

    return {
      mode: progress?.mode ?? "STRICT",
      currentMilestone: this.findMilestone(
        progress?.currentMilestoneId ?? null
      ),
      totalMilestones: this.milestones.filter(
        (milestone) => milestone.clubId === clubId
      ).length,
      updatedAt: progress?.updatedAt ?? null
    };
  };

  getRecentlyUnlockedSummary = async (
    userId: string,
    clubId: string,
    limit: number
  ): Promise<RecentlyUnlockedSummaryRecord> => {
    const progress = this.findProgress(userId, clubId);
    const currentMilestone = this.findMilestone(
      progress?.currentMilestoneId ?? null
    );
    const latestHistory = this.historyRows.find(
      (history) => history.userId === userId && history.clubId === clubId
    );
    const currentProgress = {
      mode: progress?.mode ?? "STRICT",
      currentMilestonePosition: currentMilestone?.position ?? null
    };

    if (!latestHistory) {
      return {
        unlock: {
          historyId: null,
          fromPosition: 0,
          toPosition: 0,
          unlockedAt: null
        },
        posts: [],
        currentProgress
      };
    }

    const fromPosition =
      this.findMilestone(latestHistory.fromMilestoneId)?.position ?? 0;
    const toPosition =
      this.findMilestone(latestHistory.toMilestoneId)?.position ?? 0;
    const currentPosition = currentMilestone?.position ?? 0;
    const effectiveToPosition =
      currentProgress.mode === "FINISHED"
        ? toPosition
        : Math.min(toPosition, currentPosition);
    const posts =
      effectiveToPosition <= fromPosition
        ? []
        : this.visiblePostsForClub(clubId)
            .filter(
              (post) =>
                post.requiredMilestone.position > fromPosition &&
                post.requiredMilestone.position <= effectiveToPosition
            )
            .slice(0, limit)
            .map((post) => this.toPostRecord(post, userId));

    return {
      unlock: {
        historyId: latestHistory.id,
        fromPosition,
        toPosition,
        unlockedAt: latestHistory.createdAt
      },
      posts,
      currentProgress
    };
  };

  private visiblePostsForClub = (clubId: string) =>
    this.posts.filter(
      (post) =>
        post.clubId === clubId && post.status === "VISIBLE" && !post.deletedAt
    );

  private visibleCommentCount = (postId: string) =>
    this.comments.filter(
      (comment) =>
        comment.postId === postId &&
        comment.status === "VISIBLE" &&
        !comment.deletedAt
    ).length;

  private findMembership = (userId: string, clubId: string) =>
    this.memberships.find(
      (membership) =>
        membership.userId === userId && membership.clubId === clubId
    );

  private findProgress = (userId: string, clubId: string) =>
    this.progressRows.find(
      (progress) => progress.userId === userId && progress.clubId === clubId
    );

  private findMilestone = (milestoneId: string | null) =>
    this.milestones.find((milestone) => milestone.id === milestoneId) ?? null;

  private toPostRecord = (post: StoredPost, userId: string): ClubPostRecord => {
    const reactions = ["👍", "❤️", "😂", "😮", "👀"].map((emoji) => {
      const postReactions = this.postReactions.filter(
        (reaction) => reaction.postId === post.id && reaction.emoji === emoji
      );

      return {
        emoji: emoji as StoredPostReaction["emoji"],
        count: postReactions.length,
        reactedByMe: postReactions.some(
          (reaction) => reaction.userId === userId
        )
      };
    });
    const author = [...this.usersByEmail.values()].find(
      (user) => user.id === post.authorId
    );

    return {
      id: post.id,
      type: post.type,
      status: post.status,
      title: post.title,
      body: post.body,
      author: {
        id: author?.id ?? post.authorId,
        displayName: author?.displayName ?? "Reader",
        username: author?.username ?? null
      },
      requiredMilestone: post.requiredMilestone,
      prediction: null,
      media: null,
      commentCount: this.visibleCommentCount(post.id),
      reactionCount: reactions.reduce(
        (total, reaction) => total + reaction.count,
        0
      ),
      reactions,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt
    };
  };
}

type StoredClub = {
  id: string;
  linkName: string;
  visibility: "PUBLIC" | "PRIVATE" | "INVITE_ONLY";
};

type StoredMembership = {
  id: string;
  userId: string;
  clubId: string;
  role: "OWNER" | "MODERATOR" | "MEMBER";
  createdAt: Date;
};

type StoredMilestone = {
  id: string;
  clubId: string;
  position: number;
  safeTitle: string;
};

type StoredProgress = {
  id: string;
  userId: string;
  clubId: string;
  currentMilestoneId: string | null;
  mode: ProgressMode;
  updatedAt: Date;
};

type StoredProgressHistory = {
  id: string;
  userId: string;
  clubId: string;
  fromMode: ProgressMode;
  toMode: ProgressMode;
  fromMilestoneId: string | null;
  toMilestoneId: string | null;
  createdAt: Date;
};

type StoredPost = {
  id: string;
  clubId: string;
  authorId: string;
  type: ClubPostRecord["type"];
  status: "VISIBLE" | "HIDDEN";
  title: string;
  body: string;
  requiredMilestone: StoredMilestone;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type StoredComment = {
  id: string;
  postId: string;
  authorId: string;
  status: "VISIBLE" | "HIDDEN";
  deletedAt: Date | null;
};

type StoredPostReaction = {
  postId: string;
  userId: string;
  emoji: "👍" | "❤️" | "😂" | "😮" | "👀";
};

const createSessionCookie = async (user: AuthUserRecord) => {
  const token = await createSessionToken({
    userId: user.id,
    sessionVersion: user.sessionVersion
  });

  return `${env.SESSION_COOKIE_NAME}=${token}`;
};

const validUserInput = (): CreateAuthUserInput => ({
  email: "reader@example.com",
  displayName: "Reader",
  passwordHash: "hashed-password"
});
