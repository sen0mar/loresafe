import { CheckCheck, ListChecks, RefreshCw, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AuthenticatedAppShell } from "@/features/auth/components/authenticated-app-shell";
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
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from "@/shared/components/ui/card";
import { cn } from "@/shared/lib/utils";
import {
  ConfirmNotificationActionDialog,
  NotificationRow,
  NotificationsEmpty,
  NotificationsError,
  NotificationsLoading
} from "../components/notification-list-sections.js";
import { useNotificationListMotion } from "../hooks/use-notification-list-motion.js";

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
  const {
    cancelDeletedNotificationAnimation,
    exitingNotifications,
    listElementRef,
    queueDeletedNotificationAnimation,
    renderedNotifications,
    setNotificationRowElement
  } = useNotificationListMotion({
    isSelecting,
    notifications,
    selectedNotificationIds
  });
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
    queueDeletedNotificationAnimation([notification]);
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
        cancelDeletedNotificationAnimation([notification.id]);
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

    const notificationIds = [...selectedNotificationIds];
    const notificationIdSet = new Set(notificationIds);
    const selectedNotifications = notifications.filter((notification) =>
      notificationIdSet.has(notification.id)
    );

    queueDeletedNotificationAnimation(selectedNotifications);
    deleteSelectedNotificationsMutation.mutate(notificationIds, {
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
        cancelDeletedNotificationAnimation(notificationIds);
        toast.error("Could not delete selected notifications.");
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

    const notificationIds = notifications.map(
      (notification) => notification.id
    );
    queueDeletedNotificationAnimation(notifications);
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
        cancelDeletedNotificationAnimation(notificationIds);
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
            ) : notifications.length === 0 &&
              exitingNotifications.size === 0 ? (
              <NotificationsEmpty />
            ) : (
              <>
                <div ref={listElementRef} className="notification-list">
                  <div className="notification-exit-layer" aria-hidden="true">
                    {[...exitingNotifications.values()]
                      .filter(
                        (exitingNotification) =>
                          !exitingNotification.isAnimationComplete &&
                          exitingNotification.layout
                      )
                      .map((exitingNotification) => (
                        <div
                          key={exitingNotification.notification.id}
                          className="notification-exit-row"
                          style={{
                            height: exitingNotification.layout?.height,
                            left: exitingNotification.layout?.left,
                            top: exitingNotification.layout?.top,
                            width: exitingNotification.layout?.width
                          }}
                        >
                          <NotificationRow
                            notification={exitingNotification.notification}
                            isExiting={true}
                            isSelecting={exitingNotification.isSelecting}
                            isSelected={exitingNotification.isSelected}
                            isMarkingRead={false}
                            isDeleting={true}
                            onSelectChange={() => undefined}
                            onMarkRead={() => undefined}
                            onDelete={() => undefined}
                          />
                        </div>
                      ))}
                  </div>
                  {renderedNotifications.map(({ notification, isExiting }) => (
                    <NotificationRow
                      key={notification.id}
                      rowRef={setNotificationRowElement(notification.id)}
                      notification={notification}
                      isExiting={isExiting}
                      isSelecting={isSelecting}
                      isSelected={selectedNotificationIds.has(notification.id)}
                      isMarkingRead={
                        markReadMutation.isPending &&
                        markReadMutation.variables === notification.id
                      }
                      isDeleting={
                        isExiting ||
                        (deleteNotificationMutation.isPending &&
                          deleteNotificationMutation.variables ===
                            notification.id)
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
