import { z } from "zod";

export const reportReasonSchema = z.enum([
  "SPOILER",
  "HARASSMENT",
  "HATE",
  "SPAM",
  "OFF_TOPIC",
  "OTHER"
]);

export const createReportSchema = z
  .object({
    reason: reportReasonSchema,
    details: z.string().trim().max(1000).optional()
  })
  .strict();

export type CreateReportFormValues = z.infer<typeof createReportSchema>;
