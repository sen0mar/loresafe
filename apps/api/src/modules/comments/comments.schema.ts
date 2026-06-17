import { z } from "zod";

import {
  postReactionEmojiSchema,
  postReactionEmojis
} from "../posts/posts.schema.js";

export const commentReactionEmojis = postReactionEmojis;
export const commentReactionEmojiSchema = postReactionEmojiSchema;

export const postCommentsParamsSchema = z
  .object({
    postId: z.uuid()
  })
  .strict();

export const listPostCommentsQuerySchema = z
  .object({
    cursor: z.string().trim().min(1).max(512).optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20)
  })
  .strict();

export const revealPostCommentParamsSchema = z
  .object({
    postId: z.uuid(),
    commentId: z.uuid()
  })
  .strict();

export const commentReactionParamsSchema = z
  .object({
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

export const toggleCommentReactionRequestSchema = z
  .object({
    emoji: commentReactionEmojiSchema
  })
  .strict();

export type PostCommentsParams = z.infer<typeof postCommentsParamsSchema>;
export type ListPostCommentsQuery = z.infer<
  typeof listPostCommentsQuerySchema
>;
export type RevealPostCommentParams = z.infer<
  typeof revealPostCommentParamsSchema
>;
export type CommentReactionParams = z.infer<typeof commentReactionParamsSchema>;
export type CreatePostCommentRequest = z.infer<
  typeof createPostCommentRequestSchema
>;
export type CommentReactionEmoji = z.infer<typeof commentReactionEmojiSchema>;
export type ToggleCommentReactionRequest = z.infer<
  typeof toggleCommentReactionRequestSchema
>;
