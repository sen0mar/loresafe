import { randomUUID } from "node:crypto";

import { HttpError } from "../../core/errors/http-error.js";
import { r2Storage, type ObjectStorage } from "../../core/storage/r2-storage.js";
import { canUploadClubCover, canUploadPostImage } from "./uploads.policy.js";
import {
  uploadsRepository,
  type FileAssetRecord,
  type UploadsRepository
} from "./uploads.repository.js";
import type {
  CreatePostImageUploadRequest,
  CreatePublicAssetUploadRequest
} from "./uploads.schema.js";
import {
  type CompletePublicAssetUploadResponse,
  type CreatePostImageUploadResponse,
  type CreatePublicAssetUploadResponse,
  toFileAssetDto
} from "./uploads.dto.js";

export type UploadsService = {
  completePublicAssetUpload: (
    userId: string,
    assetId: string
  ) => Promise<CompletePublicAssetUploadResponse>;
  createPublicAssetUpload: (
    userId: string,
    input: CreatePublicAssetUploadRequest
  ) => Promise<CreatePublicAssetUploadResponse>;
  createPostImageUpload: (
    userId: string,
    input: CreatePostImageUploadRequest
  ) => Promise<CreatePostImageUploadResponse>;
};

export const createUploadsService = (
  repository: UploadsRepository = uploadsRepository,
  storage: ObjectStorage = r2Storage
): UploadsService => ({
  createPublicAssetUpload: async (userId, input) => {
    const club =
      input.purpose === "CLUB_COVER"
        ? await repository.findClubBySlugForUser(input.clubSlug ?? "", userId)
        : null;

    if (input.purpose === "CLUB_COVER") {
      if (!club) {
        throw new HttpError(404, "NOT_FOUND", "Club not found");
      }

      if (!canUploadClubCover(club.currentUserRole)) {
        throw new HttpError(
          403,
          "FORBIDDEN",
          "You cannot update this club cover."
        );
      }
    }

    const objectKey = createPublicObjectKey({
      contentType: input.contentType,
      ownerId: userId,
      clubId: club?.id ?? null,
      purpose: input.purpose
    });
    const asset = await repository.createPendingFileAsset({
      ownerId: userId,
      clubId: club?.id ?? null,
      purpose: input.purpose,
      objectKey,
      contentType: input.contentType,
      sizeBytes: input.sizeBytes
    });
    const upload = await storage.createPresignedUpload({
      objectKey,
      contentType: input.contentType
    });

    return {
      asset: toFileAssetDto(asset, storage),
      upload: {
        url: upload.uploadUrl,
        method: "PUT",
        requiredHeaders: upload.requiredHeaders,
        expiresAt: upload.expiresAt.toISOString()
      }
    };
  },

  createPostImageUpload: async (userId, input) => {
    const club = await repository.findClubBySlugForUser(input.clubSlug, userId);

    if (!club) {
      throw new HttpError(404, "NOT_FOUND", "Club not found");
    }

    if (!canUploadPostImage(club)) {
      throw new HttpError(
        403,
        "FORBIDDEN",
        club.isCurrentUserBanned
          ? "You cannot upload images in this club."
          : "Join this club before uploading images."
      );
    }

    const objectKey = createPostImageObjectKey({
      contentType: input.contentType,
      clubId: club.id
    });
    const asset = await repository.createPendingFileAsset({
      ownerId: userId,
      clubId: club.id,
      purpose: "POST_IMAGE",
      visibility: "PRIVATE",
      safePreview: input.safePreview,
      objectKey,
      contentType: input.contentType,
      sizeBytes: input.sizeBytes
    });
    const upload = await storage.createPresignedUpload({
      objectKey,
      contentType: input.contentType
    });

    return {
      asset: toFileAssetDto(asset, storage),
      upload: {
        url: upload.uploadUrl,
        method: "PUT",
        requiredHeaders: upload.requiredHeaders,
        expiresAt: upload.expiresAt.toISOString()
      }
    };
  },

  completePublicAssetUpload: async (userId, assetId) => {
    const asset = await repository.findAssetById(assetId);

    if (!asset || asset.ownerId !== userId) {
      throw new HttpError(404, "NOT_FOUND", "Upload not found");
    }

    if (asset.status !== "PENDING") {
      throw new HttpError(
        409,
        "CONFLICT",
        "This upload has already been completed."
      );
    }

    const metadata = await storage.getObjectMetadata(asset.objectKey);

    if (!metadata) {
      throw new HttpError(400, "BAD_REQUEST", "Uploaded object was not found.");
    }

    if (!doesMetadataMatchAsset(metadata, asset)) {
      await repository.markAssetFailed(asset.id);
      throw new HttpError(
        400,
        "BAD_REQUEST",
        "Uploaded object metadata did not match the upload request."
      );
    }

    const readyAsset = await repository.markAssetReadyAndAttach(asset, new Date());

    return {
      asset: toFileAssetDto(readyAsset, storage)
    };
  }
});

export const uploadsService = createUploadsService();

const extensionByContentType: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
};

const createPublicObjectKey = ({
  contentType,
  ownerId,
  clubId,
  purpose
}: {
  contentType: string;
  ownerId: string;
  clubId: string | null;
  purpose: "AVATAR" | "CLUB_COVER";
}) => {
  const extension = extensionByContentType[contentType] ?? "bin";
  const assetKeyId = randomUUID();

  if (purpose === "AVATAR") {
    return `public/avatars/${ownerId}/${assetKeyId}.${extension}`;
  }

  return `public/club-covers/${clubId ?? "unknown"}/${assetKeyId}.${extension}`;
};

const createPostImageObjectKey = ({
  contentType,
  clubId
}: {
  contentType: string;
  clubId: string;
}) => {
  const extension = extensionByContentType[contentType] ?? "bin";
  const assetKeyId = randomUUID();

  return `private/post-images/${clubId}/${assetKeyId}.${extension}`;
};

const doesMetadataMatchAsset = (
  metadata: {
    contentLength: number | null;
    contentType: string | null;
  },
  asset: FileAssetRecord
) =>
  metadata.contentLength === asset.sizeBytes &&
  metadata.contentType?.toLowerCase() === asset.contentType.toLowerCase();
