import { fromPrisma, PgBoss, type PrismaTransactionLike } from "pg-boss";

import { env } from "../config/env.js";
import { logger, sanitizeError } from "../core/logging/logger.js";

export const notificationJobNames = {
  commentCreated: "notifications.comment-created",
  progressUnlocked: "notifications.progress-unlocked"
} as const;

export const storageJobNames = {
  objectDelete: "storage.object-delete"
} as const;

type NotificationJobName =
  (typeof notificationJobNames)[keyof typeof notificationJobNames];
type StorageJobName = (typeof storageJobNames)[keyof typeof storageJobNames];

type TransactionLike = PrismaTransactionLike | undefined;

const notificationJobOptions = {
  retryLimit: 3,
  retryDelay: 2,
  retryBackoff: true,
  expireInSeconds: 60,
  retentionSeconds: 60 * 60 * 24 * 7,
  deleteAfterSeconds: 60 * 60 * 24
} as const;

export const notificationBoss = new PgBoss({
  connectionString: env.DATABASE_URL,
  application_name: "loresafe-api-jobs"
});

notificationBoss.on("error", (error) => {
  logger.error("pg-boss error", {
    error: sanitizeError(error)
  });
});

notificationBoss.on("warning", ({ message, data }) => {
  logger.warn("pg-boss warning", {
    message,
    data
  });
});

export const startNotificationJobQueue = async () => {
  await notificationBoss.start();
  const queueNames = [
    ...Object.values(notificationJobNames),
    ...Object.values(storageJobNames)
  ];

  await Promise.all(
    queueNames.map((name) =>
      notificationBoss.createQueue(name, notificationJobOptions)
    )
  );
};

export const stopNotificationJobQueue = () =>
  notificationBoss.stop({
    graceful: true,
    timeout: 10_000
  });

export const enqueueCommentCreatedNotificationJob = (
  commentId: string,
  transaction?: TransactionLike
) =>
  sendNotificationJob(
    notificationJobNames.commentCreated,
    {
      commentId
    },
    transaction
  );

export const enqueueProgressUnlockedNotificationJob = (
  progressHistoryId: string,
  transaction?: TransactionLike
) =>
  sendNotificationJob(
    notificationJobNames.progressUnlocked,
    {
      progressHistoryId
    },
    transaction
  );

export const enqueueStorageObjectDeleteJob = (
  objectKeys: string[],
  transaction?: TransactionLike
) =>
  sendJob(
    storageJobNames.objectDelete,
    {
      objectKeys
    },
    transaction
  );

const sendNotificationJob = (
  name: NotificationJobName,
  data: object,
  transaction?: TransactionLike
) =>
  sendJob(name, data, transaction);

const sendJob = (
  name: NotificationJobName | StorageJobName,
  data: object,
  transaction?: TransactionLike
) =>
  notificationBoss.send(name, data, {
    ...notificationJobOptions,
    ...(transaction
      ? {
          db: fromPrisma(transaction)
        }
      : {})
  });
