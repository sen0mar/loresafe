import type { Job } from "pg-boss";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  processCommentCreatedJob,
  processProgressUnlockedJob,
  runLoggedNotificationJob
} from "./notification-job-handlers.js";
import type {
  CommentNotificationSource,
  NotificationsJobsRepository,
  ProgressUnlockNotificationSource
} from "../modules/notifications/notifications.jobs.repository.js";
import type { CreateCommentNotificationInput } from "../modules/notifications/notifications.repository.js";

describe("notification job handlers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("processes comment notification jobs idempotently", async () => {
    const repository = new InMemoryNotificationsJobsRepository();
    const source = repository.createCommentSource({
      parentAuthorId: null
    });

    await processCommentCreatedJob({ commentId: source.commentId }, repository);
    await processCommentCreatedJob({ commentId: source.commentId }, repository);

    expect(repository.notifications).toHaveLength(1);
    expect(repository.notifications[0]).toMatchObject({
      userId: source.postAuthorId,
      type: "POST_COMMENT",
      eventKey: `comment-notification:POST_COMMENT:${source.postAuthorId}:${source.commentId}`,
      safeText: "New comment in Fixture Story Club",
      clubId: source.clubId,
      postId: source.postId,
      commentId: source.commentId,
      requiredMilestoneId: source.requiredMilestoneId
    });
  });

  it("creates reply notifications and skips self replies", async () => {
    const repository = new InMemoryNotificationsJobsRepository();
    const parentAuthorId = crypto.randomUUID();
    const replySource = repository.createCommentSource({
      parentAuthorId
    });
    const selfReplySource = repository.createCommentSource({
      commentAuthorId: parentAuthorId,
      parentAuthorId
    });

    await processCommentCreatedJob(
      { commentId: replySource.commentId },
      repository
    );
    await processCommentCreatedJob(
      { commentId: selfReplySource.commentId },
      repository
    );

    expect(repository.notifications).toHaveLength(1);
    expect(repository.notifications[0]).toMatchObject({
      userId: replySource.parentAuthorId,
      type: "COMMENT_REPLY",
      eventKey: `comment-notification:COMMENT_REPLY:${replySource.parentAuthorId}:${replySource.commentId}`,
      safeText: "New reply in Fixture Story Club"
    });
  });

  it("processes progress unlock jobs idempotently", async () => {
    const repository = new InMemoryNotificationsJobsRepository();
    const source = repository.createProgressSource({
      requiredMilestoneId: crypto.randomUUID()
    });

    await processProgressUnlockedJob(
      { progressHistoryId: source.progressHistoryId },
      repository
    );
    await processProgressUnlockedJob(
      { progressHistoryId: source.progressHistoryId },
      repository
    );

    expect(repository.notifications).toHaveLength(1);
    expect(repository.notifications[0]).toMatchObject({
      userId: source.userId,
      type: "PROGRESS_UNLOCK",
      eventKey: `progress-unlock:${source.userId}:${source.progressHistoryId}`,
      safeText: "New discussions unlocked in Fixture Story Club",
      clubId: source.clubId,
      postId: null,
      commentId: null,
      requiredMilestoneId: source.requiredMilestoneId
    });
  });

  it("does not create progress unlock notifications when nothing became newly safe", async () => {
    const repository = new InMemoryNotificationsJobsRepository();
    const source = repository.createProgressSource({
      requiredMilestoneId: null
    });

    await processProgressUnlockedJob(
      { progressHistoryId: source.progressHistoryId },
      repository
    );

    expect(repository.notifications).toHaveLength(0);
  });

  it("logs and rethrows failed jobs with sanitized metadata", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const job = {
      id: crypto.randomUUID(),
      name: "notifications.comment-created",
      data: {
        commentId: crypto.randomUUID()
      }
    } as Job<{ commentId: string }>;

    await expect(
      runLoggedNotificationJob(
        "notifications.comment-created",
        job,
        async () => {
          throw new Error("database unavailable");
        },
        job.data.commentId
      )
    ).rejects.toThrow("database unavailable");

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[pg-boss] notification job failed",
      {
        jobName: "notifications.comment-created",
        jobId: job.id,
        sourceId: job.data.commentId,
        error: "database unavailable"
      }
    );
  });
});

class InMemoryNotificationsJobsRepository
  implements NotificationsJobsRepository
{
  readonly commentSources = new Map<string, CommentNotificationSource>();
  readonly progressSources = new Map<string, ProgressUnlockNotificationSource>();
  readonly notifications: CreateCommentNotificationInput[] = [];

  findCommentNotificationSource = async (commentId: string) =>
    this.commentSources.get(commentId) ?? null;

  findProgressUnlockNotificationSource = async (progressHistoryId: string) =>
    this.progressSources.get(progressHistoryId) ?? null;

  createNotificationIfMissing = async (
    input: CreateCommentNotificationInput
  ) => {
    const existingNotification = this.notifications.find(
      (notification) => notification.eventKey === input.eventKey
    );

    if (existingNotification) {
      return {
        id: existingNotification.eventKey
      };
    }

    this.notifications.push(input);

    return {
      id: input.eventKey
    };
  };

  createCommentSource = (
    overrides: Partial<CommentNotificationSource> = {}
  ): CommentNotificationSource => {
    const source = {
      commentId: crypto.randomUUID(),
      commentAuthorId: crypto.randomUUID(),
      postId: crypto.randomUUID(),
      postAuthorId: crypto.randomUUID(),
      clubId: crypto.randomUUID(),
      clubTitle: "Fixture Story Club",
      parentAuthorId: null,
      requiredMilestoneId: crypto.randomUUID(),
      ...overrides
    };

    this.commentSources.set(source.commentId, source);

    return source;
  };

  createProgressSource = (
    overrides: Partial<ProgressUnlockNotificationSource> = {}
  ): ProgressUnlockNotificationSource => {
    const source = {
      progressHistoryId: crypto.randomUUID(),
      userId: crypto.randomUUID(),
      clubId: crypto.randomUUID(),
      clubTitle: "Fixture Story Club",
      requiredMilestoneId: crypto.randomUUID(),
      ...overrides
    };

    this.progressSources.set(source.progressHistoryId, source);

    return source;
  };
}
