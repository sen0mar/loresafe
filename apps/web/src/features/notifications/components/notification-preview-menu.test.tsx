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
});
