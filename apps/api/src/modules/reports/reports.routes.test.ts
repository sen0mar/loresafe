import cookieParser from "cookie-parser";
import express from "express";
import rateLimit from "express-rate-limit";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import { env } from "../../config/env.js";
import { HttpError } from "../../core/errors/http-error.js";
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
import { createReportsController } from "./reports.controller.js";
import type {
  ReportRecord,
  ReportsRepository,
  ReportTargetRecord
} from "./reports.repository.js";
import { createReportsRouter } from "./reports.routes.js";
import type { CreateReportRequest } from "./reports.schema.js";
import { createReportsService } from "./reports.service.js";

describe("reports routes", () => {
  let repository: InMemoryReportsRepository;
  let app: express.Express;

  beforeEach(() => {
    repository = new InMemoryReportsRepository();
    app = createReportsTestApp(repository);
  });

  it("rejects report creation without an authenticated session", async () => {
    const response = await request(app)
      .post("/api/reports")
      .set("x-request-id", "reports-missing-session")
      .send(validReportInput("POST", crypto.randomUUID()))
      .expect(401);

    expect(response.body).toEqual({
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required",
        requestId: "reports-missing-session"
      }
    });
  });

  it("validates report target, reason, and details", async () => {
    const user = repository.createStoredUser(validUserInput());

    await request(app)
      .post("/api/reports")
      .set("Cookie", await createSessionCookie(user))
      .send({
        targetType: "POST",
        targetId: "not-a-uuid",
        reason: "SPOILER"
      })
      .expect(400);

    await request(app)
      .post("/api/reports")
      .set("Cookie", await createSessionCookie(user))
      .send({
        targetType: "POST",
        targetId: crypto.randomUUID(),
        reason: "NOT_REAL",
        details: ""
      })
      .expect(400);
  });

  it("saves visible post reports with the correct target, club, reporter, reason, details, and status", async () => {
    const user = repository.createStoredUser(validUserInput());
    const post = repository.createPostFixture(user.id, {
      membershipUserId: user.id,
      progressPosition: 2,
      requiredMilestonePosition: 2
    });

    const response = await request(app)
      .post("/api/reports")
      .set("Cookie", await createSessionCookie(user))
      .send({
        targetType: "POST",
        targetId: post.id,
        reason: "SPOILER",
        details: "This belongs one milestone later."
      })
      .expect(201);

    expect(repository.reports).toHaveLength(1);
    expect(repository.reports[0]).toMatchObject({
      targetType: "POST",
      reason: "SPOILER",
      details: "This belongs one milestone later.",
      reporterId: user.id,
      clubId: post.clubId,
      postId: post.id,
      commentId: null,
      status: "OPEN"
    });
    expect(response.body.report).toMatchObject({
      targetType: "POST",
      targetId: post.id,
      reason: "SPOILER",
      details: "This belongs one milestone later.",
      status: "OPEN"
    });
    expect(JSON.stringify(response.body)).not.toContain("UNSAFE");
  });

  it("saves visible comment reports with the correct target, club, reporter, reason, details, and status", async () => {
    const user = repository.createStoredUser(validUserInput());
    const post = repository.createPostFixture(user.id, {
      membershipUserId: user.id,
      progressPosition: 2,
      requiredMilestonePosition: 1
    });
    const comment = repository.createCommentFixture(post.id, {
      requiredMilestonePosition: 2
    });

    const response = await request(app)
      .post("/api/reports")
      .set("Cookie", await createSessionCookie(user))
      .send({
        targetType: "COMMENT",
        targetId: comment.id,
        reason: "HARASSMENT",
        details: "Personal attack."
      })
      .expect(201);

    expect(repository.reports).toHaveLength(1);
    expect(repository.reports[0]).toMatchObject({
      targetType: "COMMENT",
      reason: "HARASSMENT",
      details: "Personal attack.",
      reporterId: user.id,
      clubId: post.clubId,
      postId: null,
      commentId: comment.id,
      status: "OPEN"
    });
    expect(response.body.report).toMatchObject({
      targetType: "COMMENT",
      targetId: comment.id,
      reason: "HARASSMENT",
      details: "Personal attack.",
      status: "OPEN"
    });
    expect(JSON.stringify(response.body)).not.toContain("UNSAFE");
  });

  it("returns the existing open report for duplicate post or comment reports", async () => {
    const user = repository.createStoredUser(validUserInput());
    const post = repository.createPostFixture(user.id, {
      membershipUserId: user.id,
      progressPosition: 1
    });
    const comment = repository.createCommentFixture(post.id);
    const cookie = await createSessionCookie(user);

    const firstPostReport = await request(app)
      .post("/api/reports")
      .set("Cookie", cookie)
      .send(validReportInput("POST", post.id))
      .expect(201);
    const secondPostReport = await request(app)
      .post("/api/reports")
      .set("Cookie", cookie)
      .send({
        ...validReportInput("POST", post.id),
        reason: "SPAM"
      })
      .expect(201);
    const firstCommentReport = await request(app)
      .post("/api/reports")
      .set("Cookie", cookie)
      .send(validReportInput("COMMENT", comment.id))
      .expect(201);
    const secondCommentReport = await request(app)
      .post("/api/reports")
      .set("Cookie", cookie)
      .send(validReportInput("COMMENT", comment.id))
      .expect(201);

    expect(repository.reports).toHaveLength(2);
    expect(secondPostReport.body.report.id).toBe(firstPostReport.body.report.id);
    expect(secondPostReport.body.report.reason).toBe("SPOILER");
    expect(secondCommentReport.body.report.id).toBe(
      firstCommentReport.body.report.id
    );
  });

  it("rejects hidden, deleted, inaccessible, and locked post reports without exposing target content", async () => {
    const user = repository.createStoredUser(validUserInput());
    const hiddenPost = repository.createPostFixture(user.id, {
      status: "HIDDEN",
      unsafeBody: "UNSAFE_HIDDEN_POST"
    });
    const deletedPost = repository.createPostFixture(user.id, {
      deletedAt: new Date(),
      unsafeBody: "UNSAFE_DELETED_POST"
    });
    const privatePost = repository.createPostFixture(user.id, {
      clubVisibility: "PRIVATE",
      unsafeBody: "UNSAFE_PRIVATE_POST"
    });
    const lockedPost = repository.createPostFixture(user.id, {
      membershipUserId: user.id,
      progressPosition: 1,
      requiredMilestonePosition: 2,
      unsafeBody: "UNSAFE_LOCKED_POST"
    });

    for (const postId of [
      hiddenPost.id,
      deletedPost.id,
      privatePost.id,
      lockedPost.id
    ]) {
      const response = await request(app)
        .post("/api/reports")
        .set("Cookie", await createSessionCookie(user))
        .send(validReportInput("POST", postId))
        .expect(404);

      expect(response.body.error).toMatchObject({
        code: "NOT_FOUND",
        message: "Target not found"
      });
      expect(JSON.stringify(response.body)).not.toContain("UNSAFE");
    }

    expect(repository.reports).toHaveLength(0);
  });

  it("rejects hidden, deleted, inaccessible, and locked comment reports without exposing target content", async () => {
    const user = repository.createStoredUser(validUserInput());
    const hiddenCommentPost = repository.createPostFixture(user.id, {
      membershipUserId: user.id,
      progressPosition: 2
    });
    const hiddenComment = repository.createCommentFixture(hiddenCommentPost.id, {
      status: "HIDDEN",
      unsafeBody: "UNSAFE_HIDDEN_COMMENT"
    });
    const deletedComment = repository.createCommentFixture(hiddenCommentPost.id, {
      deletedAt: new Date(),
      unsafeBody: "UNSAFE_DELETED_COMMENT"
    });
    const privatePost = repository.createPostFixture(user.id, {
      clubVisibility: "PRIVATE"
    });
    const privateComment = repository.createCommentFixture(privatePost.id, {
      unsafeBody: "UNSAFE_PRIVATE_COMMENT"
    });
    const lockedPost = repository.createPostFixture(user.id, {
      membershipUserId: user.id,
      progressPosition: 1,
      requiredMilestonePosition: 2
    });
    const lockedByPostComment = repository.createCommentFixture(lockedPost.id, {
      requiredMilestonePosition: 2,
      unsafeBody: "UNSAFE_LOCKED_POST_COMMENT"
    });
    const lockedCommentPost = repository.createPostFixture(user.id, {
      membershipUserId: user.id,
      progressPosition: 1,
      requiredMilestonePosition: 1
    });
    const lockedComment = repository.createCommentFixture(lockedCommentPost.id, {
      requiredMilestonePosition: 2,
      unsafeBody: "UNSAFE_LOCKED_COMMENT"
    });

    for (const commentId of [
      hiddenComment.id,
      deletedComment.id,
      privateComment.id,
      lockedByPostComment.id,
      lockedComment.id
    ]) {
      const response = await request(app)
        .post("/api/reports")
        .set("Cookie", await createSessionCookie(user))
        .send(validReportInput("COMMENT", commentId))
        .expect(404);

      expect(response.body.error).toMatchObject({
        code: "NOT_FOUND",
        message: "Target not found"
      });
      expect(JSON.stringify(response.body)).not.toContain("UNSAFE");
    }

    expect(repository.reports).toHaveLength(0);
  });

  it("rate-limits repeated report creation", async () => {
    const rateLimitedApp = createReportsTestApp(repository, {
      rateLimitReports: true
    });
    const user = repository.createStoredUser(validUserInput());
    const firstPost = repository.createPostFixture(user.id, {
      membershipUserId: user.id,
      progressPosition: 1
    });
    const secondPost = repository.createPostFixture(user.id, {
      membershipUserId: user.id,
      progressPosition: 1
    });
    const cookie = await createSessionCookie(user);

    await request(rateLimitedApp)
      .post("/api/reports")
      .set("Cookie", cookie)
      .send(validReportInput("POST", firstPost.id))
      .expect(201);

    const response = await request(rateLimitedApp)
      .post("/api/reports")
      .set("Cookie", cookie)
      .send(validReportInput("POST", secondPost.id))
      .expect(429);

    expect(response.body.error).toMatchObject({
      code: "TOO_MANY_REQUESTS",
      message: "Too many attempts. Try again later."
    });
  });
});

