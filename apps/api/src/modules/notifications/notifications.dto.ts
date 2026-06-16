import { canViewRequiredMilestone } from "../spoilers/spoiler.policy.js";
import type { NotificationRecord } from "./notifications.repository.js";
import type { NotificationType } from "./notifications.schema.js";

type RequiredMilestoneDto = {
  id: string;
  position: number;
  label: string;
};

export type NotificationDto = {
  id: string;
  visibility: "VISIBLE" | "LOCKED";
  type: NotificationType;
  safeText: string;
  club: {
    id: string;
    title: string;
    slug: string;
  };
  postId: string | null;
  commentId: string | null;
  requiredMilestone: RequiredMilestoneDto;
  readAt: string | null;
  createdAt: string;
};

export type NotificationsResponse = {
  notifications: NotificationDto[];
  unreadCount: number;
  pagination: {
    limit: number;
    nextCursor: string | null;
    hasMore: boolean;
  };
};

export type MarkNotificationReadResponse = {
  notification: NotificationDto;
  unreadCount: number;
};

export const toNotificationDto = (
  notification: NotificationRecord
): NotificationDto => {
  const requiredMilestone = {
    id: notification.requiredMilestone.id,
    position: notification.requiredMilestone.position,
    label: notification.requiredMilestone.safeTitle
  };
  const isVisible = canViewRequiredMilestone({
    mode: notification.progress.mode,
    currentMilestonePosition: notification.progress.currentMilestonePosition,
    requiredMilestonePosition: notification.requiredMilestone.position
  });

  return {
    id: notification.id,
    visibility: isVisible ? "VISIBLE" : "LOCKED",
    type: notification.type,
    safeText: notification.safeText,
    club: notification.club,
    postId: notification.postId,
    commentId: notification.commentId,
    requiredMilestone,
    readAt: notification.readAt?.toISOString() ?? null,
    createdAt: notification.createdAt.toISOString()
  };
};
