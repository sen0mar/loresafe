import {
  Bell,
  Check,
  CheckCheck,
  ChevronRight,
  LockKeyhole,
  MessageCircle,
  RefreshCw,
  Sparkles,
  Trash2
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { AuthenticatedAppShell } from "@/features/auth/components/authenticated-app-shell";
import {
  type NotificationItem,
  notificationsQueryKeys,
  useDeleteAllNotificationsMutation,
  useDeleteNotificationMutation,
  useMarkAllNotificationsReadMutation,
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
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/shared/components/ui/dialog";
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
  const markAllReadMutation = useMarkAllNotificationsReadMutation();
  const deleteNotificationMutation = useDeleteNotificationMutation();
  const deleteAllNotificationsMutation = useDeleteAllNotificationsMutation();
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

  const markAllRead = () => {
    if (unreadCount === 0 || markAllReadMutation.isPending) {
      return;
    }

    markAllReadMutation.mutate(undefined, {
      onSuccess: (response) => {
        toast.success(
          response.updatedCount === 0
            ? "Everything was already read."
            : "All notifications marked as read."
        );
      },
      onError: () => {
        toast.error("Could not mark notifications as read.");
      }
    });
  };

  const deleteNotification = (notification: NotificationItem) => {
    deleteNotificationMutation.mutate(notification.id, {
      onSuccess: () => {
        toast.success("Notification deleted.");
      },
      onError: () => {
        toast.error("Could not delete notification.");
      }
    });
  };

  const deleteAllNotifications = () => {
    if (
      notifications.length === 0 ||
      deleteAllNotificationsMutation.isPending
    ) {
      return;
    }

    deleteAllNotificationsMutation.mutate(undefined, {
      onSuccess: (response) => {
        toast.success(
          response.deletedCount === 0
            ? "No notifications to delete."
            : "All notifications deleted."
        );
      },
      onError: () => {
        toast.error("Could not delete notifications.");
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
            <div className="flex flex-wrap items-center justify-end gap-2">
              <ConfirmNotificationActionDialog
                title="Mark all notifications as read?"
                description="This will mark every unread notification in your inbox as read."
                confirmLabel="Mark all read"
                pendingLabel="Marking..."
                confirmIcon={<CheckCheck className="size-4" />}
                disabled={unreadCount === 0 || markAllReadMutation.isPending}
                isPending={markAllReadMutation.isPending}
                onConfirm={markAllRead}
                trigger={
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={
                      unreadCount === 0 || markAllReadMutation.isPending
                    }
                  >
                    <CheckCheck className="size-4" />
                    {markAllReadMutation.isPending
                      ? "Marking..."
                      : "Mark all read"}
                  </Button>
                }
              />
              <ConfirmNotificationActionDialog
                title="Delete all notifications?"
                description="This permanently removes every notification from your inbox. Posts, comments, and clubs are not affected."
                confirmLabel="Delete all"
                pendingLabel="Deleting..."
                confirmIcon={<Trash2 className="size-4" />}
                confirmVariant="destructive"
                disabled={
                  notifications.length === 0 ||
                  deleteAllNotificationsMutation.isPending
                }
                isPending={deleteAllNotificationsMutation.isPending}
                onConfirm={deleteAllNotifications}
                trigger={
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={
                      notifications.length === 0 ||
                      deleteAllNotificationsMutation.isPending
                    }
                  >
                    <Trash2 className="size-4" />
                    {deleteAllNotificationsMutation.isPending
                      ? "Deleting..."
                      : "Delete all"}
                  </Button>
                }
              />
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
                      isDeleting={
                        deleteNotificationMutation.isPending &&
                        deleteNotificationMutation.variables ===
                          notification.id
                      }
                      onMarkRead={() => markRead(notification)}
                      onDelete={() => deleteNotification(notification)}
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
  isDeleting,
  onMarkRead,
  onDelete
}: {
  notification: NotificationItem;
  isMarkingRead: boolean;
  isDeleting: boolean;
  onMarkRead: () => void;
  onDelete: () => void;
}) => {
  const isUnread = !notification.readAt;
  const isLocked = notification.visibility === "LOCKED";
  const targetPath =
    notification.type === "MODERATION_WARNING"
      ? `/app/clubs/${notification.club.linkName}`
      : notification.postId
    ? `/app/posts/${notification.postId}`
    : notification.type === "PROGRESS_UNLOCK"
      ? `/app/clubs/${notification.club.linkName}/recently-unlocked`
    : `/app/clubs/${notification.club.linkName}`;

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
            <Button
              asChild
              className="w-full sm:w-fit"
              variant="ghost"
              size="sm"
            >
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
            <ConfirmNotificationActionDialog
              title="Delete this notification?"
              description="This permanently removes the notification from your inbox. The original discussion is not affected."
              confirmLabel="Delete"
              pendingLabel="Deleting..."
              confirmIcon={<Trash2 className="size-4" />}
              confirmVariant="destructive"
              disabled={isDeleting}
              isPending={isDeleting}
              onConfirm={onDelete}
              trigger={
                <Button
                  className="w-full sm:w-fit"
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isDeleting}
                >
                  <Trash2 className="size-4" />
                  {isDeleting ? "Deleting..." : "Delete"}
                </Button>
              }
            />
          </div>
        </div>
      </div>
    </article>
  );
};

const ConfirmNotificationActionDialog = ({
  title,
  description,
  confirmLabel,
  pendingLabel,
  confirmIcon,
  confirmVariant = "default",
  disabled,
  isPending,
  trigger,
  onConfirm
}: {
  title: string;
  description: string;
  confirmLabel: string;
  pendingLabel: string;
  confirmIcon: ReactNode;
  confirmVariant?: "default" | "destructive";
  disabled: boolean;
  isPending: boolean;
  trigger: ReactNode;
  onConfirm: () => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const confirmAction = () => {
    onConfirm();
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={isPending}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            type="button"
            variant={confirmVariant}
            disabled={disabled || isPending}
            onClick={confirmAction}
          >
            {confirmIcon}
            {isPending ? pendingLabel : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
