import {
  Bell,
  Check,
  ChevronRight,
  LockKeyhole,
  MessageCircle,
  RefreshCw,
  Sparkles
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { AuthenticatedAppShell } from "@/features/auth/components/authenticated-app-shell";
import {
  type NotificationItem,
  notificationsQueryKeys,
  useMarkNotificationReadMutation,
  useNotificationsInfiniteQuery
} from "@/features/notifications/api/notifications";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { cn } from "@/shared/lib/utils";

const notificationTypeLabels: Record<NotificationItem["type"], string> = {
  POST_COMMENT: "Comment",
  COMMENT_REPLY: "Reply",
  PROGRESS_UNLOCK: "Unlocked",
  MODERATION_WARNING: "Warning"
};

export const NotificationsPage = () => {
  const queryClient = useQueryClient();
  const notificationsQuery = useNotificationsInfiniteQuery();
  const markReadMutation = useMarkNotificationReadMutation();
  const notifications =
    notificationsQuery.data?.pages.flatMap((page) => page.notifications) ?? [];
  const unreadCount = notificationsQuery.data?.pages[0]?.unreadCount ?? 0;
  const hasMore =
    notificationsQuery.data?.pages.at(-1)?.pagination.hasMore ?? false;
  const isRefreshing =
    notificationsQuery.isFetching && !notificationsQuery.isFetchingNextPage;

  const refreshNotifications = () => {
    void queryClient.invalidateQueries({
      queryKey: notificationsQueryKeys.root
    });
  };

  const markRead = (notification: NotificationItem) => {
    if (notification.readAt) {
      return;
    }

    markReadMutation.mutate(notification.id, {
      onError: () => {
        toast.error("Could not mark notification as read.");
      }
    });
  };

  return (
    <AuthenticatedAppShell>
      <div className="space-y-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div>
              <CardTitle>Notifications</CardTitle>
              <p className="mt-1 text-sm text-muted">
                {unreadCount === 0
                  ? "Everything is read."
                  : `${unreadCount} unread`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Refresh notifications"
                disabled={isRefreshing}
                onClick={refreshNotifications}
              >
                <RefreshCw
                  className={cn("size-4", isRefreshing && "animate-spin")}
                />
              </Button>
              <span className="flex size-10 items-center justify-center rounded-xl border border-brand bg-active text-brand">
                <Bell className="size-5" />
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {notificationsQuery.isPending ? (
              <NotificationsLoading />
            ) : notificationsQuery.isError ? (
              <NotificationsError
                onRetry={() => void notificationsQuery.refetch()}
              />
            ) : notifications.length === 0 ? (
              <NotificationsEmpty />
            ) : (
              <>
                <div className="space-y-2">
                  {notifications.map((notification) => (
                    <NotificationRow
                      key={notification.id}
                      notification={notification}
                      isMarkingRead={
                        markReadMutation.isPending &&
                        markReadMutation.variables === notification.id
                      }
                      onMarkRead={() => markRead(notification)}
                    />
                  ))}
                </div>
                {hasMore ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    disabled={notificationsQuery.isFetchingNextPage}
                    onClick={() => void notificationsQuery.fetchNextPage()}
                  >
                    {notificationsQuery.isFetchingNextPage
                      ? "Loading..."
                      : "Load more"}
                  </Button>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </AuthenticatedAppShell>
  );
};

const NotificationRow = ({
  notification,
  isMarkingRead,
  onMarkRead
}: {
  notification: NotificationItem;
  isMarkingRead: boolean;
  onMarkRead: () => void;
}) => {
  const isUnread = !notification.readAt;
  const isLocked = notification.visibility === "LOCKED";
  const targetPath =
    notification.type === "MODERATION_WARNING"
      ? `/app/clubs/${notification.club.slug}`
      : notification.postId
    ? `/app/posts/${notification.postId}`
    : notification.type === "PROGRESS_UNLOCK"
      ? `/app/clubs/${notification.club.slug}/recently-unlocked`
    : `/app/clubs/${notification.club.slug}`;

  return (
    <article
      className={cn(
        "rounded-xl border border-default bg-surface p-4 transition-colors duration-150",
        isUnread && "border-brand bg-active"
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border border-default bg-inset text-muted",
            isUnread && "border-brand text-brand"
          )}
        >
          {notification.type === "PROGRESS_UNLOCK" ? (
            <Sparkles className="size-4" />
          ) : notification.type === "MODERATION_WARNING" ? (
            <Bell className="size-4" />
          ) : isLocked ? (
            <LockKeyhole className="size-4" />
          ) : (
            <MessageCircle className="size-4" />
          )}
        </span>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={isUnread ? "default" : "secondary"}>
              {notificationTypeLabels[notification.type]}
            </Badge>
            {isLocked ? <Badge variant="outline">Locked</Badge> : null}
            <span className="text-xs text-faint">
              {formatNotificationTime(notification.createdAt)}
            </span>
          </div>
          <div>
            <p className="text-sm font-medium leading-5 text-primary">
              {notification.safeText}
            </p>
            <p className="mt-1 text-xs leading-5 text-faint">
              Milestone {notification.requiredMilestone.position}:{" "}
              {notification.requiredMilestone.label}
            </p>
          </div>
          <div className="grid gap-2 sm:flex sm:flex-wrap sm:items-center">
            <Button asChild variant="ghost" size="sm" className="w-full sm:w-fit">
              <Link to={targetPath}>
                Open
                <ChevronRight className="size-4" />
              </Link>
            </Button>
            {isUnread ? (
              <Button
                className="w-full sm:w-fit"
                type="button"
                variant="outline"
                size="sm"
                disabled={isMarkingRead}
                onClick={onMarkRead}
              >
                <Check className="size-4" />
                {isMarkingRead ? "Marking..." : "Mark read"}
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
};

const NotificationsLoading = () => (
  <div className="space-y-3">
    {Array.from({ length: 4 }).map((_, index) => (
      <Skeleton key={index} className="h-28 rounded-xl" />
    ))}
  </div>
);

const NotificationsEmpty = () => (
  <div className="rounded-xl border border-default bg-inset px-4 py-10 text-center">
    <Bell className="mx-auto size-8 text-faint" />
    <p className="mt-3 text-sm font-medium text-primary">No notifications yet</p>
    <p className="mt-1 text-sm text-muted">
      Comment and reply activity will appear here.
    </p>
  </div>
);

const NotificationsError = ({ onRetry }: { onRetry: () => void }) => (
  <div className="rounded-xl border border-default bg-inset px-4 py-8 text-center">
    <p className="text-sm font-medium text-primary">
      Notifications could not load.
    </p>
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="mt-4"
      onClick={onRetry}
    >
      Retry
    </Button>
  </div>
);

const notificationTimeFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit"
});

const formatNotificationTime = (value: string) =>
  notificationTimeFormatter.format(new Date(value));
