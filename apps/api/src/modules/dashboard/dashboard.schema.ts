import { z } from "zod";

export const popularDiscussionsQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(10).default(5)
  })
  .strict();

export const recentlyUnlockedSummaryQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(5).default(3)
  })
  .strict();

export type PopularDiscussionsQuery = z.infer<
  typeof popularDiscussionsQuerySchema
>;
export type RecentlyUnlockedSummaryQuery = z.infer<
  typeof recentlyUnlockedSummaryQuerySchema
>;
