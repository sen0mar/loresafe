import { z } from "zod";

import { clubLinkNameSchema } from "../clubs/clubs.schema.js";

export const postReactionEmojis = ["👍", "❤️", "😂", "😮", "👀"] as const;

export const postReactionEmojiSchema = z.enum(postReactionEmojis);

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

export const clubFeedTabSchema = z
  .enum(["safe", "unanswered", "locked", "all", "my-posts"])
  .default("all");

export const listClubPostsQuerySchema = z
  .object({
    tab: clubFeedTabSchema,
    cursor: z.string().trim().min(1).max(512).optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20)
  })
  .strict();

export const createClubPostRequestSchema = z
  .object({
    title: z.string().trim().min(2).max(160),
    body: z.string().trim().min(1).max(8000),
    type: postTypeSchema,
    requiredMilestoneId: z.uuid(),
    mediaAssetId: z.uuid().optional(),
    prediction: z
      .object({
        revealMilestoneId: z.uuid()
      })
      .strict()
      .optional()
  })
  .strict()
  .superRefine((input, context) => {
    if (input.type === "PREDICTION" && !input.prediction) {
      context.addIssue({
        code: "custom",
        path: ["prediction"],
        message: "Prediction details are required."
      });
      return;
    }

    if (input.type !== "PREDICTION" && input.prediction) {
      context.addIssue({
        code: "custom",
        path: ["prediction"],
        message: "Prediction details are only allowed for prediction posts."
      });
    }
  });

export const togglePostReactionRequestSchema = z
  .object({
    emoji: postReactionEmojiSchema
  })
  .strict();

export const clubPostsParamsSchema = z
  .object({
    linkName: clubLinkNameSchema
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
export type PostReactionEmoji = z.infer<typeof postReactionEmojiSchema>;
export type TogglePostReactionRequest = z.infer<
  typeof togglePostReactionRequestSchema
>;
export type ClubFeedTab = z.infer<typeof clubFeedTabSchema>;
export type ListClubPostsQuery = z.infer<typeof listClubPostsQuerySchema>;
