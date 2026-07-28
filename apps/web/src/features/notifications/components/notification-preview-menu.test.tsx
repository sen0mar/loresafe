import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";
import { vi } from "vitest";

import { NotificationPreviewMenu } from "./notification-preview-menu.js";

describe("notification preview refresh", () => {
  it("refetches notifications whenever the menu opens", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        notifications: [],
        unreadCount: 0,
        pagination: {
          limit: 3,
          nextCursor: null,
          hasMore: false
        }
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } }
    });
    const user = userEvent.setup();

    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <NotificationPreviewMenu unreadCount={0} />
        </BrowserRouter>
      </QueryClientProvider>
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await user.click(screen.getByRole("button", { name: "Notifications" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  it("renders account security notifications without club metadata", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          notifications: [
            {
              id: "00000000-0000-4000-8000-000000000001",
              visibility: "VISIBLE",
              type: "SECURITY_ALERT",
              safeText: "We blocked reuse of an old sign-in token.",
              club: null,
              postId: null,
              commentId: null,
              requiredMilestone: null,
              readAt: null,
              createdAt: "2026-07-28T12:00:00.000Z"
            }
          ],
          unreadCount: 1,
          pagination: {
            limit: 3,
            nextCursor: null,
            hasMore: false
          }
        })
      )
    );
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } }
    });
    const user = userEvent.setup();

    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <NotificationPreviewMenu unreadCount={1} />
        </BrowserRouter>
      </QueryClientProvider>
    );

    await user.click(screen.getByRole("button", { name: "Notifications" }));

    expect(
      await screen.findByText("We blocked reuse of an old sign-in token.")
    ).toBeVisible();
    expect(screen.getByText(/Account security/).closest("a")).toHaveAttribute(
      "href",
      "/app/notifications"
    );
  });
});
