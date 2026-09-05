import { env } from "../../config/env.js";
import { randomUUID } from "node:crypto";
import {
  getUploadStagingKey,
  usesUploadStaging
} from "../../core/storage/upload-object-keys.js";

import { HttpError } from "../../core/errors/http-error.js";
import {
  r2Storage,
  type ObjectStorage
} from "../../core/storage/r2-storage.js";
import { bannedFromClubError } from "../clubs/club-bans.js";
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
import { processUploadedImage } from "./image-validation.js";
import {
  uploadsCleanupService,
  type UploadsCleanupService
} from "./uploads-cleanup.service.js";

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
  storage: ObjectStorage = r2Storage,
  cleanupService: UploadsCleanupService = uploadsCleanupService
): UploadsService => ({
  createPublicAssetUpload: async (userId, input) => {
    const club =
      input.purpose === "CLUB_COVER"
        ? await repository.findClubByLinkNameForUser(
            input.clubLinkName ?? "",
            userId
          )
        : null;

    if (input.purpose === "CLUB_COVER") {
      if (!club) {
        throw new HttpError(404, "NOT_FOUND", "Club not found");
      }

      if (club.isCurrentUserBanned) {
        throw bannedFromClubError();
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
    const uploadExpiresAt = new Date(
      Date.now() + env.R2_PRESIGNED_URL_TTL_SECONDS * 1000
    );
    const asset = await repository.createPendingFileAsset({
      uploadExpiresAt,
      ownerId: userId,
      clubId: club?.id ?? null,
      purpose: input.purpose,
      objectKey,
      contentType: input.contentType,
      sizeBytes: input.sizeBytes
    });
    const upload = await storage.createPresignedUpload({
      objectKey: getUploadStagingKey(objectKey),
      expiresAt: uploadExpiresAt,
      contentType: input.contentType,
      contentLength: input.sizeBytes
    });

    const response: CreatePublicAssetUploadResponse = {
      asset: toFileAssetDto(asset, storage),
      upload: {
        url: upload.uploadUrl,
        method: "PUT",
        requiredHeaders: upload.requiredHeaders,
        expiresAt: upload.expiresAt.toISOString()
      }
    };

    cleanupService.runAfterUploadTraffic();

    return response;
  },

  createPostImageUpload: async (userId, input) => {
    const club = await repository.findClubByLinkNameForUser(
      input.clubLinkName,
      userId
    );

    if (!club) {
      throw new HttpError(404, "NOT_FOUND", "Club not found");
    }

    if (club.isCurrentUserBanned) {
      throw bannedFromClubError();
    }

    if (!canUploadPostImage(club)) {
      throw new HttpError(
        403,
        "FORBIDDEN",
        "Join this club before uploading images."
      );
    }

    const objectKey = createPostImageObjectKey({
      contentType: input.contentType,
      clubId: club.id
    });
    const uploadExpiresAt = new Date(
      Date.now() + env.R2_PRESIGNED_URL_TTL_SECONDS * 1000
    );
    const asset = await repository.createPendingFileAsset({
      uploadExpiresAt,
      ownerId: userId,
      clubId: club.id,
      purpose: "POST_IMAGE",
      visibility: "PRIVATE",
      safePreview: false,
      objectKey,
      contentType: input.contentType,
      sizeBytes: input.sizeBytes
    });
    const upload = await storage.createPresignedUpload({
      objectKey: getUploadStagingKey(objectKey),
      expiresAt: uploadExpiresAt,
      contentType: input.contentType,
      contentLength: input.sizeBytes
    });

    const response: CreatePostImageUploadResponse = {
      asset: toFileAssetDto(asset, storage),
      upload: {
        url: upload.uploadUrl,
        method: "PUT",
        requiredHeaders: upload.requiredHeaders,
        expiresAt: upload.expiresAt.toISOString()
      }
    };

    cleanupService.runAfterUploadTraffic();

    return response;
  },

  completePublicAssetUpload: async (userId, assetId) => {
    const asset = await repository.findAssetById(assetId);

    if (!asset || asset.ownerId !== userId) {
      throw new HttpError(404, "NOT_FOUND", "Upload not found");
    }

    if (asset.status === "READY") {
      return { asset: toFileAssetDto(asset, storage) };
    }

    if (asset.status === "FAILED") {
      throw failedUploadConflict();
    }

    // Intents issued before staging was deployed must be restarted: their PUT
    // credentials grant the old final key and cannot be revoked by completion.
    if (!usesUploadStaging(asset.objectKey)) {
      await rejectInvalidUpload(repository, cleanupService, asset);
      throw failedUploadConflict();
    }
    const stagingKey = getUploadStagingKey(asset.objectKey);
    const metadata = await storage.getObjectMetadata(stagingKey);

    if (!metadata) {
      throw new HttpError(400, "BAD_REQUEST", "Uploaded object was not found.");
    }

    if (!doesMetadataMatchAsset(metadata, asset)) {
      await rejectInvalidUpload(repository, cleanupService, asset);
      throw new HttpError(
        400,
        "BAD_REQUEST",
        "Uploaded object metadata did not match the upload request."
      );
    }

    const bytes = await storage.getObjectBytes(stagingKey, asset.sizeBytes);
    let processedImage;

    try {
      if (bytes.byteLength !== asset.sizeBytes) {
        throw new Error(
          "Stored object length did not match the upload request."
        );
      }

      processedImage = await processUploadedImage(
        bytes,
        asset.contentType,
        asset.purpose
      );
    } catch {
      await rejectInvalidUpload(repository, cleanupService, asset);
      throw new HttpError(
        400,
        "BAD_REQUEST",
        "The uploaded file is not a supported safe image."
      );
    }

    const readyResult = await repository.markAssetReadyAndAttach(
      asset,
      userId,
      new Date(),
      processedImage.validation,
      () =>
        storage.putObject({
          bytes: processedImage.bytes,
          contentType: asset.contentType,
          objectKey: asset.objectKey
        })
    );

    switch (readyResult.status) {
      case "NOT_FOUND":
        throw uploadStateConflict();
      case "BANNED":
        throw bannedFromClubError();
      case "FORBIDDEN":
        throw new HttpError(
          403,
          "FORBIDDEN",
          "You cannot update this club cover."
        );
      case "SUCCESS":
        break;
    }

    if (readyResult.asset.status === "FAILED") {
      throw failedUploadConflict();
    }

    cleanupService.runAfterUploadTraffic(readyResult.deletionIds);

    return {
      asset: toFileAssetDto(readyResult.asset, storage)
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
    return `public/avatars/${ownerId}/final/${assetKeyId}.${extension}`;
  }

  return `public/club-covers/${clubId ?? "unknown"}/final/${assetKeyId}.${extension}`;
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

  return `private/post-images/${clubId}/final/${assetKeyId}.${extension}`;
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

const rejectInvalidUpload = async (
  repository: UploadsRepository,
  cleanupService: UploadsCleanupService,
  asset: FileAssetRecord
) => {
  const rejected = await repository.markAssetFailedAndRequestDeletion(asset.id);

  if (!rejected) {
    return;
  }

  try {
    await cleanupService.processCommittedDeletions(rejected.deletionIds);
  } catch {
    // The durable deletion ledger keeps failed R2 cleanup recoverable.
  }
};

const failedUploadConflict = () =>
  new HttpError(
    409,
    "CONFLICT",
    "This upload failed validation and cannot be completed."
  );

const uploadStateConflict = () =>
  new HttpError(
    409,
    "CONFLICT",
    "This upload changed state before completion. Refresh and try again."
  );
