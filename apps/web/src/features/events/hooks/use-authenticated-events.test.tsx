import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";

import { authQueryKeys, type AuthUser } from "@/features/auth/api/auth";

import { useAuthenticatedEvents } from "./use-authenticated-events";

class ControlledEventSource {
  static instances: ControlledEventSource[] = [];

  onerror: (() => void) | null = null;
  onopen: (() => void) | null = null;
  addEventListener = vi.fn();
  close = vi.fn();

  constructor(
    readonly url: string,
    readonly options?: EventSourceInit
  ) {
    ControlledEventSource.instances.push(this);
  }
}

describe("useAuthenticatedEvents", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("EventSource", ControlledEventSource);
    ControlledEventSource.instances = [];
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("refreshes an expired session before reconnecting", async () => {
    let meRequestCount = 0;
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const path = new URL(input.toString(), "http://localhost").pathname;

        if (path === "/api/auth/me") {
          meRequestCount += 1;

          if (meRequestCount === 1) {
            return apiErrorResponse(401, "UNAUTHORIZED");
          }

          return Response.json({ user: authUser });
        }

        if (path === "/api/auth/refresh" && init?.method === "POST") {
          return Response.json({ user: authUser });
        }

        throw new Error(`Unhandled request: ${init?.method ?? "GET"} ${path}`);
      }
    );
    vi.stubGlobal("fetch", fetchMock);
    const queryClient = createQueryClient();

    renderEventsHook(queryClient);
    await triggerConnectionError();

    expect(requestPaths(fetchMock)).toEqual([
      "/api/auth/me",
      "/api/auth/refresh",
      "/api/auth/me"
    ]);
    expect(queryClient.getQueryData(authQueryKeys.me)).toEqual(authUser);

    await act(() => vi.advanceTimersByTimeAsync(2_999));
    expect(ControlledEventSource.instances).toHaveLength(1);

    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(ControlledEventSource.instances).toHaveLength(2);
  });

  it("clears auth state and stops reconnecting when refresh is rejected", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const path = new URL(input.toString(), "http://localhost").pathname;

        if (path === "/api/auth/me" || path === "/api/auth/refresh") {
          return apiErrorResponse(401, "UNAUTHORIZED");
        }

        throw new Error(`Unhandled request: ${path}`);
      })
    );
    const queryClient = createQueryClient();
    queryClient.setQueryData(authQueryKeys.me, authUser);

    renderEventsHook(queryClient);
    await triggerConnectionError();

    expect(queryClient.getQueryData(authQueryKeys.me)).toBeNull();

    await act(() => vi.advanceTimersByTimeAsync(120_000));
    expect(ControlledEventSource.instances).toHaveLength(1);
  });

  it("backs off transient reconnect failures and resets after opening", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("offline"))));
    const queryClient = createQueryClient();

    renderEventsHook(queryClient);
    await triggerConnectionError();
    await act(() => vi.advanceTimersByTimeAsync(3_000));

    expect(ControlledEventSource.instances).toHaveLength(2);

    await triggerConnectionError(1);
    await act(() => vi.advanceTimersByTimeAsync(5_999));
    expect(ControlledEventSource.instances).toHaveLength(2);

    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(ControlledEventSource.instances).toHaveLength(3);

    ControlledEventSource.instances[2]?.onopen?.();
    await triggerConnectionError(2);
    await act(() => vi.advanceTimersByTimeAsync(3_000));
    expect(ControlledEventSource.instances).toHaveLength(4);
  });
});

const renderEventsHook = (queryClient: QueryClient) => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return renderHook(() => useAuthenticatedEvents(true), { wrapper });
};

const triggerConnectionError = async (sourceIndex = 0) => {
  await act(async () => {
    ControlledEventSource.instances[sourceIndex]?.onerror?.();
    await flushPromises();
  });
};

const flushPromises = async () => {
  for (let index = 0; index < 6; index += 1) {
    await Promise.resolve();
  }
};

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      }
    }
  });

const apiErrorResponse = (status: number, code: string) =>
  Response.json(
    {
      error: {
        code,
        message: "Authentication required"
      }
    },
    { status }
  );

const requestPaths = (fetchMock: ReturnType<typeof vi.fn>) =>
  fetchMock.mock.calls.map(([input]) =>
    new URL((input as RequestInfo | URL).toString(), "http://localhost").pathname
  );

const authUser: AuthUser = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "reader@example.com",
  displayName: "Reader",
  username: "reader",
  bio: null,
  avatarUrl: null,
  createdAt: "2026-01-01T12:00:00.000Z",
  updatedAt: "2026-01-01T12:00:00.000Z"
};
