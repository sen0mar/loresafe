import { z } from "zod";

const optionalTrimmedText = (maxLength: number, message: string) =>
  z
    .string()
    .trim()
    .max(maxLength, message)
    .transform((value) => (value.length > 0 ? value : null))
    .optional();

export const createMilestoneFormSchema = z.object({
  safeTitle: z
    .string()
    .trim()
    .min(2, "Safe title must be at least 2 characters.")
    .max(120, "Safe title must be 120 characters or fewer."),
  fullTitle: optionalTrimmedText(
    160,
    "Full title must be 160 characters or fewer."
  ),
  description: optionalTrimmedText(
    500,
    "Description must be 500 characters or fewer."
  ),
  spoilerName: z.boolean()
});

export const createMilestoneTemplateFormSchema = z.object({
  template: z.enum([
    "BOOK",
    "SHOW",
    "MOVIE",
    "GAME",
    "PODCAST_COURSE",
    "CUSTOM"
  ]),
  count: z.number().int("Count must be a whole number.").min(1).max(200)
});

export type CreateMilestoneFormValues = z.input<
  typeof createMilestoneFormSchema
>;
export type CreateMilestonePayload = z.output<
  typeof createMilestoneFormSchema
>;
export type CreateMilestoneTemplateFormValues = z.input<
  typeof createMilestoneTemplateFormSchema
>;
export type CreateMilestoneTemplatePayload = z.output<
  typeof createMilestoneTemplateFormSchema
>;
