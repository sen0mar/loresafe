import { z } from "zod";

export const postCommentsParamsSchema = z
  .object({
    postId: z.uuid()
  })
  .strict();

export const revealPostCommentParamsSchema = z
  .object({
    postId: z.uuid(),
    commentId: z.uuid()
  })
  .strict();

export const createPostCommentRequestSchema = z
  .object({
    body: z.string().trim().min(1).max(8000),
    parentId: z.uuid().optional(),
    requiredMilestoneId: z.uuid().optional()
  })
  .strict();

export type PostCommentsParams = z.infer<typeof postCommentsParamsSchema>;
export type RevealPostCommentParams = z.infer<
  typeof revealPostCommentParamsSchema
>;
export type CreatePostCommentRequest = z.infer<
  typeof createPostCommentRequestSchema
>;
