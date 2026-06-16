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
  ListModerationReportsResult,
  ModerationClubAccessRecord,
  ModerationReportRecord,
  ModerationReportsCursor,
  ReportRecord,
  ReportsRepository,
  ReportTargetRecord
} from "./reports.repository.js";
import {
  createClubReportsRouter,
  createReportsRouter
} from "./reports.routes.js";
import type {
  CreateReportRequest,
  ModerationReportStatus
} from "./reports.schema.js";
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

  it("rejects moderation queue reads and reveals without an authenticated session", async () => {
    const response = await request(app)
      .get("/api/clubs/mistborn/moderation/reports")
      .set("x-request-id", "reports-queue-missing-session")
      .expect(401);

    expect(response.body).toEqual({
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required",
        requestId: "reports-queue-missing-session"
      }
    });

    await request(app)
      .post(
        `/api/clubs/mistborn/moderation/reports/${crypto.randomUUID()}/reveal`
      )
      .expect(401);
  });

  it("rejects regular members from the moderation queue", async () => {
    const reporter = repository.createStoredUser(validUserInput());
    const member = repository.createStoredUser({
      ...validUserInput(),
      email: "member@example.com"
    });
    const post = repository.createPostFixture(reporter.id, {
      membershipUserId: reporter.id,
      progressPosition: 1
    });
    const club = repository.clubs.get(post.clubId);

    if (!club) {
      throw new Error("Expected post fixture to create a club.");
    }

    repository.createMembership(member.id, post.clubId, "MEMBER");
    await repository.createReport(
      reporter.id,
      await repository.findPostTarget(post.id, reporter.id) as ReportTargetRecord,
      {
        targetType: "POST",
        targetId: post.id,
        reason: "SPOILER",
        details: "UNSAFE_REPORT_DETAILS"
      }
    );

    const response = await request(app)
      .get(`/api/clubs/${club.slug}/moderation/reports`)
      .set("Cookie", await createSessionCookie(member))
      .expect(403);

    expect(response.body.error).toMatchObject({
      code: "FORBIDDEN",
      message: "Only club owners and moderators can review reports."
    });
    expect(JSON.stringify(response.body)).not.toContain("UNSAFE");
  });

  it.each(["OWNER", "MODERATOR"] as const)(
    "lets %s users list safe open report metadata for their club",
    async (role) => {
      const reporter = repository.createStoredUser(validUserInput());
      const moderator = repository.createStoredUser({
        ...validUserInput(),
        email: `${role.toLowerCase()}@example.com`,
        displayName: role
      });
      const post = repository.createPostFixture(reporter.id, {
        membershipUserId: reporter.id,
        progressPosition: 1,
        requiredMilestonePosition: 3,
        unsafeTitle: "UNSAFE_POST_TITLE",
        unsafeBody: "UNSAFE_POST_BODY"
      });
      const comment = repository.createCommentFixture(post.id, {
        authorId: reporter.id,
        requiredMilestonePosition: 4,
        unsafeBody: "UNSAFE_COMMENT_BODY"
      });
      const club = repository.clubs.get(post.clubId);

      if (!club) {
        throw new Error("Expected post fixture to create a club.");
      }

      repository.createMembership(moderator.id, post.clubId, role);

      await repository.createReport(
        reporter.id,
        await repository.findPostTarget(post.id, reporter.id) as ReportTargetRecord,
        {
          targetType: "POST",
          targetId: post.id,
          reason: "SPOILER",
          details: "UNSAFE_POST_DETAILS"
        }
      );
      await repository.createReport(
        reporter.id,
        await repository.findCommentTarget(comment.id, reporter.id) as ReportTargetRecord,
        {
          targetType: "COMMENT",
          targetId: comment.id,
          reason: "HARASSMENT",
          details: "UNSAFE_COMMENT_DETAILS"
        }
      );

      const response = await request(app)
        .get(`/api/clubs/${club.slug}/moderation/reports`)
        .set("Cookie", await createSessionCookie(moderator))
        .expect(200);

      expect(response.body.reports).toHaveLength(2);
      expect(response.body.reports[0]).toMatchObject({
        reason: "HARASSMENT",
        status: "OPEN",
        detailsHidden: true,
        reporter: {
          id: reporter.id,
          displayName: reporter.displayName,
          username: null
        },
        target: {
          targetType: "COMMENT",
          visibility: "HIDDEN",
          status: "VISIBLE",
          author: {
            id: reporter.id
          },
          requiredMilestone: {
            position: 4,
            label: "Milestone 4"
          },
          contentHidden: true
        }
      });
      expect(response.body.pagination).toMatchObject({
        limit: 20,
        hasMore: false,
        nextCursor: null
      });
      expect(JSON.stringify(response.body)).not.toContain("UNSAFE");
    }
  );

  it("keeps moderators scoped to reports from their own club", async () => {
    const reporter = repository.createStoredUser(validUserInput());
    const moderator = repository.createStoredUser({
      ...validUserInput(),
      email: "moderator@example.com"
    });
    const ownPost = repository.createPostFixture(reporter.id, {
      membershipUserId: reporter.id,
      progressPosition: 1
    });
    const otherPost = repository.createPostFixture(reporter.id, {
      membershipUserId: reporter.id,
      progressPosition: 1,
      unsafeBody: "UNSAFE_OTHER_CLUB_BODY"
    });
    const ownClub = repository.clubs.get(ownPost.clubId);

    if (!ownClub) {
      throw new Error("Expected post fixture to create a club.");
    }

    repository.createMembership(moderator.id, ownPost.clubId, "MODERATOR");

    const otherReport = await repository.createReport(
      reporter.id,
      await repository.findPostTarget(otherPost.id, reporter.id) as ReportTargetRecord,
      validReportInput("POST", otherPost.id)
    );

    const listResponse = await request(app)
      .get(`/api/clubs/${ownClub.slug}/moderation/reports`)
      .set("Cookie", await createSessionCookie(moderator))
      .expect(200);

    expect(listResponse.body.reports).toHaveLength(0);

    const revealResponse = await request(app)
      .post(
        `/api/clubs/${ownClub.slug}/moderation/reports/${otherReport.id}/reveal`
      )
      .set("Cookie", await createSessionCookie(moderator))
      .expect(404);

    expect(revealResponse.body.error).toMatchObject({
      code: "NOT_FOUND",
      message: "Report not found"
    });
    expect(JSON.stringify(revealResponse.body)).not.toContain("UNSAFE");
  });

  it("reveals reported content and report details only after explicit moderator reveal", async () => {
    const reporter = repository.createStoredUser(validUserInput());
    const moderator = repository.createStoredUser({
      ...validUserInput(),
      email: "moderator@example.com"
    });
    const post = repository.createPostFixture(reporter.id, {
      membershipUserId: reporter.id,
      progressPosition: 1,
      unsafeTitle: "UNSAFE_POST_TITLE",
      unsafeBody: "UNSAFE_POST_BODY"
    });
    const club = repository.clubs.get(post.clubId);

    if (!club) {
      throw new Error("Expected post fixture to create a club.");
    }

    repository.createMembership(moderator.id, post.clubId, "MODERATOR");
    const report = await repository.createReport(
      reporter.id,
      await repository.findPostTarget(post.id, reporter.id) as ReportTargetRecord,
      {
        targetType: "POST",
        targetId: post.id,
        reason: "SPOILER",
        details: "UNSAFE_REPORT_DETAILS"
      }
    );

    const safeResponse = await request(app)
      .get(`/api/clubs/${club.slug}/moderation/reports`)
      .set("Cookie", await createSessionCookie(moderator))
      .expect(200);

    expect(JSON.stringify(safeResponse.body)).not.toContain("UNSAFE");

    const revealResponse = await request(app)
      .post(`/api/clubs/${club.slug}/moderation/reports/${report.id}/reveal`)
      .set("Cookie", await createSessionCookie(moderator))
      .expect(200);

    expect(revealResponse.body.report).toMatchObject({
      id: report.id,
      details: "UNSAFE_REPORT_DETAILS",
      target: {
        visibility: "REVEALED",
        targetType: "POST",
        title: "UNSAFE_POST_TITLE",
        body: "UNSAFE_POST_BODY"
      }
    });
  });

  it("safely shapes hidden and deleted targets in the queue until reveal", async () => {
    const reporter = repository.createStoredUser(validUserInput());
    const moderator = repository.createStoredUser({
      ...validUserInput(),
      email: "moderator@example.com"
    });
    const hiddenPost = repository.createPostFixture(reporter.id, {
      membershipUserId: reporter.id,
      progressPosition: 1,
      unsafeTitle: "UNSAFE_HIDDEN_TITLE",
      unsafeBody: "UNSAFE_HIDDEN_BODY"
    });
    const deletedPost = repository.createPostFixture(reporter.id, {
      clubId: hiddenPost.clubId,
      deletedAt: new Date(),
      membershipUserId: reporter.id,
      progressPosition: 1,
      unsafeTitle: "UNSAFE_DELETED_TITLE",
      unsafeBody: "UNSAFE_DELETED_BODY"
    });
    const club = repository.clubs.get(hiddenPost.clubId);

    if (!club) {
      throw new Error("Expected post fixture to create a club.");
    }

    repository.createMembership(moderator.id, hiddenPost.clubId, "MODERATOR");

    const hiddenTarget = await repository.findPostTarget(
      hiddenPost.id,
      reporter.id
    ) as ReportTargetRecord;
    await repository.createReport(reporter.id, hiddenTarget, {
      targetType: "POST",
      targetId: hiddenPost.id,
      reason: "SPAM"
    });
    hiddenPost.status = "HIDDEN";

    const deletedReport = {
      ...(await repository.createReport(reporter.id, {
        ...hiddenTarget,
        targetId: deletedPost.id
      }, {
        targetType: "POST",
        targetId: deletedPost.id,
        reason: "OTHER",
        details: "UNSAFE_DELETED_DETAILS"
      }))
    };

    const response = await request(app)
      .get(`/api/clubs/${club.slug}/moderation/reports`)
      .set("Cookie", await createSessionCookie(moderator))
      .expect(200);

    expect(response.body.reports).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          targetId: hiddenPost.id,
          target: expect.objectContaining({
            status: "HIDDEN",
            visibility: "HIDDEN",
            contentHidden: true
          })
        }),
        expect.objectContaining({
          id: deletedReport.id,
          target: expect.objectContaining({
            status: "DELETED",
            visibility: "HIDDEN",
            contentHidden: true
          })
        })
      ])
    );
    expect(JSON.stringify(response.body)).not.toContain("UNSAFE");
  });
});

