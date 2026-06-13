import { z } from "zod";

const clubVisibilitySchema = z.enum(["PUBLIC", "PRIVATE", "INVITE_ONLY"]);

const optionalTrimmedText = (maxLength: number) =>
  z
    .string()
    .trim()
    .max(maxLength)
    .transform((value) => (value.length > 0 ? value : null))
    .optional();

export const clubSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const listClubsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20)
  })
  .strict();

export const createClubRequestSchema = z
  .object({
    title: z.string().trim().min(2).max(120),
    slug: clubSlugSchema,
    description: optionalTrimmedText(280),
    category: optionalTrimmedText(60),
    visibility: clubVisibilitySchema,
    rules: optionalTrimmedText(2000)
  })
  .strict();

export const clubSlugParamsSchema = z
  .object({
    slug: clubSlugSchema
  })
  .strict();

export type ListClubsQuery = z.infer<typeof listClubsQuerySchema>;
export type CreateClubRequest = z.infer<typeof createClubRequestSchema>;
export type ClubSlugParams = z.infer<typeof clubSlugParamsSchema>;
