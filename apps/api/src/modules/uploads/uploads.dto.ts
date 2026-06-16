import type { ObjectStorage } from "../../core/storage/r2-storage.js";
import type { FileAssetRecord } from "./uploads.repository.js";

export type FileAssetDto = {
  id: string;
  purpose: "AVATAR" | "CLUB_COVER";
  visibility: "PUBLIC";
  status: "PENDING" | "READY" | "FAILED";
  contentType: string;
  sizeBytes: number;
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
  url: asset.status === "READY" ? storage.getPublicUrl(asset.objectKey) : null,
  createdAt: asset.createdAt.toISOString(),
  updatedAt: asset.updatedAt.toISOString()
});
