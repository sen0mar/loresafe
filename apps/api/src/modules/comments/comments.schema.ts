import { z } from "zod";

export const postCommentsParamsSchema = z
  .object({
    postId: z.uuid()
  })
  .strict();

export const createPostCommentRequestSchema = z
  .object({
    body: z.string().trim().min(1).max(8000),
    parentId: z.uuid().optional()
  })
  .strict();

export type PostCommentsParams = z.infer<typeof postCommentsParamsSchema>;
export type CreatePostCommentRequest = z.infer<
  typeof createPostCommentRequestSchema
>;
