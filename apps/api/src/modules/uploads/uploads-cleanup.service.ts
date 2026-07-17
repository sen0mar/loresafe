import { processStorageDeletionIds } from "../../core/storage/storage-deletion.service.js";
import {
  uploadsCleanupRepository,
  type UploadsCleanupRepository
} from "./uploads-cleanup.repository.js";

const reconciliationIntervalMs = 6 * 60 * 60 * 1000;
const reconciliationBatchSize = 100;

export type UploadsCleanupService = {
  processCommittedDeletions: (deletionIds: string[]) => Promise<void>;
  runAfterUploadTraffic: (deletionIds?: string[]) => void;
};

type UploadsCleanupServiceOptions = {
  now?: () => Date;
  processDeletions?: (deletionIds: string[]) => Promise<void>;
  reconciliationInterval?: number;
  reconciliationLimit?: number;
};

export const createUploadsCleanupService = (
  repository: UploadsCleanupRepository = uploadsCleanupRepository,
  {
    now = () => new Date(),
    processDeletions = processStorageDeletionIds,
    reconciliationInterval = reconciliationIntervalMs,
    reconciliationLimit = reconciliationBatchSize
  }: UploadsCleanupServiceOptions = {}
): UploadsCleanupService => {
  let lastReconciliationStartedAt = 0;
  let reconciliationInFlight = false;

  const reconcileIfDue = async () => {
    const currentTime = now();

    if (
      reconciliationInFlight ||
      currentTime.getTime() - lastReconciliationStartedAt <
        reconciliationInterval
    ) {
      return;
    }

    reconciliationInFlight = true;
    lastReconciliationStartedAt = currentTime.getTime();

    try {
      const deletionIds = await repository.requestCleanupForStaleAssets(
        currentTime,
        reconciliationLimit
      );
      await processDeletions(deletionIds);
    } finally {
      reconciliationInFlight = false;
    }
  };

  return {
    processCommittedDeletions: processDeletions,
    runAfterUploadTraffic: (deletionIds = []) => {
      void Promise.all([processDeletions(deletionIds), reconcileIfDue()]).catch(
        () => undefined
      );
    }
  };
};

export const uploadsCleanupService = createUploadsCleanupService();
