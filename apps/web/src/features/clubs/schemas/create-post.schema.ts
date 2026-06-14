import { z } from "zod";

export const createPostTypeSchema = z.enum([
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

export const createPostSchema = z
  .object({
    title: z.string().trim().min(2).max(160),
    body: z.string().trim().min(1).max(8000),
    type: createPostTypeSchema,
    requiredMilestoneId: z.uuid()
  })
  .strict();

export type CreatePostFormValues = z.input<typeof createPostSchema>;
