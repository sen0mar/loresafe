import { z } from "zod";

import { clubSlugSchema } from "../clubs/clubs.schema.js";

export const listClubPostsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20)
  })
  .strict();

export const clubPostsParamsSchema = z
  .object({
    slug: clubSlugSchema
  })
  .strict();

export type ClubPostsParams = z.infer<typeof clubPostsParamsSchema>;
export type ListClubPostsQuery = z.infer<typeof listClubPostsQuerySchema>;
