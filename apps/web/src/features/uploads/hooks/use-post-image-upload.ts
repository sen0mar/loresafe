import { createPostImageUpload, type FileAsset } from "../api/uploads.js";
import { validatePostImageFile } from "../lib/public-asset-validation.js";
import { useFileUploadWorkflow } from "./use-file-upload-workflow.js";

export const usePostImageUpload = ({
  clubLinkName,
  onCompleted
}: {
  clubLinkName: string;
  onCompleted: (asset: FileAsset) => void | Promise<void>;
}) => {
  return useFileUploadWorkflow({
    createIntent: (file, options) =>
      createPostImageUpload(
        {
          clubLinkName,
          contentType: file.type,
          sizeBytes: file.size
        },
        options
      ),
    onCompleted,
    validateFile: validatePostImageFile
  });
};
