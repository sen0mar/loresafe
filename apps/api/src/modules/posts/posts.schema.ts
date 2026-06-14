import { z } from "zod";

import { clubSlugSchema } from "../clubs/clubs.schema.js";

export const postTypeSchema = z.enum([
  "DISCUSSION",
  "QUESTION",
  "THEORY",
  "PREDICTION",
  "POLL",
  "REACTION",
  "REVIEW",
  "IMAGE_MEME",
  "QUOTE_COMMENTARY",
  "JUST_REACHED"
]);

export const listClubPostsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20)
  })
  .strict();

export const createClubPostRequestSchema = z
  .object({
    title: z.string().trim().min(2).max(160),
    body: z.string().trim().min(1).max(8000),
    type: postTypeSchema,
    requiredMilestoneId: z.uuid()
  })
  .strict();

export const clubPostsParamsSchema = z
  .object({
    slug: clubSlugSchema
  })
  .strict();

export const postDetailParamsSchema = z
  .object({
    postId: z.uuid()
  })
  .strict();

export type ClubPostsParams = z.infer<typeof clubPostsParamsSchema>;
export type PostDetailParams = z.infer<typeof postDetailParamsSchema>;
export type CreateClubPostRequest = z.infer<
  typeof createClubPostRequestSchema
>;
export type ListClubPostsQuery = z.infer<typeof listClubPostsQuerySchema>;
