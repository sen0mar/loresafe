import { prisma } from "../../core/prisma/client.js";
import {
  requestStorageObjectDeletion,
  type StorageDeletionReason
} from "../../core/storage/storage-deletion.repository.js";

export type UploadsCleanupRepository = {
  requestCleanupForStaleAssets: (now: Date, limit: number) => Promise<string[]>;
};

const pendingUploadLifetimeMs = 20 * 60 * 1000;
const unattachedPostImageLifetimeMs = 24 * 60 * 60 * 1000;
const retryDeletionAfterMs = 5 * 60 * 1000;

export const uploadsCleanupRepository: UploadsCleanupRepository = {
  requestCleanupForStaleAssets: (now, limit) =>
    prisma.$transaction(async (transaction) => {
      const pendingCutoff = new Date(now.getTime() - pendingUploadLifetimeMs);
      const unattachedCutoff = new Date(
        now.getTime() - unattachedPostImageLifetimeMs
      );
      const retryCutoff = new Date(now.getTime() - retryDeletionAfterMs);
      const assets = await transaction.fileAsset.findMany({
        where: {
          OR: [
            {
              status: "PENDING",
              createdAt: {
                lt: pendingCutoff
              }
            },
            {
              status: "FAILED"
            },
            {
              status: "READY",
              purpose: "POST_IMAGE",
              postId: null,
              readyAt: {
                lt: unattachedCutoff
              }
            }
          ]
        },
        orderBy: {
          createdAt: "asc"
        },
        take: limit,
        select: {
          id: true,
          objectKey: true,
          purpose: true,
          status: true
        }
      });
      const deletionIds: string[] = [];

      for (const asset of assets) {
        const reason = cleanupReason(asset);
        const deletion = await requestStorageObjectDeletion(
          transaction,
          asset.objectKey,
          reason
        );

        if (asset.status !== "FAILED") {
          await transaction.fileAsset.update({
            where: {
              id: asset.id
            },
            data: {
              status: "FAILED"
            },
            select: {
              id: true
            }
          });
        }

        if (deletion.status === "PENDING") {
          deletionIds.push(deletion.id);
        }
      }

      const remainingRetryCapacity = Math.max(limit - deletionIds.length, 0);
      const retryableDeletions =
        remainingRetryCapacity === 0
          ? []
          : await transaction.storageObjectDeletion.findMany({
              where: {
                status: "PENDING",
                updatedAt: {
                  lt: retryCutoff
                }
              },
              orderBy: {
                updatedAt: "asc"
              },
              take: remainingRetryCapacity,
              select: {
                id: true
              }
            });

      return [
        ...new Set([
          ...deletionIds,
          ...retryableDeletions.map((deletion) => deletion.id)
        ])
      ];
    })
};

const cleanupReason = (asset: {
  purpose: "AVATAR" | "CLUB_COVER" | "POST_IMAGE";
  status: "PENDING" | "READY" | "FAILED";
}): StorageDeletionReason => {
  if (asset.status === "READY" && asset.purpose === "POST_IMAGE") {
    return "UNATTACHED_POST_IMAGE";
  }

  if (asset.status === "PENDING") {
    return "EXPIRED_UPLOAD";
  }

  return "INVALID_UPLOAD";
};
