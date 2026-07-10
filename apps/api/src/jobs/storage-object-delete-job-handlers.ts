import type { Job } from "pg-boss";
import { z } from "zod";

import {
  listPendingStorageDeletions,
  markStorageDeletionsCompleted,
  recordStorageDeletionFailure,
  type PendingStorageDeletion
} from "../core/storage/storage-deletion.repository.js";
import {
  r2Storage,
  type ObjectStorage
} from "../core/storage/r2-storage.js";
import { logger, sanitizeError } from "../core/logging/logger.js";
import { operationsMetrics } from "../core/monitoring/operations-metrics.js";
import {
  enqueueStorageObjectDeleteJob,
  notificationBoss,
  storageJobNames
} from "./notification-job-queue.js";
import {
  uploadsCleanupRepository,
  type UploadsCleanupRepository
} from "../modules/uploads/uploads-cleanup.repository.js";

const storageObjectDeleteJobSchema = z
  .object({
    deletionIds: z.array(z.uuid()).min(1).max(5000)
  })
  .strict();

const storageAssetReconcileJobSchema = z.object({}).strict();

type StorageObjectDeleteJob = z.infer<typeof storageObjectDeleteJobSchema>;
type StorageAssetReconcileJob = z.infer<typeof storageAssetReconcileJobSchema>;

export type StorageDeletionRepository = {
  listPending: (deletionIds: string[]) => Promise<PendingStorageDeletion[]>;
  markCompleted: (deletionIds: string[]) => Promise<unknown>;
  recordFailure: (deletionIds: string[], error: unknown) => Promise<unknown>;
};

const storageDeletionRepository: StorageDeletionRepository = {
  listPending: listPendingStorageDeletions,
  markCompleted: markStorageDeletionsCompleted,
  recordFailure: recordStorageDeletionFailure
};

export const registerStorageObjectDeleteJobHandlers = async (
  storage: ObjectStorage = r2Storage,
  deletionRepository: StorageDeletionRepository = storageDeletionRepository,
  cleanupRepository: UploadsCleanupRepository = uploadsCleanupRepository
) => {
  await Promise.all([
    notificationBoss.work<StorageObjectDeleteJob>(
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
          () => processStorageObjectDeleteJob(job.data, storage, deletionRepository)
        );
      }
    ),
    notificationBoss.work<StorageAssetReconcileJob>(
      storageJobNames.assetReconcile,
      {
        batchSize: 1,
        localConcurrency: 1,
        pollingIntervalSeconds: 30
      },
      async ([job]) => {
        if (!job) {
          return;
        }

        await runLoggedStorageObjectDeleteJob(
          storageJobNames.assetReconcile,
          job,
          () => processStorageAssetReconcileJob(job.data, cleanupRepository)
        );
      }
    )
  ]);
};

export const processStorageObjectDeleteJob = async (
  data: unknown,
  storage: ObjectStorage = r2Storage,
  repository: StorageDeletionRepository = storageDeletionRepository
) => {
  const payload = storageObjectDeleteJobSchema.parse(data);
  const deletionIds = [...new Set(payload.deletionIds)];
  const pendingDeletions = await repository.listPending(deletionIds);

  if (pendingDeletions.length === 0) {
    return;
  }

  try {
    await storage.deleteObjects(
      pendingDeletions.map((deletion) => deletion.objectKey)
    );
  } catch (error) {
    operationsMetrics.recordStorageCleanup(0, pendingDeletions.length);
    await repository.recordFailure(
      pendingDeletions.map((deletion) => deletion.id),
      error
    );
    throw error;
  }

  await repository.markCompleted(
    pendingDeletions.map((deletion) => deletion.id)
  );
  operationsMetrics.recordStorageCleanup(pendingDeletions.length, 0);
};

export const processStorageAssetReconcileJob = async (
  data: unknown,
  repository: UploadsCleanupRepository = uploadsCleanupRepository
) => {
  storageAssetReconcileJobSchema.parse(data);
  const deletionIds = await repository.requestCleanupForStaleAssets(
    new Date(),
    100
  );

  if (deletionIds.length > 0) {
    await enqueueStorageObjectDeleteJob(deletionIds);
  }
};

export const runLoggedStorageObjectDeleteJob = async (
  jobName: string,
  job: Job,
  handler: () => Promise<void>
) => {
  try {
    await handler();
    operationsMetrics.recordJob(jobName, getJobAgeSeconds(job), false);
  } catch (error) {
    operationsMetrics.recordJob(jobName, getJobAgeSeconds(job), true);
    logger.error("Storage cleanup job failed", {
      jobName,
      jobId: job.id,
      objectCount: getObjectCount(job.data),
      error: sanitizeError(error)
    });
    throw error;
  }
};

const getJobAgeSeconds = (job: Job) => {
  const createdOn = (job as Job & { createdOn?: Date | string }).createdOn;
  const createdAt = createdOn ? new Date(createdOn).getTime() : Date.now();

  return (Date.now() - createdAt) / 1000;
};

const getObjectCount = (data: unknown) => {
  if (!data || typeof data !== "object" || !("deletionIds" in data)) {
    return 0;
  }

  const deletionIds = (data as { deletionIds?: unknown }).deletionIds;

  return Array.isArray(deletionIds) ? deletionIds.length : 0;
};
