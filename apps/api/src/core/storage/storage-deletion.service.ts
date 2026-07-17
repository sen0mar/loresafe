import { logger, sanitizeError } from "../logging/logger.js";
import { operationsMetrics } from "../monitoring/operations-metrics.js";
import {
  listPendingStorageDeletions,
  markStorageDeletionsCompleted,
  recordStorageDeletionFailure,
  type PendingStorageDeletion
} from "./storage-deletion.repository.js";
import { r2Storage, type ObjectStorage } from "./r2-storage.js";

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

export const processStorageDeletionIds = async (
  deletionIds: string[],
  storage: ObjectStorage = r2Storage,
  repository: StorageDeletionRepository = storageDeletionRepository
) => {
  const uniqueDeletionIds = [...new Set(deletionIds)];

  if (uniqueDeletionIds.length === 0) {
    return;
  }

  let pendingDeletions: PendingStorageDeletion[];

  try {
    pendingDeletions = await repository.listPending(uniqueDeletionIds);
  } catch (error) {
    logger.warn("Pending storage deletions could not be loaded", {
      deletionCount: uniqueDeletionIds.length,
      error: sanitizeError(error)
    });
    return;
  }

  if (pendingDeletions.length === 0) {
    return;
  }

  const pendingIds = pendingDeletions.map((deletion) => deletion.id);

  try {
    await storage.deleteObjects(
      pendingDeletions.map((deletion) => deletion.objectKey)
    );
    await repository.markCompleted(pendingIds);
    operationsMetrics.recordStorageCleanup(pendingIds.length, 0);
  } catch (error) {
    operationsMetrics.recordStorageCleanup(0, pendingIds.length);

    try {
      await repository.recordFailure(pendingIds, error);
    } catch (recordError) {
      logger.error("Storage deletion failure could not be recorded", {
        deletionCount: pendingIds.length,
        error: sanitizeError(recordError)
      });
    }

    logger.warn("Storage deletion remains pending for a later request", {
      deletionCount: pendingIds.length,
      error: sanitizeError(error)
    });
  }
};
