import { z } from "zod";

export const searchScopeSchema = z.enum(["all", "clubs", "posts"]).default("all");

export const searchQuerySchema = z
  .object({
    q: z.string().trim().max(120).default(""),
    scope: searchScopeSchema,
    cursor: z.string().trim().min(1).max(512).optional(),
    limit: z.coerce.number().int().min(1).max(20).default(10)
  })
  .strict();

export type SearchScope = z.infer<typeof searchScopeSchema>;
export type SearchQuery = z.infer<typeof searchQuerySchema>;
