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
  ClubPostRecord,
  ListClubPostsResult,
  PostsRepository
} from "./posts.repository.js";
import { createPostsRouter } from "./posts.routes.js";
import { createPostsService } from "./posts.service.js";
import type { ListClubPostsQuery } from "./posts.schema.js";

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

  it("validates and bounds pagination", async () => {
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

    await request(app)
      .get("/api/clubs/pagination-story-circle/posts?page=0&limit=20")
      .set("Cookie", await createSessionCookie(user))
      .expect(400);

    const response = await request(app)
      .get("/api/clubs/pagination-story-circle/posts?page=1&limit=1")
      .set("Cookie", await createSessionCookie(user))
      .expect(200);

    expect(response.body.posts).toHaveLength(1);
    expect(response.body.pagination).toEqual({
      page: 1,
      limit: 1,
      total: 2,
      pageCount: 2
    });
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
  readonly milestones: Array<ProgressMilestoneRecord & { clubId: string }> = [];
  readonly progressRows: StoredProgress[] = [];
  readonly history: StoredProgressHistory[] = [];
  readonly posts: Array<
    ClubPostRecord & { clubId: string; milestoneId: string }
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
    }
  ) => {
    const author = this.findStoredUser(authorId);
    const requiredMilestone = this.findMilestone(milestoneId);

    if (!author || !requiredMilestone) {
      throw new Error("Post fixture requires existing author and milestone.");
    }

    const now = new Date(Date.UTC(2026, 0, 1, 12, this.posts.length));
    const post = {
      id: crypto.randomUUID(),
      clubId,
      milestoneId,
      type: input.type ?? "DISCUSSION",
      status: "VISIBLE" as const,
      title: input.title,
      body: input.body,
      author: {
        id: author.id,
        displayName: author.displayName,
        username: author.username
      },
      requiredMilestone,
      createdAt: now,
      updatedAt: now
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

  listClubPosts = async (
    clubId: string,
    { page, limit }: ListClubPostsQuery
  ): Promise<ListClubPostsResult> => {
    const start = (page - 1) * limit;
    const visiblePosts = this.posts
      .filter((post) => post.clubId === clubId && post.status === "VISIBLE")
      .sort(
        (firstPost, secondPost) =>
          secondPost.createdAt.getTime() - firstPost.createdAt.getTime() ||
          firstPost.id.localeCompare(secondPost.id)
      );

    return {
      posts: visiblePosts.slice(start, start + limit),
      total: visiblePosts.length
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
