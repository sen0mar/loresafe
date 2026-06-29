import { prisma } from "../../core/prisma/client.js";

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
  createPendingFileAsset: (input: CreateFileAssetInput) => Promise<FileAssetRecord>;
  findAssetById: (assetId: string) => Promise<FileAssetRecord | null>;
  findClubByLinkNameForUser: (
    linkName: string,
    userId: string
  ) => Promise<UploadClubRecord | null>;
  markAssetFailed: (assetId: string) => Promise<FileAssetRecord | null>;
  markAssetReadyAndAttach: (
    asset: FileAssetRecord,
    readyAt: Date
  ) => Promise<FileAssetRecord>;
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

  markAssetFailed: async (assetId) => {
    const updateResult = await prisma.fileAsset.updateMany({
      where: {
        id: assetId,
        status: "PENDING"
      },
      data: {
        status: "FAILED"
      }
    });

    if (updateResult.count === 0) {
      return null;
    }

    return prisma.fileAsset.findUnique({
      where: {
        id: assetId
      },
      select: fileAssetSelect
    });
  },

  markAssetReadyAndAttach: (asset, readyAt) =>
    prisma.$transaction(async (transaction) => {
      const updatedAsset = await transaction.fileAsset.update({
        where: {
          id: asset.id,
          status: "PENDING"
        },
        data: {
          status: "READY",
          readyAt
        },
        select: fileAssetSelect
      });

      if (asset.purpose === "AVATAR") {
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
      } else if (asset.purpose === "CLUB_COVER" && asset.clubId) {
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
      }

      return updatedAsset;
    })
};
