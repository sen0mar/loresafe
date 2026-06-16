import { z } from "zod";

import { clubSlugSchema } from "../clubs/clubs.schema.js";

export const publicAssetPurposeSchema = z.enum(["AVATAR", "CLUB_COVER"]);

export const allowedPublicAssetContentTypes = [
  "image/jpeg",
  "image/png",
  "image/webp"
] as const;

export const publicAssetMaxSizeBytes = {
  AVATAR: 2 * 1024 * 1024,
  CLUB_COVER: 5 * 1024 * 1024
} as const;

export const createPublicAssetUploadRequestSchema = z
  .object({
    purpose: publicAssetPurposeSchema,
    contentType: z.enum(allowedPublicAssetContentTypes),
    sizeBytes: z.number().int().positive(),
    clubSlug: clubSlugSchema.optional()
  })
  .strict()
  .superRefine((value, context) => {
    if (value.sizeBytes > publicAssetMaxSizeBytes[value.purpose]) {
      context.addIssue({
        code: "custom",
        path: ["sizeBytes"],
        message: "File is too large."
      });
    }

    if (value.purpose === "AVATAR" && value.clubSlug) {
      context.addIssue({
        code: "custom",
        path: ["clubSlug"],
        message: "Avatar uploads do not accept a club."
      });
    }

    if (value.purpose === "CLUB_COVER" && !value.clubSlug) {
      context.addIssue({
        code: "custom",
        path: ["clubSlug"],
        message: "Club cover uploads require a club."
      });
    }
  });

export const assetIdParamsSchema = z
  .object({
    assetId: z.string().uuid()
  })
  .strict();

export type CreatePublicAssetUploadRequest = z.infer<
  typeof createPublicAssetUploadRequestSchema
>;

export type AssetIdParams = z.infer<typeof assetIdParamsSchema>;
