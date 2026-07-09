import { z } from "zod";

export const progressModeSchema = z.enum([
  "STRICT",
  "BRAVE",
  "FINISHED"
]);

export const updateProgressRequestSchema = z
  .object({
    currentMilestoneId: z.uuid().nullable(),
    mode: progressModeSchema
  })
  .strict();

export const recentlyUnlockedQuerySchema = z
  .object({
    cursor: z.string().trim().min(1).max(512).optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20)
  })
  .strict();

export const progressCommandIdSchema = z.uuid();

export type ProgressMode = z.infer<typeof progressModeSchema>;
export type UpdateProgressRequest = z.infer<
  typeof updateProgressRequestSchema
>;
export type RecentlyUnlockedQuery = z.infer<
  typeof recentlyUnlockedQuerySchema
>;
