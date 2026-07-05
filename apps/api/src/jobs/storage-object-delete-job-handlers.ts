import type { Job } from "pg-boss";
import { z } from "zod";

import {
  notificationBoss,
  storageJobNames
} from "./notification-job-queue.js";
import {
  r2Storage,
  type ObjectStorage
} from "../core/storage/r2-storage.js";
import { logger, sanitizeError } from "../core/logging/logger.js";

const storageObjectDeleteJobSchema = z
  .object({
    objectKeys: z.array(z.string().trim().min(1).max(512)).min(1).max(5000)
  })
  .strict();

type StorageObjectDeleteJob = z.infer<typeof storageObjectDeleteJobSchema>;

export const registerStorageObjectDeleteJobHandlers = async (
  storage: ObjectStorage = r2Storage
) => {
  await notificationBoss.work<StorageObjectDeleteJob>(
    storageJobNames.objectDelete,
    {
      batchSize: 1,
      localConcurrency: 1,
      pollingIntervalSeconds: 5
    },
    async ([job]) => {
      if (!job) {
        return;
      }

      await runLoggedStorageObjectDeleteJob(
        storageJobNames.objectDelete,
        job,
        () => processStorageObjectDeleteJob(job.data, storage)
      );
    }
  );
};

export const processStorageObjectDeleteJob = async (
  data: unknown,
  storage: ObjectStorage = r2Storage
) => {
  const payload = storageObjectDeleteJobSchema.parse(data);
  const objectKeys = [...new Set(payload.objectKeys)];

  await storage.deleteObjects(objectKeys);
};

export const runLoggedStorageObjectDeleteJob = async (
  jobName: string,
  job: Job,
  handler: () => Promise<void>
) => {
  try {
    await handler();
  } catch (error) {
    logger.error("Storage cleanup job failed", {
      jobName,
      jobId: job.id,
      objectCount: getObjectCount(job.data),
      error: sanitizeError(error)
    });
    throw error;
  }
};

const getObjectCount = (data: unknown) => {
  if (!data || typeof data !== "object" || !("objectKeys" in data)) {
    return 0;
  }

  const objectKeys = (data as { objectKeys?: unknown }).objectKeys;

  return Array.isArray(objectKeys) ? objectKeys.length : 0;
};
