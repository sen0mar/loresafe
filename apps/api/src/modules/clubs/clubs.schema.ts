import { z } from "zod";

export const listClubsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20)
  })
  .strict();

export type ListClubsQuery = z.infer<typeof listClubsQuerySchema>;
