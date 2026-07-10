import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import type { NotificationItem } from "../api/notifications.js";
import {
  getNotificationRowLayouts,
  mergeExitingNotifications,
  prefersReducedMotion
} from "../components/notification-list-sections.js";

const notificationDeleteAnimationMs = 460;

type NotificationRowLayout = {
  top: number;
  left: number;
  width: number;
  height: number;
};

type ExitingNotification = {
  notification: NotificationItem;
  isAnimationComplete: boolean;
  isSelected: boolean;
  isSelecting: boolean;
  layout: NotificationRowLayout | null;
};

export const useNotificationListMotion = ({
  isSelecting,
  notifications,
  selectedNotificationIds
}: {
  isSelecting: boolean;
  notifications: NotificationItem[];
  selectedNotificationIds: Set<string>;
}) => {
  const [exitingNotifications, setExitingNotifications] = useState<
    Map<string, ExitingNotification>
  >(() => new Map());
  const deleteAnimationTimersRef = useRef<Map<string, number>>(new Map());
  const notificationsRef = useRef(notifications);
  const listElementRef = useRef<HTMLDivElement | null>(null);
  const rowElementsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const pendingFlipLayoutsRef = useRef<Map<
    string,
    NotificationRowLayout
  > | null>(null);
  const renderedNotifications = useMemo(
    () => mergeExitingNotifications(notifications, exitingNotifications),
    [exitingNotifications, notifications]
  );
  const visibleNotificationIds = useMemo(
    () => new Set(notifications.map((notification) => notification.id)),
    [notifications]
  );

  notificationsRef.current = notifications;

  useEffect(() => {
    setExitingNotifications((currentNotifications) => {
      let hasRemovedNotification = false;
      const nextNotifications = new Map(currentNotifications);

      currentNotifications.forEach((exitingNotification, notificationId) => {
        if (
          exitingNotification.isAnimationComplete &&
          !visibleNotificationIds.has(notificationId)
        ) {
          hasRemovedNotification = true;
          nextNotifications.delete(notificationId);
        }
      });

      return hasRemovedNotification ? nextNotifications : currentNotifications;
    });
  }, [visibleNotificationIds]);

  useEffect(
    () => () => {
      deleteAnimationTimersRef.current.forEach((timerId) => {
        window.clearTimeout(timerId);
      });
    },
    []
  );

  useLayoutEffect(() => {
    const previousLayouts = pendingFlipLayoutsRef.current;

    pendingFlipLayoutsRef.current = null;

    if (!previousLayouts || prefersReducedMotion()) {
      return;
    }

    const currentLayouts = getNotificationRowLayouts(
      listElementRef.current,
      rowElementsRef.current
    );
    const movingElements: HTMLDivElement[] = [];

    currentLayouts.forEach((currentLayout, notificationId) => {
      const previousLayout = previousLayouts.get(notificationId);
      const rowElement = rowElementsRef.current.get(notificationId);

      if (!previousLayout || !rowElement) {
        return;
      }

      const deltaX = previousLayout.left - currentLayout.left;
      const deltaY = previousLayout.top - currentLayout.top;

      if (Math.abs(deltaX) < 0.5 && Math.abs(deltaY) < 0.5) {
        return;
      }

      rowElement.style.transition = "none";
      rowElement.style.transform = `translate3d(${deltaX}px, ${deltaY}px, 0)`;
      rowElement.style.willChange = "transform";
      movingElements.push(rowElement);
    });

    if (movingElements.length === 0) {
      return;
    }

    const animationFrameId = window.requestAnimationFrame(() => {
      movingElements.forEach((rowElement) => {
        rowElement.style.transition =
          "transform 320ms cubic-bezier(0.22, 1, 0.36, 1)";
        rowElement.style.transform = "translate3d(0, 0, 0)";
      });
    });
    const cleanupTimerId = window.setTimeout(() => {
      movingElements.forEach((rowElement) => {
        rowElement.style.transition = "";
        rowElement.style.transform = "";
        rowElement.style.willChange = "";
      });
    }, 360);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      window.clearTimeout(cleanupTimerId);
    };
  }, [renderedNotifications]);

  const queueDeletedNotificationAnimation = (
    deletedNotifications: NotificationItem[]
  ) => {
    if (deletedNotifications.length === 0 || prefersReducedMotion()) {
      return;
    }

    const currentLayouts = getNotificationRowLayouts(
      listElementRef.current,
      rowElementsRef.current
    );

    pendingFlipLayoutsRef.current = currentLayouts;
    setExitingNotifications((currentNotifications) => {
      const nextNotifications = new Map(currentNotifications);

      deletedNotifications.forEach((notification) => {
        const existingTimerId = deleteAnimationTimersRef.current.get(
          notification.id
        );

        if (existingTimerId) {
          window.clearTimeout(existingTimerId);
        }

        nextNotifications.set(notification.id, {
          notification,
          isAnimationComplete: false,
          isSelected: selectedNotificationIds.has(notification.id),
          isSelecting,
          layout: currentLayouts.get(notification.id) ?? null
        });

        const timerId = window.setTimeout(() => {
          deleteAnimationTimersRef.current.delete(notification.id);
          setExitingNotifications((currentExitingNotifications) => {
            const exitingNotification = currentExitingNotifications.get(
              notification.id
            );

            if (!exitingNotification) {
              return currentExitingNotifications;
            }

            const remainingNotifications = new Map(currentExitingNotifications);
            const isStillInQuery = notificationsRef.current.some(
              (currentNotification) =>
                currentNotification.id === notification.id
            );

            if (isStillInQuery) {
              remainingNotifications.set(notification.id, {
                ...exitingNotification,
                isAnimationComplete: true
              });
            } else {
              remainingNotifications.delete(notification.id);
            }

            return remainingNotifications;
          });
        }, notificationDeleteAnimationMs);

        deleteAnimationTimersRef.current.set(notification.id, timerId);
      });

      return nextNotifications;
    });
  };

  const cancelDeletedNotificationAnimation = (notificationIds: string[]) => {
    if (notificationIds.length === 0) {
      return;
    }

    setExitingNotifications((currentNotifications) => {
      const nextNotifications = new Map(currentNotifications);

      notificationIds.forEach((notificationId) => {
        const timerId = deleteAnimationTimersRef.current.get(notificationId);

        if (timerId) {
          window.clearTimeout(timerId);
          deleteAnimationTimersRef.current.delete(notificationId);
        }

        nextNotifications.delete(notificationId);
      });

      return nextNotifications;
    });
  };

  const setNotificationRowElement =
    (notificationId: string) => (element: HTMLDivElement | null) => {
      if (element) {
        rowElementsRef.current.set(notificationId, element);
      } else {
        rowElementsRef.current.delete(notificationId);
      }
    };

  return {
    cancelDeletedNotificationAnimation,
    exitingNotifications,
    listElementRef,
    queueDeletedNotificationAnimation,
    renderedNotifications,
    setNotificationRowElement
  };
};
