import { randomUUID } from "node:crypto";

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
import { validateUploadedImage } from "./image-validation.js";
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
    const asset = await repository.createPendingFileAsset({
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
      objectKey,
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

    const metadata = await storage.getObjectMetadata(asset.objectKey);

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

    const bytes = await storage.getObjectBytes(
      asset.objectKey,
      asset.sizeBytes
    );
    let validation;

    try {
      if (bytes.byteLength !== asset.sizeBytes) {
        throw new Error(
          "Stored object length did not match the upload request."
        );
      }

      validation = validateUploadedImage(
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
      new Date(),
      validation
    );

    if (!readyResult) {
      throw uploadStateConflict();
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
    await cleanupService.processCommittedDeletions([rejected.deletionId]);
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
