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
import {
  eventsService,
  type EventsService
} from "../modules/events/events.service.js";

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
  repository: NotificationsJobsRepository = notificationsJobsRepository,
  eventPublisher: EventsService = eventsService
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
          () => processCommentCreatedJob(job.data, repository, eventPublisher),
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
          () =>
            processProgressUnlockedJob(job.data, repository, eventPublisher),
          job.data.progressHistoryId
        );
      }
    )
  ]);
};

export const processCommentCreatedJob = async (
  data: unknown,
  repository: NotificationsJobsRepository = notificationsJobsRepository,
  eventPublisher: EventsService = eventsService
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

  const notification = await repository.createNotificationIfMissing({
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

  if (notification.wasCreated) {
    eventPublisher.publishNotificationCreated(notification.userId, {
      notificationId: notification.id,
      club: notification.club,
      postId: notification.postId,
      commentId: notification.commentId,
      occurredAt: notification.createdAt.toISOString()
    });
  }
};

export const processProgressUnlockedJob = async (
  data: unknown,
  repository: NotificationsJobsRepository = notificationsJobsRepository,
  eventPublisher: EventsService = eventsService
) => {
  const payload = progressUnlockedJobSchema.parse(data);
  const source = await repository.findProgressUnlockNotificationSource(
    payload.progressHistoryId
  );

  if (!source?.requiredMilestoneId) {
    return;
  }

  const notification = await repository.createNotificationIfMissing({
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

  if (notification.wasCreated) {
    eventPublisher.publishNotificationCreated(notification.userId, {
      notificationId: notification.id,
      club: notification.club,
      postId: notification.postId,
      commentId: notification.commentId,
      occurredAt: notification.createdAt.toISOString()
    });
  }
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
