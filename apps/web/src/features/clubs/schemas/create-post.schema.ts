import { z } from "zod";

const createPostTypeSchema = z.enum([
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
        message: "Choose a reveal milestone."
      });
      return;
    }

    if (input.type !== "PREDICTION" && input.prediction) {
      context.addIssue({
        code: "custom",
        path: ["prediction"],
        message: "Prediction details are only available for predictions."
      });
    }
  });

export type CreatePostFormValues = z.input<typeof createPostSchema>;
