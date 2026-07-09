import cookieParser from "cookie-parser";
import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { env } from "../../config/env.js";
import { errorHandler } from "../../core/http/error-middleware.js";
import { requestIdMiddleware } from "../../core/http/request-id.js";
import { createSessionToken } from "../../core/security/session-token.js";
import { createAuthMiddleware } from "../auth/auth.middleware.js";
import type {
  AuthUserCredentialsRecord,
  AuthUserRecord,
  AuthUsersRepository,
  CreateAuthUserInput
} from "../auth/auth.repository.js";
import { createAuthService } from "../auth/auth.service.js";
import type { EventsService } from "../events/events.service.js";
import type { ProgressMode } from "../progress/progress.schema.js";
import { createNotificationsController } from "./notifications.controller.js";
import type {
  ListNotificationsInput,
  ListNotificationsResult,
  NotificationRecord,
  NotificationsRepository
} from "./notifications.repository.js";
import { createNotificationsRouter } from "./notifications.routes.js";
import { createNotificationsService } from "./notifications.service.js";
import type { NotificationType } from "./notifications.schema.js";

describe("notifications routes", () => {
  let repository: InMemoryNotificationsRepository;
  let app: express.Express;

  beforeEach(() => {
    repository = new InMemoryNotificationsRepository();
    app = createNotificationsTestApp(repository);
  });

  it("requires an authenticated session for list and read actions", async () => {
    await request(app)
      .get("/api/notifications")
      .set("x-request-id", "notifications-missing-session")
      .expect(401);

    await request(app)
      .post("/api/notifications/read-all")
      .set("x-request-id", "notifications-read-all-missing-session")
      .expect(401);

    await request(app)
      .delete("/api/notifications")
      .set("x-request-id", "notifications-delete-all-missing-session")
      .expect(401);

    await request(app)
      .delete("/api/notifications/selected")
      .send({ notificationIds: [crypto.randomUUID()] })
      .set("x-request-id", "notifications-delete-selected-missing-session")
      .expect(401);

    await request(app)
      .post(`/api/notifications/${crypto.randomUUID()}/read`)
      .set("x-request-id", "notification-read-missing-session")
      .expect(401);

    await request(app)
      .delete(`/api/notifications/${crypto.randomUUID()}`)
      .set("x-request-id", "notification-delete-missing-session")
      .expect(401);
  });

  it("lists only current-user notifications with unread count and pagination", async () => {
    const user = repository.createStoredUser(validUserInput());
    const otherUser = repository.createStoredUser({
      ...validUserInput(),
      email: "other@example.com"
    });
    const club = repository.createClub("Readable Club");
    const milestone = repository.createMilestone(club.id, 1);
    repository.setProgress(user.id, club.id, 1);
    const older = repository.createNotification(user.id, club.id, milestone, {
      safeText: "Older safe text",
      createdAt: new Date("2026-01-01T10:00:00.000Z"),
      readAt: new Date("2026-01-01T10:30:00.000Z")
    });
    const newer = repository.createNotification(user.id, club.id, milestone, {
      safeText: "Newer safe text",
      createdAt: new Date("2026-01-01T11:00:00.000Z")
    });
    repository.createNotification(otherUser.id, club.id, milestone, {
      safeText: "Other user safe text",
      createdAt: new Date("2026-01-01T12:00:00.000Z")
    });

    const firstPage = await request(app)
      .get("/api/notifications?limit=1")
      .set("Cookie", await createSessionCookie(user))
      .expect(200);

    expect(firstPage.body).toMatchObject({
      unreadCount: 1,
      notifications: [
        {
          id: newer.id,
          visibility: "VISIBLE",
          safeText: "Newer safe text",
          readAt: null,
          club: {
            id: club.id,
            title: "Readable Club",
            linkName: "readable-club"
          },
          requiredMilestone: {
            id: milestone.id,
            position: 1,
            label: "Milestone 1"
          }
        }
      ],
      pagination: {
        limit: 1,
        hasMore: true
      }
    });

    const secondPage = await request(app)
      .get(`/api/notifications?limit=1&cursor=${firstPage.body.pagination.nextCursor}`)
      .set("Cookie", await createSessionCookie(user))
      .expect(200);

    expect(secondPage.body.notifications).toHaveLength(1);
    expect(secondPage.body.notifications[0]).toMatchObject({
      id: older.id,
      safeText: "Older safe text",
      readAt: "2026-01-01T10:30:00.000Z"
    });
  });

  it("lists progress unlock notifications through the existing query", async () => {
    const user = repository.createStoredUser(validUserInput());
    const club = repository.createClub("Unlock Club");
    const milestone = repository.createMilestone(club.id, 3);
    milestone.targetPostId = crypto.randomUUID();
    repository.setProgress(user.id, club.id, 3);
    repository.createNotification(user.id, club.id, milestone, {
      type: "PROGRESS_UNLOCK",
      safeText: "New discussions unlocked in Unlock Club",
      postId: null,
      commentId: null
    });

    const response = await request(app)
      .get("/api/notifications")
      .set("Cookie", await createSessionCookie(user))
      .expect(200);

    expect(response.body.notifications[0]).toMatchObject({
      type: "PROGRESS_UNLOCK",
      safeText: "New discussions unlocked in Unlock Club",
      postId: milestone.targetPostId,
      commentId: null,
      visibility: "VISIBLE"
    });
  });

  it("keeps locked notifications generic without reply or post content", async () => {
    const user = repository.createStoredUser(validUserInput());
    const club = repository.createClub("Locked Club");
    const milestone = repository.createMilestone(club.id, 2);
    repository.setProgress(user.id, club.id, 1);
    repository.createNotification(user.id, club.id, milestone, {
      safeText: "New reply in Locked Club",
      postTitle: "UNSAFE_POST_TITLE_SHOULD_NOT_LEAK",
      commentBody: "UNSAFE_REPLY_BODY_SHOULD_NOT_LEAK"
    });

    const response = await request(app)
      .get("/api/notifications")
      .set("Cookie", await createSessionCookie(user))
      .expect(200);

    expect(response.body.notifications[0]).toMatchObject({
      visibility: "LOCKED",
      safeText: "New reply in Locked Club",
      requiredMilestone: {
        label: "Milestone 2"
      }
    });
    expect(JSON.stringify(response.body)).not.toContain("UNSAFE_POST_TITLE");
    expect(JSON.stringify(response.body)).not.toContain("UNSAFE_REPLY_BODY");
  });

  it("marks only the current user's notification as read", async () => {
    const user = repository.createStoredUser(validUserInput());
    const otherUser = repository.createStoredUser({
      ...validUserInput(),
      email: "other-reader@example.com"
    });
    const club = repository.createClub("Read State Club");
    const milestone = repository.createMilestone(club.id, 1);
    repository.setProgress(user.id, club.id, 1);
    const notification = repository.createNotification(
      user.id,
      club.id,
      milestone
    );
    const otherNotification = repository.createNotification(
      otherUser.id,
      club.id,
      milestone
    );

    await request(app)
      .post(`/api/notifications/${otherNotification.id}/read`)
      .set("Cookie", await createSessionCookie(user))
      .expect(404);

    const response = await request(app)
      .post(`/api/notifications/${notification.id}/read`)
      .set("Cookie", await createSessionCookie(user))
      .expect(200);

    expect(response.body).toMatchObject({
      unreadCount: 0,
      notification: {
        id: notification.id,
        readAt: expect.any(String)
      }
    });
    expect(repository.notifications.find((row) => row.id === notification.id)?.readAt)
      .toBeInstanceOf(Date);
    expect(repository.notifications.find((row) => row.id === otherNotification.id)?.readAt)
      .toBeNull();
  });

  it("marks all current-user notifications as read without touching other users", async () => {
    const user = repository.createStoredUser(validUserInput());
    const otherUser = repository.createStoredUser({
      ...validUserInput(),
      email: "other-read-all@example.com"
    });
    const club = repository.createClub("Bulk Read Club");
    const milestone = repository.createMilestone(club.id, 1);
    repository.setProgress(user.id, club.id, 1);
    const firstNotification = repository.createNotification(
      user.id,
      club.id,
      milestone
    );
    const secondNotification = repository.createNotification(
      user.id,
      club.id,
      milestone
    );
    const otherNotification = repository.createNotification(
      otherUser.id,
      club.id,
      milestone
    );

    const response = await request(app)
      .post("/api/notifications/read-all")
      .set("Cookie", await createSessionCookie(user))
      .expect(200);

    expect(response.body).toEqual({
      updatedCount: 2,
      unreadCount: 0
    });
    expect(
      repository.notifications.find((row) => row.id === firstNotification.id)
        ?.readAt
    ).toBeInstanceOf(Date);
    expect(
      repository.notifications.find((row) => row.id === secondNotification.id)
        ?.readAt
    ).toBeInstanceOf(Date);
    expect(
      repository.notifications.find((row) => row.id === otherNotification.id)
        ?.readAt
    ).toBeNull();
  });

  it("deletes only the current user's selected notification", async () => {
    const user = repository.createStoredUser(validUserInput());
    const otherUser = repository.createStoredUser({
      ...validUserInput(),
      email: "other-delete@example.com"
    });
    const club = repository.createClub("Delete One Club");
    const milestone = repository.createMilestone(club.id, 1);
    repository.setProgress(user.id, club.id, 1);
    const notification = repository.createNotification(
      user.id,
      club.id,
      milestone
    );
    const retainedNotification = repository.createNotification(
      user.id,
      club.id,
      milestone
    );
    const otherNotification = repository.createNotification(
      otherUser.id,
      club.id,
      milestone
    );

    await request(app)
      .delete(`/api/notifications/${otherNotification.id}`)
      .set("Cookie", await createSessionCookie(user))
      .expect(404);

    const response = await request(app)
      .delete(`/api/notifications/${notification.id}`)
      .set("Cookie", await createSessionCookie(user))
      .expect(200);

    expect(response.body).toEqual({
      deletedCount: 1,
      unreadCount: 1
    });
    expect(repository.notifications.map((row) => row.id)).toEqual([
      retainedNotification.id,
      otherNotification.id
    ]);
  });

  it("deletes all current-user notifications without touching other users", async () => {
    const user = repository.createStoredUser(validUserInput());
    const otherUser = repository.createStoredUser({
      ...validUserInput(),
      email: "other-delete-all@example.com"
    });
    const club = repository.createClub("Delete All Club");
    const milestone = repository.createMilestone(club.id, 1);
    repository.setProgress(user.id, club.id, 1);
    repository.createNotification(user.id, club.id, milestone);
    repository.createNotification(user.id, club.id, milestone);
    const otherNotification = repository.createNotification(
      otherUser.id,
      club.id,
      milestone
    );

    const response = await request(app)
      .delete("/api/notifications")
      .set("Cookie", await createSessionCookie(user))
      .expect(200);

    expect(response.body).toEqual({
      deletedCount: 2,
      unreadCount: 0
    });
    expect(repository.notifications.map((row) => row.id)).toEqual([
      otherNotification.id
    ]);
  });

  it("deletes selected current-user notifications without touching other users", async () => {
    const user = repository.createStoredUser(validUserInput());
    const otherUser = repository.createStoredUser({
      ...validUserInput(),
      email: "other-delete-selected@example.com"
    });
    const club = repository.createClub("Delete Selected Club");
    const milestone = repository.createMilestone(club.id, 1);
    repository.setProgress(user.id, club.id, 1);
    const firstNotification = repository.createNotification(
      user.id,
      club.id,
      milestone
    );
    const retainedNotification = repository.createNotification(
      user.id,
      club.id,
      milestone,
      {
        readAt: new Date("2026-01-01T10:00:00.000Z")
      }
    );
    const secondNotification = repository.createNotification(
      user.id,
      club.id,
      milestone
    );
    const otherNotification = repository.createNotification(
      otherUser.id,
      club.id,
      milestone
    );

    const response = await request(app)
      .delete("/api/notifications/selected")
      .set("Cookie", await createSessionCookie(user))
      .send({
        notificationIds: [
          firstNotification.id,
          firstNotification.id,
          secondNotification.id,
          otherNotification.id
        ]
      })
      .expect(200);

    expect(response.body).toEqual({
      deletedCount: 2,
      unreadCount: 0
    });
    expect(repository.notifications.map((row) => row.id)).toEqual([
      retainedNotification.id,
      otherNotification.id
    ]);
  });

  it("publishes a safe notification read event for the owning user", async () => {
    const eventPublisher = createMockEventsService();
    app = createNotificationsTestApp(repository, eventPublisher);
    const user = repository.createStoredUser(validUserInput());
    const club = repository.createClub("Read Event Club");
    const milestone = repository.createMilestone(club.id, 1);
    repository.setProgress(user.id, club.id, 1);
    const notification = repository.createNotification(
      user.id,
      club.id,
      milestone,
      {
        safeText: "UNSAFE_TEXT_SHOULD_NOT_BE_STREAMED"
      }
    );

    await request(app)
      .post(`/api/notifications/${notification.id}/read`)
      .set("Cookie", await createSessionCookie(user))
      .expect(200);

    expect(eventPublisher.publishNotificationRead).toHaveBeenCalledTimes(1);
    expect(eventPublisher.publishNotificationRead).toHaveBeenCalledWith(
      user.id,
      {
        notificationId: notification.id,
        club: {
          id: club.id,
          linkName: club.linkName
        },
        postId: notification.postId,
        commentId: notification.commentId,
        occurredAt: "2026-01-01T12:00:00.000Z"
      }
    );
    expect(
      JSON.stringify(
        vi.mocked(eventPublisher.publishNotificationRead).mock.calls
      )
    ).not.toContain("UNSAFE_TEXT_SHOULD_NOT_BE_STREAMED");
  });

  it("validates query params and notification ids", async () => {
    const user = repository.createStoredUser(validUserInput());

    await request(app)
      .get("/api/notifications?limit=100")
      .set("Cookie", await createSessionCookie(user))
      .expect(400);

    await request(app)
      .post("/api/notifications/not-a-uuid/read")
      .set("Cookie", await createSessionCookie(user))
      .expect(400);

    await request(app)
      .delete("/api/notifications/not-a-uuid")
      .set("Cookie", await createSessionCookie(user))
      .expect(400);

    await request(app)
      .delete("/api/notifications/selected")
      .set("Cookie", await createSessionCookie(user))
      .send({ notificationIds: [] })
      .expect(400);

    await request(app)
      .delete("/api/notifications/selected")
      .set("Cookie", await createSessionCookie(user))
      .send({ notificationIds: ["not-a-uuid"] })
      .expect(400);
  });
});

