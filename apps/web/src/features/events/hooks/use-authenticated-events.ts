import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import {
  clubsQueryKeys,
  invalidateClubProgressDependencies
} from "@/features/clubs/api/clubs";
import { notificationsQueryKeys } from "@/features/notifications/api/notifications";
import { apiBaseUrl } from "@/shared/api/api-client";

type NotificationEventPayload = {
  notificationId: string;
  club: {
    id: string;
    linkName: string;
  };
  postId: string | null;
  commentId: string | null;
  occurredAt: string;
};

const notificationEventNames = ["notification.created", "notification.read"];

export const useAuthenticatedEvents = (enabled: boolean) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let eventSource: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let isClosed = false;
    const onNotificationEvent = (event: MessageEvent<string>) => {
      const payload = parseNotificationEventPayload(event.data);

      if (!payload) {
        return;
      }

      void queryClient.invalidateQueries({
        queryKey: notificationsQueryKeys.root
      });
      invalidateClubProgressDependencies(queryClient, payload.club.linkName);

      if (payload.postId) {
        void queryClient.invalidateQueries({
          queryKey: clubsQueryKeys.postDetail(payload.postId)
        });
        void queryClient.invalidateQueries({
          queryKey: clubsQueryKeys.postComments(payload.postId)
        });
      }
    };
    const connect = () => {
      eventSource?.close();
      eventSource = new EventSource(`${apiBaseUrl}/api/events`, {
        withCredentials: true
      });

      for (const eventName of notificationEventNames) {
        eventSource.addEventListener(eventName, onNotificationEvent);
      }

      eventSource.onerror = () => {
        if (isClosed) {
          return;
        }

        eventSource?.close();

        if (reconnectTimer) {
          return;
        }

        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          connect();
        }, 3000);
      };
    };

    connect();

    return () => {
      isClosed = true;

      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }

      eventSource?.close();
    };
  }, [enabled, queryClient]);
};

const parseNotificationEventPayload = (
  value: string
): NotificationEventPayload | null => {
  try {
    const parsed = JSON.parse(value) as unknown;

    if (!isNotificationEventPayload(parsed)) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
};

const isNotificationEventPayload = (
  value: unknown
): value is NotificationEventPayload => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const payload = value as Partial<NotificationEventPayload>;

  return (
    typeof payload.notificationId === "string" &&
    !!payload.club &&
    typeof payload.club === "object" &&
    typeof payload.club.id === "string" &&
    typeof payload.club.linkName === "string" &&
    (typeof payload.postId === "string" || payload.postId === null) &&
    (typeof payload.commentId === "string" || payload.commentId === null) &&
    typeof payload.occurredAt === "string"
  );
};
