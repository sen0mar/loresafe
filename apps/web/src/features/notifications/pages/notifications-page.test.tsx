import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  getJsonRequestBody,
  mockFetchRoutes,
  renderWithProviders
} from "@/test/render";

import { NotificationsPage } from "./notifications-page";

const now = "2026-01-01T12:00:00.000Z";

type MockFetchRequest = {
  body: unknown;
};

describe("NotificationsPage", () => {
  it("deletes user-selected notifications in one request", async () => {
    let notifications = [
      createNotification(firstNotificationId, "First safe notification"),
      createNotification(secondNotificationId, "Second safe notification")
    ];
    const fetchMock = mockFetchRoutes([
      shellRoute("/api/auth/me", { user: authUser }),
      shellRoute("/api/users/me/clubs", joinedClubsResponse),
      shellRoute("/api/notifications", () =>
        createNotificationsResponse(notifications)
      ),
      {
        method: "DELETE",
        path: "/api/notifications/selected",
        response: (request: MockFetchRequest) => {
          const notificationIds = getNotificationIds(request.body);

          notifications = notifications.filter(
            (notification) => !notificationIds.has(notification.id)
          );

          return {
            deletedCount: notificationIds.size,
            unreadCount: 0
          };
        }
      }
    ]);
    const user = userEvent.setup();

    renderWithProviders(<NotificationsPage />, {
      initialEntries: ["/app/notifications"]
    });

    expect(await screen.findByText("First safe notification")).toBeVisible();
    expect(
      screen.getByRole("link", { name: /First safe notification/ })
    ).toHaveAttribute(
      "href",
      "/app/posts/00000000-0000-4000-8000-000000000020"
    );
    expect(screen.queryByRole("link", { name: "Open" })).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("Select notification: First safe notification")
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Select all" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Delete all" })
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Select" }));

    expect(screen.getByRole("button", { name: "Select all" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Delete all" })).toBeVisible();
    await user.click(
      screen.getByLabelText("Select notification: First safe notification")
    );
    await user.click(
      screen.getByLabelText("Select notification: Second safe notification")
    );
    await user.click(screen.getByRole("button", { name: "Delete selected" }));

    const dialog = within(await screen.findByRole("dialog"));

    await user.click(dialog.getByRole("button", { name: "Delete selected" }));

    await waitFor(() =>
      expect(findFetchCall(fetchMock, "DELETE", "/api/notifications/selected"))
        .toBeTruthy()
    );
    const deleteCall = findFetchCall(
      fetchMock,
      "DELETE",
      "/api/notifications/selected"
    );

    expect(deleteCall ? getJsonRequestBody(deleteCall) : null).toEqual({
      notificationIds: [firstNotificationId, secondNotificationId]
    });
    await waitFor(() =>
      expect(
        screen.queryByText("First safe notification")
      ).not.toBeInTheDocument()
    );
    expect(
      screen.queryByText("Second safe notification")
    ).not.toBeInTheDocument();
  });
});

const firstNotificationId = "00000000-0000-4000-8000-000000000101";
const secondNotificationId = "00000000-0000-4000-8000-000000000102";

const createNotification = (id: string, safeText: string) => ({
  id,
  visibility: "VISIBLE",
  type: "POST_COMMENT",
  safeText,
  club: {
    id: "00000000-0000-4000-8000-000000000010",
    title: "Safe Club",
    linkName: "safe-club"
  },
  postId: "00000000-0000-4000-8000-000000000020",
  commentId: "00000000-0000-4000-8000-000000000030",
  requiredMilestone: {
    id: "00000000-0000-4000-8000-000000000011",
    position: 1,
    label: "Chapter 1"
  },
  readAt: null,
  createdAt: now
});

const authUser = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "reader@example.com",
  displayName: "Reader",
  username: "reader",
  bio: null,
  avatarUrl: null,
  createdAt: now,
  updatedAt: now
};

const joinedClubsResponse = {
  clubs: [
    {
      id: "00000000-0000-4000-8000-000000000010",
      title: "Safe Club",
      linkName: "safe-club",
      coverUrl: null,
      visibility: "PUBLIC",
      role: "MEMBER",
      memberCount: 3,
      joinedAt: now
    }
  ],
  pagination: {
    page: 1,
    limit: 20,
    total: 1,
    pageCount: 1
  }
};

const createNotificationsResponse = (
  notifications: ReturnType<typeof createNotification>[]
) => ({
  notifications,
  unreadCount: 2,
  pagination: {
    limit: 20,
    nextCursor: null,
    hasMore: false
  }
});

const shellRoute = (path: string, response: unknown) => ({
  method: "GET",
  path,
  response
});

const findFetchCall = (
  fetchMock: ReturnType<typeof mockFetchRoutes>,
  method: string,
  path: string
) =>
  fetchMock.mock.calls.find((call) => {
    const url = new URL(String(call[0]), "http://localhost:5173");
    const init = call[1] as RequestInit | undefined;
    const actualMethod = init?.method ?? "GET";

    return actualMethod === method && url.pathname === path;
  });

const getNotificationIds = (body: unknown) => {
  if (
    !body ||
    typeof body !== "object" ||
    !("notificationIds" in body) ||
    !Array.isArray(body.notificationIds)
  ) {
    return new Set<string>();
  }

  return new Set(
    body.notificationIds.filter(
      (notificationId): notificationId is string =>
        typeof notificationId === "string"
    )
  );
};
