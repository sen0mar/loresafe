export type PublicAssetPurpose = "AVATAR" | "CLUB_COVER";

export const allowedPublicAssetContentTypes = [
  "image/jpeg",
  "image/png",
  "image/webp"
] as const;

export const publicAssetMaxSizeBytes: Record<PublicAssetPurpose, number> = {
  AVATAR: 2 * 1024 * 1024,
  CLUB_COVER: 5 * 1024 * 1024
};

const allowedContentTypeSet = new Set<string>(allowedPublicAssetContentTypes);
export const postImageMaxSizeBytes = 8 * 1024 * 1024;

export const validatePublicAssetFile = (
  file: File,
  purpose: PublicAssetPurpose
) => {
  if (!allowedContentTypeSet.has(file.type)) {
    return "Choose a JPEG, PNG, or WebP image.";
  }

  if (file.size > publicAssetMaxSizeBytes[purpose]) {
    return purpose === "AVATAR"
      ? "Avatar images must be 2 MB or smaller."
      : "Club cover images must be 5 MB or smaller.";
  }

  return null;
};

export const validatePostImageFile = (file: File) => {
  if (!allowedContentTypeSet.has(file.type)) {
    return "Choose a JPEG, PNG, or WebP image.";
  }

  if (file.size > postImageMaxSizeBytes) {
    return "Post images must be 8 MB or smaller.";
  }

  return null;
};
