import { getUploadCleanupKeys } from "./upload-object-keys.js";
import { prisma } from "../prisma/client.js";
import type { Prisma } from "../../generated/prisma/client.js";

export type StorageDeletionReason =
  | "INVALID_UPLOAD"
  | "EXPIRED_UPLOAD"
  | "UNATTACHED_POST_IMAGE"
  | "REPLACED_ASSET"
  | "ACCOUNT_DELETION";

export type PendingStorageDeletion = {
  id: string;
  objectKey: string;
};

export const requestStorageObjectDeletion = async (
  transaction: Prisma.TransactionClient,
  objectKey: string,
  reason: StorageDeletionReason,
  notBefore?: Date
) =>
  transaction.storageObjectDeletion.upsert({
    where: {
      objectKey
    },
    create: {
      objectKey,
      reason,
      notBefore
    },
    update: {},
    select: {
      id: true,
      status: true
    }
  });

export const requestUploadObjectDeletions = async (
  transaction: Prisma.TransactionClient,
  objectKey: string,
  reason: StorageDeletionReason,
  uploadExpiresAt?: Date | null
) => {
  const deletionIds: string[] = [];
  for (const key of getUploadCleanupKeys(objectKey)) {
    const deletion = await requestStorageObjectDeletion(
      transaction,
      key,
      reason,
      key === objectKey ? undefined : (uploadExpiresAt ?? undefined)
    );
    if (deletion.status === "PENDING") deletionIds.push(deletion.id);
  }
  return deletionIds;
};

export const listPendingStorageDeletions = (
  deletionIds: string[],
  now = new Date()
) =>
  prisma.storageObjectDeletion.findMany({
    where: {
      id: {
        in: deletionIds
      },
      status: "PENDING",
      notBefore: { lte: now }
    },
    select: {
      id: true,
      objectKey: true
    }
  });

export const markStorageDeletionsCompleted = (deletionIds: string[]) =>
  prisma.$transaction(async (transaction) => {
    const deletions = await transaction.storageObjectDeletion.findMany({
      where: {
        id: {
          in: deletionIds
        },
        status: "PENDING"
      },
      select: {
        objectKey: true
      }
    });
    const objectKeys = deletions.map((deletion) => deletion.objectKey);

    await transaction.storageObjectDeletion.updateMany({
      where: {
        id: {
          in: deletionIds
        },
        status: "PENDING"
      },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        lastError: null,
        attempts: {
          increment: 1
        }
      }
    });

    if (objectKeys.length > 0) {
      await transaction.fileAsset.deleteMany({
        where: {
          objectKey: {
            in: objectKeys
          },
          postId: null,
          commentId: null,
          avatarForUser: null,
          coverForClub: null
        }
      });
    }
  });

export const recordStorageDeletionFailure = (
  deletionIds: string[],
  error: unknown
) =>
  prisma.storageObjectDeletion.updateMany({
    where: {
      id: {
        in: deletionIds
      },
      status: "PENDING"
    },
    data: {
      attempts: {
        increment: 1
      },
      lastError: storageErrorMessage(error)
    }
  });

const storageErrorMessage = (error: unknown) => {
  const message =
    error instanceof Error ? error.message : "Storage deletion failed";

  return message.replace(/[\r\n\t]/g, " ").slice(0, 500);
};
