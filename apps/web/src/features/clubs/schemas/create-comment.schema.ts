import { z } from "zod";

export const createCommentSchema = z
  .object({
    body: z.string().trim().min(1).max(8000),
    parentId: z.uuid().optional(),
    requiredMilestoneId: z.uuid().optional()
  })
  .strict();

export type CreateCommentFormValues = z.input<typeof createCommentSchema>;
