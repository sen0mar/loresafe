import { useState } from "react";

import { ApiError } from "@/shared/api/api-client";

import {
  completePublicAssetUpload,
  createPostImageUpload,
  type FileAsset,
  uploadFileToPresignedUrl
} from "../api/uploads.js";
import { validatePostImageFile } from "../lib/public-asset-validation.js";

type UploadStatus = "idle" | "requesting" | "uploading" | "completing";

export const usePostImageUpload = ({
  clubSlug,
  onCompleted
}: {
  clubSlug: string;
  onCompleted: (asset: FileAsset) => void | Promise<void>;
}) => {
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const uploadFile = async ({
    file,
    safePreview
  }: {
    file: File;
    safePreview: boolean;
  }) => {
    const validationError = validatePostImageFile(file);

    if (validationError) {
      setError(validationError);
      setProgress(0);
      return;
    }

    try {
      setError(null);
      setProgress(0);
      setStatus("requesting");

      const intent = await createPostImageUpload({
        clubSlug,
        contentType: file.type,
        sizeBytes: file.size,
        safePreview
      });

      setStatus("uploading");
      await uploadFileToPresignedUrl({
        file,
        url: intent.upload.url,
        headers: intent.upload.requiredHeaders,
        onProgress: setProgress
      });

      setStatus("completing");
      const completed = await completePublicAssetUpload(intent.asset.id);
      await onCompleted(completed.asset);
      setProgress(100);
      setStatus("idle");
    } catch (uploadError) {
      setError(getUploadErrorMessage(uploadError));
      setStatus("idle");
    }
  };

  return {
    error,
    isUploading: status !== "idle",
    progress,
    status,
    uploadFile
  };
};

const getUploadErrorMessage = (error: unknown) => {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Could not upload the image. Try again.";
};
