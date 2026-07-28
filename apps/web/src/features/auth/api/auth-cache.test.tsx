import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  authQueryKeys,
  replaceAuthenticatedQueryState,
  type AuthUser,
  useMe
} from "./auth.js";

const firstUser: AuthUser = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "first@example.com",
  displayName: "First Reader",
  username: "first_reader",
  bio: null,
  avatarUrl: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z"
};

const secondUser: AuthUser = {
  ...firstUser,
  id: "00000000-0000-4000-8000-000000000002",
  email: "second@example.com",
  displayName: "Second Reader",
  username: "second_reader"
};

describe("authenticated query state", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  it("cancels active queries and clears all cached state before changing users", async () => {
    const queryClient = createQueryClient();
    let wasAborted = false;

    queryClient.setQueryData(authQueryKeys.cacheOwner, {
      userId: firstUser.id
    });
    queryClient.setQueryData(authQueryKeys.me, firstUser);
    queryClient.setQueryData(["clubs", "private"], {
      title: "First user's private club"
    });
    queryClient.getMutationCache().build(queryClient, {
      mutationKey: ["private", "mutation"],
      mutationFn: async () => undefined
    });

    const pendingQuery = queryClient
      .fetchQuery({
        queryKey: ["private", "pending"],
        queryFn: ({ signal }) =>
          new Promise<never>((_resolve, reject) => {
            signal.addEventListener("abort", () => {
              wasAborted = true;
              reject(new DOMException("Aborted", "AbortError"));
            });
          })
      })
      .catch(() => undefined);

    await replaceAuthenticatedQueryState(queryClient, secondUser);
    await pendingQuery;

    expect(wasAborted).toBe(true);
    expect(queryClient.getQueryData(["clubs", "private"])).toBeUndefined();
    expect(queryClient.getMutationCache().getAll()).toHaveLength(0);
    expect(queryClient.getQueryData(authQueryKeys.me)).toEqual(secondUser);
    expect(queryClient.getQueryData(authQueryKeys.cacheOwner)).toEqual({
      userId: secondUser.id
    });
  });

  it("keeps active auth observers connected when signing out", async () => {
    const queryClient = createQueryClient();
    queryClient.setQueryDefaults(authQueryKeys.me, {
      staleTime: Number.POSITIVE_INFINITY
    });
    queryClient.setQueryData(authQueryKeys.cacheOwner, {
      userId: firstUser.id
    });
    queryClient.setQueryData(authQueryKeys.me, firstUser);
    queryClient.setQueryData(["clubs", "private"], {
      title: "First user's private club"
    });

    const { result } = renderHook(() => useMe(), {
      wrapper: createWrapper(queryClient)
    });

    await waitFor(() => expect(result.current.data).toEqual(firstUser));
    await replaceAuthenticatedQueryState(queryClient, null);

    await waitFor(() => expect(result.current.data).toBeNull());
    expect(queryClient.getQueryData(["clubs", "private"])).toBeUndefined();
    expect(queryClient.getQueryData(authQueryKeys.cacheOwner)).toEqual({
      userId: null
    });
  });

  it("clears private cached data when the API reports session loss", async () => {
    const queryClient = createQueryClient();

    queryClient.setQueryData(authQueryKeys.cacheOwner, {
      userId: firstUser.id
    });
    queryClient.setQueryData(["notifications", "private"], {
      text: "First user's private notification"
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: { code: "UNAUTHORIZED", message: "Authentication required" }
          }),
          {
            status: 401,
            headers: { "Content-Type": "application/json" }
          }
        )
      )
    );

    const { result } = renderHook(() => useMe(), {
      wrapper: createWrapper(queryClient)
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await waitFor(() =>
      expect(
        queryClient.getQueryData(["notifications", "private"])
      ).toBeUndefined()
    );

    expect(queryClient.getQueryData(authQueryKeys.me)).toBeNull();
    expect(queryClient.getQueryData(authQueryKeys.cacheOwner)).toEqual({
      userId: null
    });
  });
});

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      }
    }
  });

const createWrapper =
  (queryClient: QueryClient) =>
  ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
