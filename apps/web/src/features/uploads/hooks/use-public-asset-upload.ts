import { createPublicAssetUpload, type FileAsset } from "../api/uploads.js";
import {
  type PublicAssetPurpose,
  validatePublicAssetFile
} from "../lib/public-asset-validation.js";
import { useFileUploadWorkflow } from "./use-file-upload-workflow.js";

export const usePublicAssetUpload = ({
  clubLinkName,
  onCompleted,
  purpose
}: {
  clubLinkName?: string;
  onCompleted: (asset: FileAsset) => void | Promise<void>;
  purpose: PublicAssetPurpose;
}) => {
  return useFileUploadWorkflow({
    createIntent: (file, options) =>
      createPublicAssetUpload(
        {
          purpose,
          contentType: file.type,
          sizeBytes: file.size,
          ...(clubLinkName ? { clubLinkName } : {})
        },
        options
      ),
    onCompleted,
    validateFile: (file) => validatePublicAssetFile(file, purpose)
  });
};
