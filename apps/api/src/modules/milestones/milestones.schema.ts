import { z } from "zod";

export const listMilestonesQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(100)
  })
  .strict();

export type ListMilestonesQuery = z.infer<typeof listMilestonesQuerySchema>;
