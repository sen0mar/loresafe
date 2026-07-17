import type { ReactNode } from "react";
import {
  focusManager,
  QueryClient,
  QueryClientProvider
} from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { vi } from "vitest";

import { RETAINED_INFINITE_QUERY_PAGES } from "@/shared/api/infinite-query";

import {
  useNotificationsInfiniteQuery,
  useUnreadNotificationsQuery
} from "./notifications.js";

describe("notifications infinite query retention", () => {
  it("drops the oldest page after the retained-page limit", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = new URL(
          input instanceof Request ? input.url : input.toString(),
          "http://localhost"
        );
        const pageNumber = Number(url.searchParams.get("cursor") ?? "0") + 1;
        const nextCursor = pageNumber < 6 ? String(pageNumber) : null;

        return Response.json({
          notifications: [createNotification(pageNumber)],
          unreadCount: 6,
          pagination: {
            limit: 20,
            nextCursor,
            hasMore: nextCursor !== null
          }
        });
      })
    );

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } }
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useNotificationsInfiniteQuery(), {
      wrapper
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.pages[0]?.pagination.nextCursor).toBe("1");
    expect(result.current.hasNextPage).toBe(true);

    for (let pageNumber = 2; pageNumber <= 6; pageNumber += 1) {
      await act(async () => {
        await result.current.fetchNextPage();
      });
      await waitFor(() =>
        expect(result.current.data?.pages.at(-1)?.notifications[0]?.id).toBe(
          `notification-${pageNumber}`
        )
      );
    }

    expect(result.current.data?.pages).toHaveLength(
      RETAINED_INFINITE_QUERY_PAGES
    );
    expect(result.current.data?.pages[0]?.notifications[0]?.id).toBe(
      "notification-2"
    );
  });

  it("refetches stale notification data when the window regains focus", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        notifications: [],
        unreadCount: 0,
        pagination: {
          limit: 1,
          nextCursor: null,
          hasMore: false
        }
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } }
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    renderHook(() => useUnreadNotificationsQuery(), { wrapper });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    focusManager.setFocused(false);
    focusManager.setFocused(true);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    focusManager.setFocused(undefined);
  });
});

const createNotification = (pageNumber: number) => ({
  id: `notification-${pageNumber}`,
  visibility: "VISIBLE",
  type: "POST_COMMENT",
  safeText: "Someone commented on a discussion.",
  club: {
    id: "00000000-0000-4000-8000-000000000001",
    title: "Safe club",
    linkName: "safe-club"
  },
  postId: null,
  commentId: null,
  requiredMilestone: {
    id: "00000000-0000-4000-8000-000000000002",
    position: 1,
    label: "Opening"
  },
  readAt: null,
  createdAt: "2026-01-01T00:00:00.000Z"
});
