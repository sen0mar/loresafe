import { apiPost } from "@/shared/api/api-client";

import type { PublicAssetPurpose } from "../lib/public-asset-validation.js";

export type FileAsset = {
  id: string;
  purpose: PublicAssetPurpose | "POST_IMAGE";
  visibility: "PUBLIC" | "PRIVATE";
  status: "PENDING" | "READY" | "FAILED";
  contentType: string;
  sizeBytes: number;
  safePreview: boolean;
  url: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreatePublicAssetUploadInput = {
  purpose: PublicAssetPurpose;
  contentType: string;
  sizeBytes: number;
  clubSlug?: string;
};

export type CreatePublicAssetUploadResponse = {
  asset: FileAsset;
  upload: {
    url: string;
    method: "PUT";
    requiredHeaders: Record<string, string>;
    expiresAt: string;
  };
};

export type CreatePostImageUploadInput = {
  clubSlug: string;
  contentType: string;
  sizeBytes: number;
  safePreview: boolean;
};

export type CreatePostImageUploadResponse = CreatePublicAssetUploadResponse;

export type CompletePublicAssetUploadResponse = {
  asset: FileAsset;
};

export const createPublicAssetUpload = (
  input: CreatePublicAssetUploadInput
) =>
  apiPost<CreatePublicAssetUploadResponse, CreatePublicAssetUploadInput>(
    "/api/uploads/public-assets",
    input
  );

export const completePublicAssetUpload = (assetId: string) =>
  apiPost<CompletePublicAssetUploadResponse>(
    `/api/uploads/${assetId}/complete`
  );

export const createPostImageUpload = (input: CreatePostImageUploadInput) =>
  apiPost<CreatePostImageUploadResponse, CreatePostImageUploadInput>(
    "/api/uploads/post-images",
    input
  );

export const uploadFileToPresignedUrl = ({
  file,
  headers,
  onProgress,
  url
}: {
  file: File;
  headers: Record<string, string>;
  onProgress: (progress: number) => void;
  url: string;
}) =>
  new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();

    request.open("PUT", url);

    for (const [name, value] of Object.entries(headers)) {
      request.setRequestHeader(name, value);
    }

    request.upload.onprogress = (event) => {
      if (!event.lengthComputable) {
        return;
      }

      onProgress(Math.round((event.loaded / event.total) * 100));
    };

    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress(100);
        resolve();
        return;
      }

      reject(new Error(`Upload failed with status ${request.status}.`));
    };

    request.onerror = () => {
      reject(new Error("Could not upload the image."));
    };

    request.onabort = () => {
      reject(new Error("The upload was cancelled."));
    };

    request.send(file);
  });
