import { z } from "zod";

export const reportTargetTypeSchema = z.enum(["POST", "COMMENT"]);

export const reportReasonSchema = z.enum([
  "SPOILER",
  "HARASSMENT",
  "HATE",
  "SPAM",
  "OFF_TOPIC",
  "OTHER"
]);

export const createReportRequestSchema = z
  .object({
    targetType: reportTargetTypeSchema,
    targetId: z.uuid(),
    reason: reportReasonSchema,
    details: z.string().trim().min(1).max(1000).optional()
  })
  .strict();

export type ReportTargetType = z.infer<typeof reportTargetTypeSchema>;
export type ReportReason = z.infer<typeof reportReasonSchema>;
export type CreateReportRequest = z.infer<typeof createReportRequestSchema>;
