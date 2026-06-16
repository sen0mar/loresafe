import { z } from "zod";

import { clubSlugSchema } from "../clubs/clubs.schema.js";

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

export const moderationReportStatusSchema = z
  .enum(["OPEN", "RESOLVED", "DISMISSED"])
  .default("OPEN");

export const listModerationReportsQuerySchema = z
  .object({
    status: moderationReportStatusSchema,
    cursor: z.string().trim().min(1).max(512).optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20)
  })
  .strict();

export const clubModerationReportsParamsSchema = z
  .object({
    slug: clubSlugSchema
  })
  .strict();

export const moderationReportRevealParamsSchema = z
  .object({
    slug: clubSlugSchema,
    reportId: z.uuid()
  })
  .strict();

export type ReportTargetType = z.infer<typeof reportTargetTypeSchema>;
export type ReportReason = z.infer<typeof reportReasonSchema>;
export type CreateReportRequest = z.infer<typeof createReportRequestSchema>;
export type ModerationReportStatus = z.infer<
  typeof moderationReportStatusSchema
>;
export type ListModerationReportsQuery = z.infer<
  typeof listModerationReportsQuerySchema
>;
