import {
  Bell,
  Check,
  CheckCheck,
  ListChecks,
  RefreshCw,
  Trash2
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { AuthenticatedAppShell } from "@/features/auth/components/authenticated-app-shell";
import { getClubFeedPath } from "@/features/clubs/lib/club-paths";
import {
  type NotificationItem,
  notificationsQueryKeys,
  useDeleteAllNotificationsMutation,
  useDeleteNotificationMutation,
  useDeleteSelectedNotificationsMutation,
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
  const deleteSelectedNotificationsMutation =
    useDeleteSelectedNotificationsMutation();
  const deleteAllNotificationsMutation = useDeleteAllNotificationsMutation();
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedNotificationIds, setSelectedNotificationIds] = useState<
    Set<string>
  >(() => new Set());
  const notifications = useMemo(
    () =>
      notificationsQuery.data?.pages.flatMap((page) => page.notifications) ??
      [],
    [notificationsQuery.data]
  );
  const visibleNotificationIds = useMemo(
    () => notifications.map((notification) => notification.id),
    [notifications]
  );
  const unreadCount = notificationsQuery.data?.pages[0]?.unreadCount ?? 0;
  const selectedCount = selectedNotificationIds.size;
  const allVisibleSelected =
    visibleNotificationIds.length > 0 &&
    visibleNotificationIds.every((notificationId) =>
      selectedNotificationIds.has(notificationId)
    );
  const hasMore =
    notificationsQuery.data?.pages.at(-1)?.pagination.hasMore ?? false;
  const isRefreshing =
    notificationsQuery.isFetching && !notificationsQuery.isFetchingNextPage;

  useEffect(() => {
    const visibleNotificationIdSet = new Set(visibleNotificationIds);

    setSelectedNotificationIds((currentIds) => {
      const retainedIds = [...currentIds].filter((notificationId) =>
        visibleNotificationIdSet.has(notificationId)
      );

      return retainedIds.length === currentIds.size
        ? currentIds
        : new Set(retainedIds);
    });
  }, [visibleNotificationIds]);

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
        setSelectedNotificationIds((currentIds) => {
          const nextIds = new Set(currentIds);

          nextIds.delete(notification.id);

          return nextIds;
        });
        toast.success("Notification deleted.");
      },
      onError: () => {
        toast.error("Could not delete notification.");
      }
    });
  };

  const deleteSelectedNotifications = () => {
    if (
      selectedNotificationIds.size === 0 ||
      deleteSelectedNotificationsMutation.isPending
    ) {
      return;
    }

    deleteSelectedNotificationsMutation.mutate(
      [...selectedNotificationIds],
      {
        onSuccess: (response) => {
          setSelectedNotificationIds(new Set());
          setIsSelecting(false);
          toast.success(
            response.deletedCount === 0
              ? "No selected notifications were deleted."
              : `${response.deletedCount} selected notification${
                  response.deletedCount === 1 ? "" : "s"
                } deleted.`
          );
        },
        onError: () => {
          toast.error("Could not delete selected notifications.");
        }
      }
    );
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
        setSelectedNotificationIds(new Set());
        setIsSelecting(false);
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

  const startSelecting = () => {
    setIsSelecting(true);
  };

  const cancelSelecting = () => {
    setSelectedNotificationIds(new Set());
    setIsSelecting(false);
  };

  const toggleNotificationSelection = (notificationId: string) => {
    setSelectedNotificationIds((currentIds) => {
      const nextIds = new Set(currentIds);

      if (nextIds.has(notificationId)) {
        nextIds.delete(notificationId);
      } else {
        nextIds.add(notificationId);
      }

      return nextIds;
    });
  };

  const toggleVisibleSelection = () => {
    setSelectedNotificationIds((currentIds) => {
      if (allVisibleSelected) {
        return new Set(
          [...currentIds].filter(
            (notificationId) => !visibleNotificationIds.includes(notificationId)
          )
        );
      }

      return new Set([...currentIds, ...visibleNotificationIds]);
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
            <div className="flex flex-col items-end gap-2">
              <div className="flex flex-wrap items-center justify-end gap-2">
                {notifications.length > 0 && !isSelecting ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={startSelecting}
                  >
                    <ListChecks className="size-4" />
                    Select
                  </Button>
                ) : null}
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
              {isSelecting ? (
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={deleteSelectedNotificationsMutation.isPending}
                    onClick={toggleVisibleSelection}
                  >
                    <ListChecks className="size-4" />
                    {allVisibleSelected ? "Clear all" : "Select all"}
                  </Button>
                  <ConfirmNotificationActionDialog
                    title="Delete selected notifications?"
                    description="This permanently removes only the notifications you selected. Original discussions are not affected."
                    confirmLabel="Delete selected"
                    pendingLabel="Deleting..."
                    confirmIcon={<Trash2 className="size-4" />}
                    confirmVariant="destructive"
                    disabled={
                      selectedCount === 0 ||
                      deleteSelectedNotificationsMutation.isPending
                    }
                    isPending={deleteSelectedNotificationsMutation.isPending}
                    onConfirm={deleteSelectedNotifications}
                    trigger={
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="h-7 gap-1 px-2 text-[11px] motion-safe:hover:scale-[1.03] motion-safe:active:scale-95 [&_svg]:size-3.5"
                        disabled={
                          selectedCount === 0 ||
                          deleteSelectedNotificationsMutation.isPending
                        }
                      >
                        <Trash2 className="size-4" />
                        {deleteSelectedNotificationsMutation.isPending
                          ? "Deleting..."
                          : "Delete selected"}
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
                        variant="destructive"
                        size="sm"
                        className="h-7 gap-1 px-2 text-[11px] motion-safe:hover:scale-[1.03] motion-safe:active:scale-95 [&_svg]:size-3.5"
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
                    variant="ghost"
                    size="sm"
                    disabled={
                      deleteSelectedNotificationsMutation.isPending ||
                      deleteAllNotificationsMutation.isPending
                    }
                    onClick={cancelSelecting}
                  >
                    Cancel
                  </Button>
                </div>
              ) : null}
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
                      isSelecting={isSelecting}
                      isSelected={selectedNotificationIds.has(
                        notification.id
                      )}
                      isMarkingRead={
                        markReadMutation.isPending &&
                        markReadMutation.variables === notification.id
                      }
                      isDeleting={
                        deleteNotificationMutation.isPending &&
                        deleteNotificationMutation.variables ===
                          notification.id
                      }
                      onSelectChange={() =>
                        toggleNotificationSelection(notification.id)
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
  isSelecting,
  isSelected,
  isMarkingRead,
  isDeleting,
  onSelectChange,
  onMarkRead,
  onDelete
}: {
  notification: NotificationItem;
  isSelecting: boolean;
  isSelected: boolean;
  isMarkingRead: boolean;
  isDeleting: boolean;
  onSelectChange: () => void;
  onMarkRead: () => void;
  onDelete: () => void;
}) => {
  const isUnread = !notification.readAt;
  const isLocked = notification.visibility === "LOCKED";
  const targetPath =
    notification.postId
    ? `/app/posts/${notification.postId}`
    : notification.type === "PROGRESS_UNLOCK"
      ? `/app/clubs/${notification.club.linkName}/recently-unlocked`
    : getClubFeedPath(notification.club.linkName);

  return (
    <article
      className={cn(
        "rounded-xl border border-default bg-surface transition-colors duration-150 hover:border-strong hover:bg-active",
        isUnread && "border-brand bg-active",
        isSelected && "ring-1 ring-brand"
      )}
    >
      <div className="flex items-start gap-3 p-4">
        {isSelecting ? (
          <input
            type="checkbox"
            className="mt-2 size-4 shrink-0 rounded border-default bg-inset accent-[var(--accent-primary)]"
            checked={isSelected}
            aria-label={`Select notification: ${notification.safeText}`}
            onChange={onSelectChange}
          />
        ) : null}
        <div className="min-w-0 flex-1 space-y-2">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <Link
              to={targetPath}
              className="block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={isUnread ? "default" : "secondary"}>
                  {notificationTypeLabels[notification.type]}
                </Badge>
                {isLocked ? <Badge variant="outline">Locked</Badge> : null}
                <span className="text-xs text-faint">
                  {formatNotificationTime(notification.createdAt)}
                </span>
              </div>
              <div className="mt-2">
                <p className="text-sm font-medium leading-5 text-primary">
                  {notification.safeText}
                </p>
                <p className="mt-1 text-xs leading-5 text-faint">
                  Milestone {notification.requiredMilestone.position}:{" "}
                  {notification.requiredMilestone.label}
                </p>
              </div>
            </Link>
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
                  className="h-7 w-full justify-self-end gap-1 px-2 text-[11px] motion-safe:hover:scale-[1.03] motion-safe:active:scale-95 sm:mb-0.5 sm:w-fit [&_svg]:size-3.5"
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={isDeleting}
                >
                  <Trash2 className="size-4" />
                  {isDeleting ? "Deleting..." : "Delete"}
                </Button>
              }
            />
          </div>
          <div className="grid gap-2 sm:flex sm:flex-wrap sm:items-center">
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
