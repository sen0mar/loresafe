import { useState } from "react";

import { ApiError } from "@/shared/api/api-client";

import {
  completePublicAssetUpload,
  createPublicAssetUpload,
  type FileAsset,
  uploadFileToPresignedUrl
} from "../api/uploads.js";
import {
  type PublicAssetPurpose,
  validatePublicAssetFile
} from "../lib/public-asset-validation.js";

type UploadStatus = "idle" | "requesting" | "uploading" | "completing";

export const usePublicAssetUpload = ({
  clubLinkName,
  onCompleted,
  purpose
}: {
  clubLinkName?: string;
  onCompleted: (asset: FileAsset) => void | Promise<void>;
  purpose: PublicAssetPurpose;
}) => {
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const uploadFile = async (file: File) => {
    const validationError = validatePublicAssetFile(file, purpose);

    if (validationError) {
      setError(validationError);
      setProgress(0);
      return;
    }

    try {
      setError(null);
      setProgress(0);
      setStatus("requesting");

      const intent = await createPublicAssetUpload({
        purpose,
        contentType: file.type,
        sizeBytes: file.size,
        ...(clubLinkName ? { clubLinkName } : {})
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
