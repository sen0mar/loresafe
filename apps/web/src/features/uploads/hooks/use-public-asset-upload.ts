import { useEffect, useRef, useState } from "react";

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
  const activeController = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      activeController.current?.abort();
    },
    []
  );

  const uploadFile = async (file: File) => {
    const validationError = validatePublicAssetFile(file, purpose);

    if (validationError) {
      setError(validationError);
      setProgress(0);
      return;
    }

    activeController.current?.abort();
    const controller = new AbortController();
    activeController.current = controller;

    try {
      setError(null);
      setProgress(0);
      setStatus("requesting");

      const intent = await createPublicAssetUpload(
        {
          purpose,
          contentType: file.type,
          sizeBytes: file.size,
          ...(clubLinkName ? { clubLinkName } : {})
        },
        { signal: controller.signal }
      );

      setStatus("uploading");
      const upload = uploadFileToPresignedUrl({
        file,
        url: intent.upload.url,
        headers: intent.upload.requiredHeaders,
        onProgress: setProgress,
        signal: controller.signal
      });
      await upload.promise;

      setStatus("completing");
      const completed = await completePublicAssetUpload(intent.asset.id, {
        signal: controller.signal
      });
      await onCompleted(completed.asset);
      setProgress(100);
      setStatus("idle");
    } catch (uploadError) {
      if (controller.signal.aborted) {
        return;
      }

      setError(getUploadErrorMessage(uploadError));
      setStatus("idle");
    } finally {
      if (activeController.current === controller) {
        activeController.current = null;
      }
    }
  };

  return {
    error,
    isUploading: status !== "idle",
    progress,
    status,
    uploadFile,
    cancelUpload: () => activeController.current?.abort()
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
