import {
  type InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient
} from "@tanstack/react-query";

import { apiGet, apiPost } from "@/shared/api/api-client";

export type NotificationType =
  | "POST_COMMENT"
  | "COMMENT_REPLY"
  | "PROGRESS_UNLOCK"
  | "MODERATION_WARNING";

export type NotificationItem = {
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
  requiredMilestone: {
    id: string;
    position: number;
    label: string;
  };
  readAt: string | null;
  createdAt: string;
};

export type NotificationsResponse = {
  notifications: NotificationItem[];
  unreadCount: number;
  pagination: {
    limit: number;
    nextCursor: string | null;
    hasMore: boolean;
  };
};

export type MarkNotificationReadResponse = {
  notification: NotificationItem;
  unreadCount: number;
};

export const notificationsQueryKeys = {
  root: ["notifications"] as const,
  unread: ["notifications", "unread"] as const,
  list: ["notifications", "list"] as const
};

export const getNotifications = (
  cursor: string | null = null,
  limit = 20
) => {
  const params = new URLSearchParams({
    limit: String(limit)
  });

  if (cursor) {
    params.set("cursor", cursor);
  }

  return apiGet<NotificationsResponse>(`/api/notifications?${params}`);
};

export const markNotificationRead = (notificationId: string) =>
  apiPost<MarkNotificationReadResponse>(
    `/api/notifications/${notificationId}/read`
  );

export const useNotificationsInfiniteQuery = () =>
  useInfiniteQuery({
    queryKey: notificationsQueryKeys.list,
    queryFn: ({ pageParam }) => getNotifications(pageParam, 20),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.pagination.nextCursor
  });

export const useUnreadNotificationsQuery = (enabled = true) =>
  useQuery({
    queryKey: notificationsQueryKeys.unread,
    queryFn: () => getNotifications(null, 1),
    enabled
  });

export const useMarkNotificationReadMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: markNotificationRead,
    onSuccess: (response) => {
      queryClient.setQueryData<NotificationsResponse>(
        notificationsQueryKeys.unread,
        (currentResponse) =>
          currentResponse
            ? {
                ...currentResponse,
                unreadCount: response.unreadCount
              }
            : currentResponse
      );
      queryClient.setQueryData<InfiniteData<NotificationsResponse>>(
        notificationsQueryKeys.list,
        (currentData) =>
          currentData
            ? {
                ...currentData,
                pages: currentData.pages.map((page) => ({
                  ...page,
                  unreadCount: response.unreadCount,
                  notifications: page.notifications.map((notification) =>
                    notification.id === response.notification.id
                      ? response.notification
                      : notification
                  )
                }))
              }
            : currentData
      );
      void queryClient.invalidateQueries({
        queryKey: notificationsQueryKeys.root
      });
    }
  });
};