type StoredClub = {
  id: string;
  visibility: "PUBLIC" | "PRIVATE" | "INVITE_ONLY";
};

type StoredPost = {
  id: string;
  clubId: string;
  status: "VISIBLE" | "HIDDEN";
  deletedAt: Date | null;
  requiredMilestone: {
    position: number;
  };
  unsafeBody: string;
};

type StoredComment = {
  id: string;
  postId: string;
  status: "VISIBLE" | "HIDDEN";
  deletedAt: Date | null;
  requiredMilestone: {
    position: number;
  };
  unsafeBody: string;
};

class InMemoryReportsRepository implements AuthUsersRepository, ReportsRepository {
  readonly usersByEmail = new Map<
    string,
    AuthUserRecord & { passwordHash: string }
  >();
  readonly clubs = new Map<string, StoredClub>();
  readonly posts: StoredPost[] = [];
  readonly comments: StoredComment[] = [];
  readonly memberships: Array<{
    userId: string;
    clubId: string;
    role: "OWNER" | "MODERATOR" | "MEMBER";
  }> = [];
  readonly progressRows: Array<{
    userId: string;
    clubId: string;
    position: number | null;
    mode: ProgressMode;
  }> = [];
  readonly reports: Array<
    ReportRecord & {
      reporterId: string;
      clubId: string;
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

  createPostFixture = (
    userId: string,
    input: {
      clubVisibility?: StoredClub["visibility"];
      deletedAt?: Date | null;
      membershipUserId?: string;
      progressPosition?: number | null;
      requiredMilestonePosition?: number;
      status?: StoredPost["status"];
      unsafeBody?: string;
    } = {}
  ) => {
    const club = {
      id: crypto.randomUUID(),
      visibility: input.clubVisibility ?? "PUBLIC"
    };
    const post = {
      id: crypto.randomUUID(),
      clubId: club.id,
      status: input.status ?? "VISIBLE",
      deletedAt: input.deletedAt ?? null,
      requiredMilestone: {
        position: input.requiredMilestonePosition ?? 1
      },
      unsafeBody: input.unsafeBody ?? "UNSAFE_POST_BODY"
    };

    this.clubs.set(club.id, club);
    this.posts.push(post);

    if (input.membershipUserId) {
      this.createMembership(input.membershipUserId, club.id);
    }

    if (input.progressPosition !== undefined) {
      this.setProgress(userId, club.id, input.progressPosition);
    }

    return post;
  };

  createCommentFixture = (
    postId: string,
    input: {
      deletedAt?: Date | null;
      requiredMilestonePosition?: number;
      status?: StoredComment["status"];
      unsafeBody?: string;
    } = {}
  ) => {
    const comment = {
      id: crypto.randomUUID(),
      postId,
      status: input.status ?? "VISIBLE",
      deletedAt: input.deletedAt ?? null,
      requiredMilestone: {
        position: input.requiredMilestonePosition ?? 1
      },
      unsafeBody: input.unsafeBody ?? "UNSAFE_COMMENT_BODY"
    };

    this.comments.push(comment);

    return comment;
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

  setProgress = (
    userId: string,
    clubId: string,
    position: number | null,
    mode: ProgressMode = "STRICT"
  ) => {
    this.progressRows.push({
      userId,
      clubId,
      position,
      mode
    });
  };

  findPostTarget = async (postId: string, userId: string) => {
    const post = this.posts.find(
      (storedPost) =>
        storedPost.id === postId &&
        storedPost.status === "VISIBLE" &&
        storedPost.deletedAt === null
    );

    if (!post) {
      return null;
    }

    return this.toPostTarget(post, userId);
  };

  findCommentTarget = async (
    commentId: string,
    userId: string
  ): Promise<ReportTargetRecord | null> => {
    const comment = this.comments.find(
      (storedComment) =>
        storedComment.id === commentId &&
        storedComment.status === "VISIBLE" &&
        storedComment.deletedAt === null
    );
    const post = comment
      ? this.posts.find(
          (storedPost) =>
            storedPost.id === comment.postId &&
            storedPost.status === "VISIBLE" &&
            storedPost.deletedAt === null
        )
      : null;

    if (!comment || !post) {
      return null;
    }

    const target = this.toPostTarget(post, userId);

    return {
      ...target,
      targetType: "COMMENT" as const,
      targetId: comment.id,
      requiredMilestone: comment.requiredMilestone,
      postRequiredMilestone: post.requiredMilestone
    };
  };

  findOpenReportForTarget = async (
    reporterId: string,
    input: Pick<CreateReportRequest, "targetId" | "targetType">
  ) =>
    this.reports.find(
      (report) =>
        report.reporterId === reporterId &&
        report.status === "OPEN" &&
        (input.targetType === "POST"
          ? report.postId === input.targetId
          : report.commentId === input.targetId)
    ) ?? null;

  createReport = async (
    reporterId: string,
    target: ReportTargetRecord,
    input: CreateReportRequest
  ) => {
    const existingReport = await this.findOpenReportForTarget(
      reporterId,
      input
    );

    if (existingReport) {
      return existingReport;
    }

    const now = new Date(Date.UTC(2026, 0, 1, 12, this.reports.length));
    const report = {
      id: crypto.randomUUID(),
      targetType: input.targetType,
      reason: input.reason,
      details: input.details ?? null,
      status: "OPEN" as const,
      reporterId,
      clubId: target.clubId,
      postId: input.targetType === "POST" ? target.targetId : null,
      commentId: input.targetType === "COMMENT" ? target.targetId : null,
      createdAt: now,
      updatedAt: now
    };

    this.reports.push(report);

    return report;
  };

  private toPostTarget = (
    post: StoredPost,
    userId: string
  ): ReportTargetRecord => {
    const club = this.clubs.get(post.clubId);

    if (!club) {
      throw new Error("Post fixture requires a club.");
    }

    const membership = this.memberships.find(
      (row) => row.userId === userId && row.clubId === club.id
    );
    const progress = this.progressRows.find(
      (row) => row.userId === userId && row.clubId === club.id
    );

    return {
      targetType: "POST",
      targetId: post.id,
      clubId: post.clubId,
      requiredMilestone: post.requiredMilestone,
      club: {
        visibility: club.visibility,
        currentUserRole: membership?.role ?? null,
        progress: {
          mode: progress?.mode ?? "STRICT",
          currentMilestonePosition: progress?.position ?? null
        }
      }
    };
  };
}

const createReportsTestApp = (
  repository: InMemoryReportsRepository,
  options: { rateLimitReports?: boolean } = {}
) => {
  const app = express();
  const authService = createAuthService(repository);
  const authMiddleware = createAuthMiddleware(authService);
  const reportsService = createReportsService(repository);
  const reportsController = createReportsController(reportsService);

  app.disable("x-powered-by");
  app.set("trust proxy", env.TRUST_PROXY_HOPS);
  app.use(requestIdMiddleware);

  if (options.rateLimitReports) {
    app.post(
      "/api/reports",
      rateLimit({
        windowMs: 10 * 60 * 1000,
        limit: 1,
        standardHeaders: "draft-8",
        legacyHeaders: false,
        identifier: "reports-create-test",
        handler: (_req, _res, next) => {
          next(
            new HttpError(
              429,
              "TOO_MANY_REQUESTS",
              "Too many attempts. Try again later."
            )
          );
        }
      })
    );
  }

  app.use(express.json());
  app.use(cookieParser());
  app.use(
    "/api/reports",
    createReportsRouter(reportsController, authMiddleware)
  );
  app.use(errorHandler);

  return app;
};

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

const validReportInput = (
  targetType: CreateReportRequest["targetType"],
  targetId: string
) => ({
  targetType,
  targetId,
  reason: "SPOILER"
});
