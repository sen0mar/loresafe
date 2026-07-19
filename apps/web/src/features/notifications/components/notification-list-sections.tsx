import { Bell, Check, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { getClubFeedPath } from "@/features/clubs/lib/club-paths";
import { type NotificationItem } from "@/features/notifications/api/notifications";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
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

type ExitingNotification = {
  notification: NotificationItem;
  isAnimationComplete: boolean;
  isSelected: boolean;
  isSelecting: boolean;
  layout: NotificationRowLayout | null;
};

type NotificationRowLayout = {
  top: number;
  left: number;
  width: number;
  height: number;
};

export const NotificationRow = ({
  rowRef,
  notification,
  isExiting,
  isSelecting,
  isSelected,
  isMarkingRead,
  isDeleting,
  onSelectChange,
  onMarkRead,
  onDelete
}: {
  rowRef?: (element: HTMLDivElement | null) => void;
  notification: NotificationItem;
  isExiting: boolean;
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
  const targetPath = notification.postId
    ? `/app/posts/${notification.postId}`
    : notification.type === "PROGRESS_UNLOCK"
      ? `/app/clubs/${notification.club.linkName}/recently-unlocked`
      : getClubFeedPath(notification.club.linkName);

  return (
    <div ref={rowRef} className={cn("notification-row-shell")}>
      <article
        aria-hidden={isExiting ? true : undefined}
        className={cn(
          "notification-row-card rounded-xl border border-default bg-surface transition-colors duration-150 hover:border-strong hover:bg-active",
          isUnread && "border-brand bg-active",
          isSelected && "ring-1 ring-brand",
          isExiting && "notification-row-card-exiting pointer-events-none"
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
              <div className="grid gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-end sm:self-end">
                {isUnread ? (
                  <Button
                    className="h-7 min-h-7 w-full gap-1 px-2 py-0 text-[0.6875rem] leading-none motion-safe:hover:scale-[1.03] motion-safe:active:scale-95 sm:mb-0.5 sm:w-fit [&_svg]:size-3.5"
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
                      className="h-7 min-h-7 w-full gap-1 border border-error px-2 py-0 text-[0.6875rem] leading-none motion-safe:hover:scale-[1.03] motion-safe:active:scale-95 sm:mb-0.5 sm:w-fit [&_svg]:size-3.5"
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
            </div>
          </div>
        </div>
      </article>
    </div>
  );
};

export const ConfirmNotificationActionDialog = ({
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

export const NotificationsLoading = () => (
  <div className="space-y-3">
    {Array.from({ length: 4 }).map((_, index) => (
      <Skeleton key={index} className="h-28 rounded-xl" />
    ))}
  </div>
);

export const NotificationsEmpty = () => (
  <div className="rounded-xl border border-default bg-inset px-4 py-10 text-center">
    <Bell className="mx-auto size-8 text-faint" />
    <p className="mt-3 text-sm font-medium text-primary">
      No notifications yet
    </p>
    <p className="mt-1 text-sm text-muted">
      Comment and reply activity will appear here.
    </p>
  </div>
);

export const NotificationsError = ({ onRetry }: { onRetry: () => void }) => (
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

export const mergeExitingNotifications = (
  notifications: NotificationItem[],
  exitingNotifications: Map<string, ExitingNotification>
) => {
  const exitingNotificationIds = new Set(exitingNotifications.keys());
  return notifications
    .filter((notification) => !exitingNotificationIds.has(notification.id))
    .map((notification) => ({
      notification,
      isExiting: false
    }));
};

export const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export const getNotificationRowLayouts = (
  listElement: HTMLDivElement | null,
  rowElements: Map<string, HTMLDivElement>
) => {
  const listRect = listElement?.getBoundingClientRect();
  const rowLayouts = new Map<string, NotificationRowLayout>();

  if (!listRect) {
    return rowLayouts;
  }

  rowElements.forEach((rowElement, notificationId) => {
    const rowRect = rowElement.getBoundingClientRect();

    rowLayouts.set(notificationId, {
      top: rowRect.top - listRect.top,
      left: rowRect.left - listRect.left,
      width: rowRect.width,
      height: rowRect.height
    });
  });

  return rowLayouts;
};
