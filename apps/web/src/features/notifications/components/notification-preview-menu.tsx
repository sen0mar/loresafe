import { useQuery } from "@tanstack/react-query";
import { Bell, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

import { getClubFeedPath } from "@/features/clubs/lib/club-paths";
import {
  getNotifications,
  type NotificationItem,
  notificationsQueryKeys
} from "@/features/notifications/api/notifications";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/shared/components/ui/dropdown-menu";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { cn } from "@/shared/lib/utils";

type NotificationPreviewMenuProps = {
  unreadCount: number;
};

const previewLimit = 3;

export const NotificationPreviewMenu = ({
  unreadCount
}: NotificationPreviewMenuProps) => {
  const notificationsQuery = useQuery({
    queryKey: notificationsQueryKeys.preview,
    queryFn: ({ signal }) => getNotifications(null, previewLimit, signal),
    refetchOnWindowFocus: true
  });
  const notifications = notificationsQuery.data?.notifications ?? [];

  return (
    <DropdownMenu
      onOpenChange={(isOpen) => {
        if (isOpen) {
          void notificationsQuery.refetch();
        }
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="relative"
          aria-label="Notifications"
        >
          <Bell />
          {unreadCount > 0 ? (
            <Badge className="absolute -right-1 -top-1 px-1.5 py-0 text-[0.625rem]">
              {formatNotificationBadgeCount(unreadCount)}
            </Badge>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={10} className="w-80 p-2">
        <div className="flex items-center justify-between gap-3 px-2 py-1.5">
          <p className="text-sm font-medium text-primary">Notifications</p>
          <span className="text-xs text-faint">
            {unreadCount === 0 ? "All read" : `${unreadCount} unread`}
          </span>
        </div>
        <DropdownMenuSeparator className="my-2" />
        {notificationsQuery.isPending ? (
          <NotificationPreviewLoading />
        ) : notificationsQuery.isError ? (
          <p className="px-2 py-4 text-sm text-muted">
            Notifications could not load.
          </p>
        ) : notifications.length === 0 ? (
          <p className="px-2 py-4 text-sm text-muted">No notifications yet.</p>
        ) : (
          <div className="space-y-1">
            {notifications.map((notification) => (
              <NotificationPreviewItem
                key={notification.id}
                notification={notification}
              />
            ))}
          </div>
        )}
        <DropdownMenuSeparator className="my-2" />
        <Button asChild variant="outline" size="sm" className="w-full">
          <Link to="/app/notifications">
            See all
            <ChevronRight className="size-4" />
          </Link>
        </Button>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const NotificationPreviewItem = ({
  notification
}: {
  notification: NotificationItem;
}) => {
  const isUnread = !notification.readAt;
  const targetPath = getNotificationTargetPath(notification);

  return (
    <DropdownMenuItem asChild className="block p-0">
      <Link
        to={targetPath}
        className={cn(
          "block cursor-pointer rounded-lg p-3 outline-none transition-colors hover:bg-active focus:bg-active",
          isUnread && "bg-active"
        )}
      >
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 text-sm font-medium leading-5 text-primary">
            {notification.safeText}
          </span>
          <span className="mt-1 block truncate text-xs text-faint">
            {notification.club.title} -{" "}
            {formatNotificationPreviewTime(notification.createdAt)}
          </span>
        </span>
      </Link>
    </DropdownMenuItem>
  );
};

const NotificationPreviewLoading = () => (
  <div className="space-y-2 px-1 py-1">
    {Array.from({ length: 2 }).map((_, index) => (
      <Skeleton key={index} className="h-16 rounded-lg" />
    ))}
  </div>
);

const notificationPreviewTimeFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric"
});

const formatNotificationPreviewTime = (value: string) =>
  notificationPreviewTimeFormatter.format(new Date(value));

const formatNotificationBadgeCount = (count: number) =>
  count > 99 ? "99+" : String(count);

const getNotificationTargetPath = (notification: NotificationItem) => {
  if (notification.postId) {
    return `/app/posts/${notification.postId}`;
  }

  if (notification.type === "PROGRESS_UNLOCK") {
    return `/app/clubs/${notification.club.linkName}/recently-unlocked`;
  }

  return getClubFeedPath(notification.club.linkName);
};
