import { z } from "zod";

export const notificationTypeSchema = z.enum([
  "POST_COMMENT",
  "COMMENT_REPLY",
  "PROGRESS_UNLOCK",
  "MODERATION_WARNING"
]);

export const listNotificationsQuerySchema = z
  .object({
    cursor: z.string().trim().min(1).max(512).optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20)
  })
  .strict();

export const notificationParamsSchema = z
  .object({
    id: z.uuid()
  })
  .strict();

export const deleteSelectedNotificationsBodySchema = z
  .object({
    notificationIds: z.array(z.uuid()).min(1).max(50)
  })
  .strict();

export type NotificationType = z.infer<typeof notificationTypeSchema>;
export type ListNotificationsQuery = z.infer<
  typeof listNotificationsQuerySchema
>;
export type NotificationParams = z.infer<typeof notificationParamsSchema>;
export type DeleteSelectedNotificationsBody = z.infer<
  typeof deleteSelectedNotificationsBodySchema
>;