const createNotificationsTestApp = (
  repository: InMemoryNotificationsRepository,
  eventPublisher: EventsService = createMockEventsService()
) => {
  const app = express();
  const authService = createAuthService(repository);
  const authMiddleware = createAuthMiddleware(authService);
  const notificationsService = createNotificationsService(
    repository,
    eventPublisher
  );
  const notificationsController =
    createNotificationsController(notificationsService);

  app.disable("x-powered-by");
  app.use(requestIdMiddleware);
  app.use(express.json());
  app.use(cookieParser());
  app.use(
    "/api/notifications",
    createNotificationsRouter(notificationsController, authMiddleware)
  );
  app.use(errorHandler);

  return app;
};

const createMockEventsService = (): EventsService => ({
  subscribe: vi.fn(() => () => undefined),
  publishNotificationCreated: vi.fn(),
  publishNotificationRead: vi.fn()
});

type StoredClub = {
  id: string;
  title: string;
  linkName: string;
};

type StoredMilestone = {
  id: string;
  clubId: string;
  position: number;
  safeTitle: string;
  targetPostId: string | null;
};

type StoredNotification = NotificationRecord & {
  userId: string;
  postTitle?: string;
  commentBody?: string;
};

class InMemoryNotificationsRepository
  implements AuthUsersRepository, NotificationsRepository
{
  readonly usersByEmail = new Map<
    string,
    AuthUserRecord & { passwordHash: string }
  >();
  readonly clubs = new Map<string, StoredClub>();
  readonly progressRows: Array<{
    userId: string;
    clubId: string;
    position: number | null;
    mode: ProgressMode;
  }> = [];
  readonly notifications: StoredNotification[] = [];

  findActiveUserByEmail = async (email: string) =>
    this.usersByEmail.get(email) ?? null;

  findActiveUserById = async (id: string) => {
    for (const user of this.usersByEmail.values()) {
      if (user.id === id) {
        return user;
      }
    }

    return null;
  };

  findActiveUserCredentialsByEmail = async (
    email: string
  ): Promise<AuthUserCredentialsRecord | null> =>
    this.usersByEmail.get(email) ?? null;

  createUser = async (input: CreateAuthUserInput) =>
    this.createStoredUser(input);

  createStoredUser = ({
    email,
    displayName,
    passwordHash
  }: CreateAuthUserInput) => {
    const now = new Date();
    const user = {
      id: crypto.randomUUID(),
      email,
      displayName,
      username: null,
      bio: null,
      passwordHash,
      sessionVersion: 1,
      createdAt: now,
      updatedAt: now
    };

    this.usersByEmail.set(email, user);

    return user;
  };

  createClub = (title: string): StoredClub => {
    const club = {
      id: crypto.randomUUID(),
      title,
      linkName: title.toLowerCase().replace(/\s+/g, "-")
    };

    this.clubs.set(club.id, club);

    return club;
  };

  createMilestone = (clubId: string, position: number): StoredMilestone => ({
    id: crypto.randomUUID(),
    clubId,
    position,
    safeTitle: `Milestone ${position}`,
    targetPostId: null
  });

  setProgress = (
    userId: string,
    clubId: string,
    position: number | null,
    mode: ProgressMode = "STRICT"
  ) => {
    this.progressRows.push({
      userId,
      clubId,
      position,
      mode
    });
  };

  createNotification = (
    userId: string,
    clubId: string,
    milestone: StoredMilestone,
    input: {
      commentBody?: string;
      createdAt?: Date;
      postTitle?: string;
      readAt?: Date | null;
      safeText?: string;
      type?: NotificationType;
      postId?: string | null;
      commentId?: string | null;
    } = {}
  ): StoredNotification => {
    const club = this.clubs.get(clubId);

    if (!club) {
      throw new Error("Notification fixture requires an existing club.");
    }

    const progress = this.findProgress(userId, clubId);
    const postId =
      "postId" in input && input.postId !== undefined
        ? input.postId
        : crypto.randomUUID();
    const commentId =
      "commentId" in input && input.commentId !== undefined
        ? input.commentId
        : crypto.randomUUID();
    const notification = {
      id: crypto.randomUUID(),
      userId,
      type: input.type ?? "POST_COMMENT",
      safeText: input.safeText ?? `New comment in ${club.title}`,
      club,
      postId,
      commentId,
      requiredMilestone: milestone,
      progress: {
        mode: progress?.mode ?? "STRICT",
        currentMilestonePosition: progress?.position ?? null
      },
      readAt: input.readAt ?? null,
      createdAt:
        input.createdAt ??
        new Date(Date.UTC(2026, 0, 1, 12, this.notifications.length)),
      postTitle: input.postTitle,
      commentBody: input.commentBody
    };

    this.notifications.push(notification);

    return notification;
  };

  listNotificationsForUser = async (
    userId: string,
    { cursor, limit }: ListNotificationsInput
  ): Promise<ListNotificationsResult> => {
    const rows = this.notifications
      .filter((notification) => notification.userId === userId)
      .sort(compareNotifications);
    const startIndex = cursor
      ? rows.findIndex(
          (notification) =>
            notification.createdAt.getTime() === cursor.createdAt.getTime() &&
            notification.id === cursor.id
        ) + 1
      : 0;
    const pageRows = rows.slice(startIndex, startIndex + limit + 1);
    const notifications = pageRows.slice(0, limit);
    const lastNotification = notifications[notifications.length - 1];

    return {
      notifications: notifications.map((notification) =>
        this.withCurrentProgress(notification)
      ),
      nextCursor:
        pageRows.length > limit && lastNotification
          ? {
              createdAt: lastNotification.createdAt,
              id: lastNotification.id
            }
          : null,
      hasMore: pageRows.length > limit,
      unreadCount: this.notifications.filter(
        (notification) =>
          notification.userId === userId && notification.readAt === null
      ).length
    };
  };

  markNotificationRead = async (notificationId: string, userId: string) => {
    const notification = this.notifications.find(
      (storedNotification) =>
        storedNotification.id === notificationId &&
        storedNotification.userId === userId
    );

    if (!notification) {
      return null;
    }

    notification.readAt = new Date("2026-01-01T12:00:00.000Z");

    return {
      notification: this.withCurrentProgress(notification),
      unreadCount: this.notifications.filter(
        (storedNotification) =>
          storedNotification.userId === userId &&
          storedNotification.readAt === null
      ).length
    };
  };

  markAllNotificationsRead = async (userId: string) => {
    let updatedCount = 0;

    for (const notification of this.notifications) {
      if (notification.userId === userId && notification.readAt === null) {
        notification.readAt = new Date("2026-01-01T12:00:00.000Z");
        updatedCount += 1;
      }
    }

    return {
      updatedCount,
      unreadCount: 0
    };
  };

  deleteNotification = async (notificationId: string, userId: string) => {
    const notificationIndex = this.notifications.findIndex(
      (notification) =>
        notification.id === notificationId && notification.userId === userId
    );

    if (notificationIndex === -1) {
      return null;
    }

    this.notifications.splice(notificationIndex, 1);

    return {
      deletedCount: 1,
      unreadCount: this.notifications.filter(
        (notification) =>
          notification.userId === userId && notification.readAt === null
      ).length
    };
  };

  deleteSelectedNotifications = async (
    notificationIds: string[],
    userId: string
  ) => {
    const selectedNotificationIds = new Set(notificationIds);
    const startingCount = this.notifications.length;
    const retainedNotifications = this.notifications.filter(
      (notification) =>
        notification.userId !== userId ||
        !selectedNotificationIds.has(notification.id)
    );

    this.notifications.splice(0, this.notifications.length);
    this.notifications.push(...retainedNotifications);

    return {
      deletedCount: startingCount - this.notifications.length,
      unreadCount: this.notifications.filter(
        (notification) =>
          notification.userId === userId && notification.readAt === null
      ).length
    };
  };

  deleteAllNotifications = async (userId: string) => {
    const startingCount = this.notifications.length;
    const retainedNotifications = this.notifications.filter(
      (notification) => notification.userId !== userId
    );

    this.notifications.splice(0, this.notifications.length);
    this.notifications.push(...retainedNotifications);

    return {
      deletedCount: startingCount - this.notifications.length,
      unreadCount: 0
    };
  };

  private findProgress = (userId: string, clubId: string) =>
    this.progressRows.find(
      (progress) => progress.userId === userId && progress.clubId === clubId
    );

  private withCurrentProgress = (
    notification: StoredNotification
  ): NotificationRecord => {
    const progress = this.findProgress(notification.userId, notification.club.id);

    return {
      id: notification.id,
      type: notification.type,
      safeText: notification.safeText,
      club: notification.club,
      postId: notification.postId,
      commentId: notification.commentId,
      requiredMilestone: notification.requiredMilestone,
      progress: {
        mode: progress?.mode ?? "STRICT",
        currentMilestonePosition: progress?.position ?? null
      },
      readAt: notification.readAt,
      createdAt: notification.createdAt
    };
  };
}

const compareNotifications = (
  firstNotification: StoredNotification,
  secondNotification: StoredNotification
) =>
  secondNotification.createdAt.getTime() -
    firstNotification.createdAt.getTime() ||
  firstNotification.id.localeCompare(secondNotification.id);

const createSessionCookie = async (user: AuthUserRecord) => {
  const token = await createSessionToken({
    userId: user.id,
    sessionVersion: user.sessionVersion
  });

  return `${env.SESSION_COOKIE_NAME}=${token}`;
};

const validUserInput = (): CreateAuthUserInput => ({
  email: "reader@example.com",
  displayName: "Reader",
  passwordHash: "hashed-password"
});
