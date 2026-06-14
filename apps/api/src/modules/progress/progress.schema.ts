import { z } from "zod";

export const progressModeSchema = z.enum([
  "STRICT",
  "SOFT",
  "BRAVE",
  "FINISHED"
]);

export const updateProgressRequestSchema = z
  .object({
    currentMilestoneId: z.uuid().nullable(),
    mode: progressModeSchema
  })
  .strict();

export type ProgressMode = z.infer<typeof progressModeSchema>;
export type UpdateProgressRequest = z.infer<
  typeof updateProgressRequestSchema
>;
