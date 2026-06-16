import { type ChangeEvent, useEffect, useState } from "react";
import { ImagePlus, X } from "lucide-react";

import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import type { FileAsset } from "@/features/uploads/api/uploads";
import { usePostImageUpload } from "@/features/uploads/hooks/use-post-image-upload";

type PostImageUploadFieldProps = {
  clubSlug: string;
  disabled: boolean;
  onAssetChange: (assetId: string | undefined) => void;
  onPendingImageChange: (hasPendingImage: boolean) => void;
};

export const PostImageUploadField = ({
  clubSlug,
  disabled,
  onAssetChange,
  onPendingImageChange
}: PostImageUploadFieldProps) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [safePreview, setSafePreview] = useState(false);
  const [completedAsset, setCompletedAsset] = useState<FileAsset | null>(null);
  const upload = usePostImageUpload({
    clubSlug,
    onCompleted: (asset) => {
      setCompletedAsset(asset);
      onAssetChange(asset.id);
      onPendingImageChange(false);
    }
  });

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(selectedFile);
    setPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [selectedFile]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;

    setSelectedFile(file);
    setCompletedAsset(null);
    onAssetChange(undefined);
    onPendingImageChange(!!file);
  };

  const handleSafePreviewChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSafePreview(event.target.checked);

    if (completedAsset) {
      setCompletedAsset(null);
      onAssetChange(undefined);
      onPendingImageChange(true);
    }
  };

  const clearImage = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setCompletedAsset(null);
    onAssetChange(undefined);
    onPendingImageChange(false);
  };

  const uploadSelectedImage = () => {
    if (!selectedFile) {
      return;
    }

    void upload.uploadFile({
      file: selectedFile,
      safePreview
    });
  };

  return (
    <div className="space-y-3 rounded-lg border border-default bg-inset p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-medium text-secondary">
          <ImagePlus className="size-4 text-brand" />
          Image
        </div>
        {selectedFile ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={disabled || upload.isUploading}
            onClick={clearImage}
          >
            <X />
            Remove
          </Button>
        ) : null}
      </div>

      {previewUrl ? (
        <img
          src={previewUrl}
          alt=""
          className="max-h-56 w-full rounded-lg border border-subtle object-cover"
        />
      ) : null}

      <Input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={disabled || upload.isUploading}
        onChange={handleFileChange}
      />

      {selectedFile ? (
        <label className="flex items-start gap-2 text-xs leading-5 text-muted">
          <input
            type="checkbox"
            className="mt-1 size-4 rounded border-subtle bg-surface accent-primary"
            checked={safePreview}
            disabled={disabled || upload.isUploading}
            onChange={handleSafePreviewChange}
          />
          This image is safe to preview on locked post cards.
        </label>
      ) : null}

      {upload.error ? (
        <p className="text-xs text-warning">{upload.error}</p>
      ) : null}

      {upload.isUploading ? (
        <div className="h-2 overflow-hidden rounded-full bg-surface">
          <div
            className="h-full bg-brand transition-all"
            style={{ width: `${upload.progress}%` }}
          />
        </div>
      ) : null}

      {selectedFile ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-faint">
            {completedAsset ? "Image ready" : "Upload before creating the post."}
          </p>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={disabled || upload.isUploading || !!completedAsset}
            onClick={uploadSelectedImage}
          >
            {upload.isUploading ? "Uploading..." : "Upload image"}
          </Button>
        </div>
      ) : null}
    </div>
  );
};
