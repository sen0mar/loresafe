import { prisma } from "../../core/prisma/client.js";
import { requestStorageObjectDeletion } from "../../core/storage/storage-deletion.repository.js";
import type { ValidatedImage } from "./image-validation.js";

export type FileAssetPurpose = "AVATAR" | "CLUB_COVER" | "POST_IMAGE";
export type FileAssetVisibility = "PUBLIC" | "PRIVATE";
export type FileAssetStatus = "PENDING" | "READY" | "FAILED";
export type ClubMembershipRole = "OWNER" | "MODERATOR" | "MEMBER";

export type FileAssetRecord = {
  id: string;
  ownerId: string;
  clubId: string | null;
  postId: string | null;
  commentId: string | null;
  purpose: FileAssetPurpose;
  visibility: FileAssetVisibility;
  safePreview: boolean;
  objectKey: string;
  contentType: string;
  sizeBytes: number;
  status: FileAssetStatus;
  widthPx: number | null;
  heightPx: number | null;
  isAnimated: boolean | null;
  validatedAt: Date | null;
  readyAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type UploadClubRecord = {
  id: string;
  linkName: string;
  currentUserRole: ClubMembershipRole | null;
  isCurrentUserBanned: boolean;
};

export type CreateFileAssetInput = {
  ownerId: string;
  clubId: string | null;
  purpose: FileAssetPurpose;
  visibility?: FileAssetVisibility;
  safePreview?: boolean;
  objectKey: string;
  contentType: string;
  sizeBytes: number;
};

export type UploadsRepository = {
  createPendingFileAsset: (
    input: CreateFileAssetInput
  ) => Promise<FileAssetRecord>;
  findAssetById: (assetId: string) => Promise<FileAssetRecord | null>;
  findClubByLinkNameForUser: (
    linkName: string,
    userId: string
  ) => Promise<UploadClubRecord | null>;
  markAssetFailedAndRequestDeletion: (
    assetId: string
  ) => Promise<{ asset: FileAssetRecord; deletionId: string } | null>;
  markAssetReadyAndAttach: (
    asset: FileAssetRecord,
    readyAt: Date,
    validation: ValidatedImage
  ) => Promise<{
    asset: FileAssetRecord;
    deletionIds: string[];
  } | null>;
};

const fileAssetSelect = {
  id: true,
  ownerId: true,
  clubId: true,
  postId: true,
  commentId: true,
  purpose: true,
  visibility: true,
  safePreview: true,
  objectKey: true,
  contentType: true,
  sizeBytes: true,
  status: true,
  widthPx: true,
  heightPx: true,
  isAnimated: true,
  validatedAt: true,
  readyAt: true,
  createdAt: true,
  updatedAt: true
} as const;

const clubUploadSelect = (userId: string) => {
  const now = new Date();

  return {
    id: true,
    linkName: true,
    bans: {
      where: {
        userId,
        revokedAt: null,
        OR: [
          {
            expiresAt: null
          },
          {
            expiresAt: {
              gt: now
            }
          }
        ]
      },
      select: {
        id: true
      },
      take: 1
    },
    memberships: {
      where: {
        userId
      },
      select: {
        role: true
      },
      take: 1
    }
  };
};

export const uploadsRepository: UploadsRepository = {
  createPendingFileAsset: (input) =>
    prisma.fileAsset.create({
      data: {
        ownerId: input.ownerId,
        clubId: input.clubId,
        postId: null,
        commentId: null,
        purpose: input.purpose,
        visibility: input.visibility ?? "PUBLIC",
        safePreview: input.safePreview ?? false,
        objectKey: input.objectKey,
        contentType: input.contentType,
        sizeBytes: input.sizeBytes,
        status: "PENDING"
      },
      select: fileAssetSelect
    }),

  findAssetById: (assetId) =>
    prisma.fileAsset.findUnique({
      where: {
        id: assetId
      },
      select: fileAssetSelect
    }),

  findClubByLinkNameForUser: async (linkName, userId) => {
    const club = await prisma.club.findUnique({
      where: {
        linkName
      },
      select: clubUploadSelect(userId)
    });

    if (!club) {
      return null;
    }

    return {
      id: club.id,
      linkName: club.linkName,
      currentUserRole: club.memberships[0]?.role ?? null,
      isCurrentUserBanned: club.bans.length > 0
    };
  },

  markAssetFailedAndRequestDeletion: (assetId) =>
    prisma.$transaction(async (transaction) => {
      const lockedRows = await transaction.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "file_assets"
        WHERE "id" = ${assetId}::uuid
        FOR UPDATE
      `;

      if (lockedRows.length === 0) {
        return null;
      }

      const asset = await transaction.fileAsset.findUnique({
        where: {
          id: assetId
        },
        select: fileAssetSelect
      });

      if (!asset || asset.status !== "PENDING") {
        return null;
      }

      const failedAsset = await transaction.fileAsset.update({
        where: {
          id: asset.id,
          status: "PENDING"
        },
        data: {
          status: "FAILED"
        },
        select: fileAssetSelect
      });
      const deletion = await requestStorageObjectDeletion(
        transaction,
        asset.objectKey,
        "INVALID_UPLOAD"
      );

      return {
        asset: failedAsset,
        deletionId: deletion.id
      };
    }),

  markAssetReadyAndAttach: (asset, readyAt, validation) =>
    prisma.$transaction(async (transaction) => {
      const lockedRows = await transaction.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "file_assets"
        WHERE "id" = ${asset.id}::uuid
        FOR UPDATE
      `;

      if (lockedRows.length === 0) {
        return null;
      }

      const currentAsset = await transaction.fileAsset.findUniqueOrThrow({
        where: { id: asset.id },
        select: fileAssetSelect
      });

      if (currentAsset.status !== "PENDING") {
        return {
          asset: currentAsset,
          deletionIds: []
        };
      }

      const updatedAsset = await transaction.fileAsset.update({
        where: {
          id: asset.id,
          status: "PENDING"
        },
        data: {
          status: "READY",
          readyAt,
          widthPx: validation.widthPx,
          heightPx: validation.heightPx,
          isAnimated: validation.isAnimated,
          validatedAt: readyAt
        },
        select: fileAssetSelect
      });

      const deletionIds: string[] = [];

      if (asset.purpose === "AVATAR") {
        const previousAsset = await transaction.user.findUnique({
          where: {
            id: asset.ownerId
          },
          select: {
            avatarAsset: {
              select: {
                id: true,
                objectKey: true
              }
            }
          }
        });

        await transaction.user.update({
          where: {
            id: asset.ownerId
          },
          data: {
            avatarAssetId: asset.id
          },
          select: {
            id: true
          }
        });

        if (
          previousAsset?.avatarAsset?.id !== asset.id &&
          previousAsset?.avatarAsset
        ) {
          const deletion = await requestStorageObjectDeletion(
            transaction,
            previousAsset.avatarAsset.objectKey,
            "REPLACED_ASSET"
          );

          if (deletion.status === "PENDING") {
            deletionIds.push(deletion.id);
          }
        }
      } else if (asset.purpose === "CLUB_COVER" && asset.clubId) {
        const previousAsset = await transaction.club.findUnique({
          where: {
            id: asset.clubId
          },
          select: {
            coverAsset: {
              select: {
                id: true,
                objectKey: true
              }
            }
          }
        });

        await transaction.club.update({
          where: {
            id: asset.clubId
          },
          data: {
            coverAssetId: asset.id
          },
          select: {
            id: true
          }
        });

        if (
          previousAsset?.coverAsset?.id !== asset.id &&
          previousAsset?.coverAsset
        ) {
          const deletion = await requestStorageObjectDeletion(
            transaction,
            previousAsset.coverAsset.objectKey,
            "REPLACED_ASSET"
          );

          if (deletion.status === "PENDING") {
            deletionIds.push(deletion.id);
          }
        }
      }

      return {
        asset: updatedAsset,
        deletionIds
      };
    })
};
