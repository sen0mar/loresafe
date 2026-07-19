import type { ChangeEvent } from "react";
import { ImageUp } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { usePublicAssetUpload } from "@/features/uploads/hooks/use-public-asset-upload";
import { Button } from "@/shared/components/ui/button";

import { type Club, refreshClubAssetQueries } from "../api/clubs.js";

export const ClubCoverUploadPanel = ({ club }: { club: Club }) => {
  const queryClient = useQueryClient();
  const role = club.membership.role;
  const canUploadCover = role === "OWNER" || role === "MODERATOR";
  const coverUpload = usePublicAssetUpload({
    purpose: "CLUB_COVER",
    clubLinkName: club.linkName,
    onCompleted: async () => {
      refreshClubAssetQueries(queryClient, club.linkName);
      toast.success("Club cover updated");
    }
  });

  if (!canUploadCover) {
    return null;
  }

  const uploadCover = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    void coverUpload.uploadFile(file);
  };

  return (
    <div className="rounded-lg border border-default bg-inset p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-medium text-primary">
            <ImageUp className="size-4 text-brand" />
            Club cover
          </h2>
          <p className="mt-1 text-sm text-muted">
            JPEG, PNG, or WebP up to 5 MB.
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          disabled={coverUpload.isUploading}
          asChild
        >
          <label htmlFor="club-cover-upload">
            <ImageUp />
            {coverUpload.isUploading ? "Uploading..." : "Choose image"}
          </label>
        </Button>
        <input
          id="club-cover-upload"
          className="sr-only"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={coverUpload.isUploading}
          onChange={uploadCover}
        />
      </div>
      {coverUpload.isUploading ? (
        <UploadProgress progress={coverUpload.progress} />
      ) : null}
      {coverUpload.error ? (
        <p className="mt-3 text-sm text-error" role="alert">
          {coverUpload.error}
        </p>
      ) : null}
    </div>
  );
};

const UploadProgress = ({ progress }: { progress: number }) => (
  <div className="mt-3 grid gap-2" aria-live="polite">
    <div className="h-2 overflow-hidden rounded-full bg-surface">
      <div
        className="h-full rounded-full bg-brand transition-all"
        style={{ width: `${progress}%` }}
      />
    </div>
    <p className="text-xs text-faint">{progress}% uploaded</p>
  </div>
);
