import { z } from "zod";

const displayNameSchema = z
  .string()
  .trim()
  .min(2)
  .max(80);

const bioSchema = z
  .string()
  .trim()
  .max(160)
  .transform((value) => (value ? value : null));

export const updateCurrentUserProfileRequestSchema = z
  .object({
    displayName: displayNameSchema.optional(),
    bio: bioSchema.optional()
  })
  .strict()
  .refine((input) => Object.keys(input).length > 0);

export type UpdateCurrentUserProfileRequest = z.infer<
  typeof updateCurrentUserProfileRequestSchema
>;

export const listCurrentUserClubsQuerySchema = z
  .object({
    q: z.string().trim().max(120).default(""),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20)
  })
  .strict();

export type ListCurrentUserClubsQuery = z.infer<
  typeof listCurrentUserClubsQuerySchema
>;
