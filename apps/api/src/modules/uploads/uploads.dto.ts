import type { ObjectStorage } from "../../core/storage/r2-storage.js";
import type { FileAssetRecord } from "./uploads.repository.js";

export type FileAssetDto = {
  id: string;
  purpose: "AVATAR" | "CLUB_COVER" | "POST_IMAGE";
  visibility: "PUBLIC" | "PRIVATE";
  status: "PENDING" | "READY" | "FAILED";
  contentType: string;
  sizeBytes: number;
  safePreview: boolean;
  url: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreatePublicAssetUploadResponse = {
  asset: FileAssetDto;
  upload: {
    url: string;
    method: "PUT";
    requiredHeaders: Record<string, string>;
    expiresAt: string;
  };
};

export type CreatePostImageUploadResponse = CreatePublicAssetUploadResponse;

export type CompletePublicAssetUploadResponse = {
  asset: FileAssetDto;
};

export const toFileAssetDto = (
  asset: FileAssetRecord,
  storage: Pick<ObjectStorage, "getPublicUrl">
): FileAssetDto => ({
  id: asset.id,
  purpose: asset.purpose,
  visibility: asset.visibility,
  status: asset.status,
  contentType: asset.contentType,
  sizeBytes: asset.sizeBytes,
  safePreview: asset.safePreview,
  url:
    asset.status === "READY" && asset.visibility === "PUBLIC"
      ? storage.getPublicUrl(asset.objectKey)
      : null,
  createdAt: asset.createdAt.toISOString(),
  updatedAt: asset.updatedAt.toISOString()
});
