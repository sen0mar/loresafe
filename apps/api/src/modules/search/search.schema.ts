import { z } from "zod";

export const searchScopeSchema = z.enum(["all", "clubs", "posts"]).default("all");
export const searchFilterSchema = z.enum(["safe", "spoiler", "clubs", "posts"]);

export const searchQuerySchema = z
  .object({
    q: z.string().trim().max(120).default(""),
    scope: searchScopeSchema,
    filters: z
      .string()
      .trim()
      .max(120)
      .optional()
      .refine(
        (value) =>
          !value ||
          value
            .split(",")
            .every((filter) => searchFilterSchema.safeParse(filter).success),
        "Invalid search filter."
      ),
    cursor: z.string().trim().min(1).max(512).optional(),
    limit: z.coerce.number().int().min(1).max(20).default(10)
  })
  .strict();

export type SearchFilter = z.infer<typeof searchFilterSchema>;
export type SearchScope = z.infer<typeof searchScopeSchema>;
export type SearchQuery = z.infer<typeof searchQuerySchema>;
