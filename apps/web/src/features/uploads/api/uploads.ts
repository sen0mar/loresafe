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
  clubLinkName?: string;
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
  clubLinkName: string;
  contentType: string;
  sizeBytes: number;
};

export type CreatePostImageUploadResponse = CreatePublicAssetUploadResponse;

export type CompletePublicAssetUploadResponse = {
  asset: FileAsset;
};

export type UploadCancellation = {
  cancel: () => void;
  promise: Promise<void>;
};

const uploadTimeoutMs = 2 * 60 * 1000;

export const createPublicAssetUpload = (
  input: CreatePublicAssetUploadInput,
  options?: { signal?: AbortSignal }
) =>
  apiPost<CreatePublicAssetUploadResponse, CreatePublicAssetUploadInput>(
    "/api/uploads/public-assets",
    input,
    options
  );

export const completePublicAssetUpload = (
  assetId: string,
  options?: { signal?: AbortSignal }
) =>
  apiPost<CompletePublicAssetUploadResponse>(
    `/api/uploads/${assetId}/complete`,
    undefined,
    options
  );

export const createPostImageUpload = (
  input: CreatePostImageUploadInput,
  options?: { signal?: AbortSignal }
) =>
  apiPost<CreatePostImageUploadResponse, CreatePostImageUploadInput>(
    "/api/uploads/post-images",
    input,
    options
  );

export const uploadFileToPresignedUrl = ({
  file,
  headers,
  onProgress,
  signal,
  url
}: {
  file: File;
  headers: Record<string, string>;
  onProgress: (progress: number) => void;
  signal?: AbortSignal;
  url: string;
}): UploadCancellation => {
  const request = new XMLHttpRequest();
  const cancel = () => request.abort();
  const promise = new Promise<void>((resolve, reject) => {
    const abortFromSignal = () => cancel();
    const finish = (callback: () => void) => {
      signal?.removeEventListener("abort", abortFromSignal);
      callback();
    };

    request.open("PUT", url);
    request.timeout = uploadTimeoutMs;

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
        finish(resolve);
        return;
      }

      finish(() => reject(new Error(`Upload failed with status ${request.status}.`)));
    };

    request.onerror = () => {
      finish(() => reject(new Error("Could not upload the image.")));
    };

    request.onabort = () => {
      finish(() => reject(new DOMException("The upload was cancelled.", "AbortError")));
    };

    request.ontimeout = () => {
      finish(() => reject(new Error("The upload timed out. Please try again.")));
    };

    if (signal?.aborted) {
      finish(() => reject(new DOMException("The upload was cancelled.", "AbortError")));
      return;
    }

    signal?.addEventListener("abort", abortFromSignal, { once: true });
    request.send(file);
  });

  return { cancel, promise };
};
