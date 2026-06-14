import { z } from "zod";

const optionalTrimmedText = (maxLength: number) =>
  z
    .string()
    .trim()
    .max(maxLength)
    .transform((value) => (value.length > 0 ? value : null))
    .optional();

export const listMilestonesQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(100)
  })
  .strict();

export const createMilestoneRequestSchema = z
  .object({
    safeTitle: z.string().trim().min(2).max(120),
    fullTitle: optionalTrimmedText(160),
    description: optionalTrimmedText(500),
    spoilerName: z.boolean()
  })
  .strict();

export const milestoneTemplateSchema = z.enum([
  "BOOK",
  "SHOW",
  "MOVIE",
  "GAME",
  "PODCAST_COURSE",
  "CUSTOM"
]);

export const createMilestoneTemplateRequestSchema = z
  .object({
    template: milestoneTemplateSchema,
    count: z.number().int().min(1).max(200)
  })
  .strict();

export type ListMilestonesQuery = z.infer<typeof listMilestonesQuerySchema>;
export type CreateMilestoneRequest = z.infer<
  typeof createMilestoneRequestSchema
>;
export type MilestoneTemplate = z.infer<typeof milestoneTemplateSchema>;
export type CreateMilestoneTemplateRequest = z.infer<
  typeof createMilestoneTemplateRequestSchema
>;
