import type { Job } from "pg-boss";
import { z } from "zod";

import {
  notificationBoss,
  notificationJobNames
} from "./notification-job-queue.js";
import {
  getCommentNotificationEventKey,
  getProgressUnlockNotificationEventKey,
  notificationsJobsRepository,
  type NotificationsJobsRepository
} from "../modules/notifications/notifications.jobs.repository.js";

const commentCreatedJobSchema = z
  .object({
    commentId: z.uuid()
  })
  .strict();

const progressUnlockedJobSchema = z
  .object({
    progressHistoryId: z.uuid()
  })
  .strict();

type CommentCreatedJob = z.infer<typeof commentCreatedJobSchema>;
type ProgressUnlockedJob = z.infer<typeof progressUnlockedJobSchema>;

export const registerNotificationJobHandlers = async (
  repository: NotificationsJobsRepository = notificationsJobsRepository
) => {
  await Promise.all([
    notificationBoss.work<CommentCreatedJob>(
      notificationJobNames.commentCreated,
      {
        batchSize: 1,
        localConcurrency: 2,
        pollingIntervalSeconds: 1
      },
      async ([job]) => {
        if (!job) {
          return;
        }

        await runLoggedNotificationJob(
          notificationJobNames.commentCreated,
          job,
          () => processCommentCreatedJob(job.data, repository),
          job.data.commentId
        );
      }
    ),
    notificationBoss.work<ProgressUnlockedJob>(
      notificationJobNames.progressUnlocked,
      {
        batchSize: 1,
        localConcurrency: 2,
        pollingIntervalSeconds: 1
      },
      async ([job]) => {
        if (!job) {
          return;
        }

        await runLoggedNotificationJob(
          notificationJobNames.progressUnlocked,
          job,
          () => processProgressUnlockedJob(job.data, repository),
          job.data.progressHistoryId
        );
      }
    )
  ]);
};

export const processCommentCreatedJob = async (
  data: unknown,
  repository: NotificationsJobsRepository = notificationsJobsRepository
) => {
  const payload = commentCreatedJobSchema.parse(data);
  const source = await repository.findCommentNotificationSource(
    payload.commentId
  );

  if (!source) {
    return;
  }

  const recipientUserId = source.parentAuthorId ?? source.postAuthorId;
  const type = source.parentAuthorId ? "COMMENT_REPLY" : "POST_COMMENT";

  if (recipientUserId === source.commentAuthorId) {
    return;
  }

  await repository.createNotificationIfMissing({
    userId: recipientUserId,
    type,
    eventKey: getCommentNotificationEventKey({
      commentId: source.commentId,
      recipientUserId,
      type
    }),
    safeText:
      type === "COMMENT_REPLY"
        ? `New reply in ${source.clubTitle}`
        : `New comment in ${source.clubTitle}`,
    clubId: source.clubId,
    postId: source.postId,
    commentId: source.commentId,
    requiredMilestoneId: source.requiredMilestoneId
  });
};

export const processProgressUnlockedJob = async (
  data: unknown,
  repository: NotificationsJobsRepository = notificationsJobsRepository
) => {
  const payload = progressUnlockedJobSchema.parse(data);
  const source = await repository.findProgressUnlockNotificationSource(
    payload.progressHistoryId
  );

  if (!source?.requiredMilestoneId) {
    return;
  }

  await repository.createNotificationIfMissing({
    userId: source.userId,
    type: "PROGRESS_UNLOCK",
    eventKey: getProgressUnlockNotificationEventKey({
      progressHistoryId: source.progressHistoryId,
      userId: source.userId
    }),
    safeText: `New discussions unlocked in ${source.clubTitle}`,
    clubId: source.clubId,
    postId: null,
    commentId: null,
    requiredMilestoneId: source.requiredMilestoneId
  });
};

export const runLoggedNotificationJob = async (
  jobName: string,
  job: Job,
  handler: () => Promise<void>,
  sourceId: string
) => {
  try {
    await handler();
  } catch (error) {
    console.error("[pg-boss] notification job failed", {
      jobName,
      jobId: job.id,
      sourceId,
      error: sanitizeErrorMessage(error)
    });
    throw error;
  }
};

const sanitizeErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);