type StoredClub = {
  id: string;
  slug: string;
  visibility: "PUBLIC" | "PRIVATE" | "INVITE_ONLY";
};

type StoredPost = {
  id: string;
  clubId: string;
  authorId: string;
  status: "VISIBLE" | "HIDDEN";
  deletedAt: Date | null;
  requiredMilestone: {
    id: string;
    position: number;
    safeTitle: string;
  };
  unsafeTitle: string;
  unsafeBody: string;
};

type StoredComment = {
  id: string;
  postId: string;
  authorId: string;
  status: "VISIBLE" | "HIDDEN";
  deletedAt: Date | null;
  requiredMilestone: {
    id: string;
    position: number;
    safeTitle: string;
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
      clubId?: string;
      clubVisibility?: StoredClub["visibility"];
      deletedAt?: Date | null;
      membershipUserId?: string;
      progressPosition?: number | null;
      requiredMilestonePosition?: number;
      status?: StoredPost["status"];
      unsafeTitle?: string;
      unsafeBody?: string;
    } = {}
  ) => {
    const club =
      (input.clubId ? this.clubs.get(input.clubId) : null) ??
      ({
        id: input.clubId ?? crypto.randomUUID(),
        slug: `club-${this.clubs.size + 1}`,
        visibility: input.clubVisibility ?? "PUBLIC"
      } satisfies StoredClub);
    const post = {
      id: crypto.randomUUID(),
      clubId: club.id,
      authorId: userId,
      status: input.status ?? "VISIBLE",
      deletedAt: input.deletedAt ?? null,
      requiredMilestone: {
        id: crypto.randomUUID(),
        position: input.requiredMilestonePosition ?? 1,
        safeTitle: `Milestone ${input.requiredMilestonePosition ?? 1}`
      },
      unsafeTitle: input.unsafeTitle ?? "UNSAFE_POST_TITLE",
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
      authorId?: string;
      deletedAt?: Date | null;
      requiredMilestonePosition?: number;
      status?: StoredComment["status"];
      unsafeBody?: string;
    } = {}
  ) => {
    const comment = {
      id: crypto.randomUUID(),
      postId,
      authorId: input.authorId ?? crypto.randomUUID(),
      status: input.status ?? "VISIBLE",
      deletedAt: input.deletedAt ?? null,
      requiredMilestone: {
        id: crypto.randomUUID(),
        position: input.requiredMilestonePosition ?? 1,
        safeTitle: `Milestone ${input.requiredMilestonePosition ?? 1}`
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

  findClubAccessBySlug = async (
    slug: string,
    userId: string
  ): Promise<ModerationClubAccessRecord | null> => {
    const club = [...this.clubs.values()].find(
      (storedClub) => storedClub.slug === slug
    );

    if (!club) {
      return null;
    }

    const membership = this.memberships.find(
      (row) => row.userId === userId && row.clubId === club.id
    );

    return {
      id: club.id,
      visibility: club.visibility,
      currentUserRole: membership?.role ?? null
    };
  };

  listModerationReports = async (
    clubId: string,
    input: {
      status: ModerationReportStatus;
      cursor: ModerationReportsCursor | null;
      limit: number;
    }
  ): Promise<ListModerationReportsResult> => {
    const reports = this.reports
      .filter((report) => report.clubId === clubId && report.status === input.status)
      .filter((report) =>
        input.cursor
          ? report.createdAt < input.cursor.createdAt ||
            (report.createdAt.getTime() === input.cursor.createdAt.getTime() &&
              report.id > input.cursor.id)
          : true
      )
      .sort((left, right) => {
        const createdAtSort = right.createdAt.getTime() - left.createdAt.getTime();

        return createdAtSort || left.id.localeCompare(right.id);
      });
    const pageReports = reports.slice(0, input.limit);
    const lastReport = pageReports[pageReports.length - 1];

    return {
      reports: pageReports.map((report) => this.toModerationReportRecord(report)),
      nextCursor:
        reports.length > input.limit && lastReport
          ? {
              createdAt: lastReport.createdAt,
              id: lastReport.id
            }
          : null,
      hasMore: reports.length > input.limit
    };
  };

  findModerationReportById = async (
    clubId: string,
    reportId: string
  ): Promise<ModerationReportRecord | null> => {
    const report = this.reports.find(
      (storedReport) =>
        storedReport.clubId === clubId && storedReport.id === reportId
    );

    return report ? this.toModerationReportRecord(report) : null;
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

  private toModerationReportRecord = (
    report: ReportRecord & {
      reporterId: string;
      clubId: string;
    }
  ): ModerationReportRecord => {
    const reporter = this.findUserProfile(report.reporterId);
    const post = report.postId
      ? this.posts.find((storedPost) => storedPost.id === report.postId)
      : null;
    const comment = report.commentId
      ? this.comments.find(
          (storedComment) => storedComment.id === report.commentId
        )
      : null;

    if (!reporter) {
      throw new Error("Report fixture requires a reporter.");
    }

    return {
      ...report,
      reporter,
      target: post
        ? {
            targetType: "POST",
            id: post.id,
            status: post.status,
            deletedAt: post.deletedAt,
            title: post.unsafeTitle,
            body: post.unsafeBody,
            author: this.findUserProfile(post.authorId) ?? {
              id: post.authorId,
              displayName: "Unknown user",
              username: null
            },
            requiredMilestone: post.requiredMilestone
          }
        : comment
          ? {
              targetType: "COMMENT",
              id: comment.id,
              status: comment.status,
              deletedAt: comment.deletedAt,
              body: comment.unsafeBody,
              author: this.findUserProfile(comment.authorId) ?? {
                id: comment.authorId,
                displayName: "Unknown user",
                username: null
              },
              requiredMilestone: comment.requiredMilestone
            }
          : null
    };
  };

  private findUserProfile = (userId: string) => {
    for (const user of this.usersByEmail.values()) {
      if (user.id === userId) {
        return {
          id: user.id,
          displayName: user.displayName,
          username: user.username
        };
      }
    }

    return null;
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
  app.use(
    "/api/clubs",
    createClubReportsRouter(reportsController, authMiddleware)
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
  reason: "SPOILER" as const
});
