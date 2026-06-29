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

export const milestoneParamsSchema = z
  .object({
    linkName: z
      .string()
      .trim()
      .toLowerCase()
      .min(3)
      .max(80)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    milestoneId: z.uuid()
  })
  .strict();

export const updateMilestoneRequestSchema = createMilestoneRequestSchema;

export const moveMilestoneRequestSchema = z
  .object({
    direction: z.enum(["UP", "DOWN"])
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
export type UpdateMilestoneRequest = z.infer<
  typeof updateMilestoneRequestSchema
>;
export type MoveMilestoneRequest = z.infer<typeof moveMilestoneRequestSchema>;
export type MilestoneTemplate = z.infer<typeof milestoneTemplateSchema>;
export type CreateMilestoneTemplateRequest = z.infer<
  typeof createMilestoneTemplateRequestSchema
>;
