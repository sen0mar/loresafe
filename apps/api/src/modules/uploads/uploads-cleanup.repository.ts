import { prisma } from "../../core/prisma/client.js";
import {
  requestUploadObjectDeletions,
  type StorageDeletionReason
} from "../../core/storage/storage-deletion.repository.js";

export type UploadsCleanupRepository = {
  requestCleanupForStaleAssets: (now: Date, limit: number) => Promise<string[]>;
};

const pendingUploadLifetimeMs = 20 * 60 * 1000;
const unattachedReadyAssetLifetimeMs = 24 * 60 * 60 * 1000;
const retryDeletionAfterMs = 5 * 60 * 1000;

export const uploadsCleanupRepository: UploadsCleanupRepository = {
  requestCleanupForStaleAssets: (now, limit) =>
    prisma.$transaction(async (transaction) => {
      const pendingCutoff = new Date(now.getTime() - pendingUploadLifetimeMs);
      const unattachedCutoff = new Date(
        now.getTime() - unattachedReadyAssetLifetimeMs
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
              readyAt: {
                lt: unattachedCutoff
              },
              OR: [
                {
                  purpose: "POST_IMAGE",
                  postId: null
                },
                {
                  purpose: "AVATAR",
                  avatarForUser: null
                },
                {
                  purpose: "CLUB_COVER",
                  coverForClub: null
                }
              ]
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
          status: true,
          uploadExpiresAt: true
        }
      });
      const deletionIds: string[] = [];

      for (const asset of assets) {
        // Claim the observed state before queuing either key. A completion that
        // won the row lock must not be deleted using an earlier PENDING snapshot.
        const claimed = await transaction.fileAsset.updateMany({
          where: {
            id: asset.id,
            status: asset.status
          },
          data: { status: "FAILED" }
        });
        if (claimed.count === 0) continue;

        const assetDeletionIds = await requestUploadObjectDeletions(
          transaction,
          asset.objectKey,
          cleanupReason(asset),
          asset.uploadExpiresAt
        );

        deletionIds.push(...assetDeletionIds);
      }

      const remainingRetryCapacity = Math.max(limit - deletionIds.length, 0);
      const retryableDeletions =
        remainingRetryCapacity === 0
          ? []
          : await transaction.storageObjectDeletion.findMany({
              where: {
                status: "PENDING",
                notBefore: { lte: now },
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

  if (asset.status === "READY") {
    return "REPLACED_ASSET";
  }

  if (asset.status === "PENDING") {
    return "EXPIRED_UPLOAD";
  }

  return "INVALID_UPLOAD";
};
