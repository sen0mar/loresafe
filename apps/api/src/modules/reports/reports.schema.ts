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

export const moderationReportActionParamsSchema =
  moderationReportRevealParamsSchema;

export const moderatorNoteSchema = z.string().trim().min(1).max(1000);

export const moderationReportNoteRequestSchema = z
  .object({
    moderatorNote: moderatorNoteSchema.optional()
  })
  .strict();

export const moderationReportRequiredMilestoneRequestSchema = z
  .object({
    requiredMilestoneId: z.uuid(),
    moderatorNote: moderatorNoteSchema.optional()
  })
  .strict();

export const moderationReportBanRequestSchema = z
  .object({
    expiresAt: z
      .string()
      .datetime({ offset: true })
      .refine((value) => new Date(value).getTime() > Date.now(), {
        message: "Ban expiration must be in the future."
      })
      .optional(),
    moderatorNote: moderatorNoteSchema.optional()
  })
  .strict();

export const moderationReportResolveRequestSchema = z
  .object({
    status: z.enum(["RESOLVED", "DISMISSED"]),
    moderatorNote: moderatorNoteSchema.optional()
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
export type ModerationReportNoteRequest = z.infer<
  typeof moderationReportNoteRequestSchema
>;
export type ModerationReportRequiredMilestoneRequest = z.infer<
  typeof moderationReportRequiredMilestoneRequestSchema
>;
export type ModerationReportBanRequest = z.infer<
  typeof moderationReportBanRequestSchema
>;
export type ModerationReportResolveRequest = z.infer<
  typeof moderationReportResolveRequestSchema
>;
