import type { ReactNode } from "react";
import {
  MutationCache,
  QueryClient,
  QueryClientProvider
} from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  useUpdateCurrentUserProfile,
  useDeleteCurrentUserAccount
} from "@/features/profile/api/profile";
import {
  useTogglePostReactionMutation,
  useToggleCommentReactionMutation
} from "@/features/clubs/api/clubs.mutation-hooks";
import { clubsQueryKeys } from "@/features/clubs/api/clubs.query-keys";
import {
  useMarkAllNotificationsReadMutation,
  notificationsQueryKeys
} from "@/features/notifications/api/notifications";
import { useOwnedMutation } from "@/shared/api/use-owned-mutation";
import {
  authQueryKeys,
  replaceAuthenticatedQueryState,
  useLogin,
  useLogout,
  type AuthUser
} from "./auth";

const userA: AuthUser = {
  id: "account-a",
  email: "a@example.com",
  displayName: "Reader A",
  username: "reader_a",
  bio: null,
  avatarUrl: null,
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01"
};
const userB: AuthUser = { ...userA, id: "account-b", displayName: "Reader B" };
const destinations = [null, userB, userA];
const post = {
  id: "post",
  visibility: "VISIBLE",
  title: "A private post",
  bodyPreview: "A spoiler",
  counts: {
    reactionCount: 0,
    reactions: [{ emoji: "👍", count: 0, reactedByMe: false }]
  }
};
const comment = { ...post, id: "comment", body: "A private comment" };
const feedKey = clubsQueryKeys.feed("club", "safe");
const detailKey = clubsQueryKeys.postDetail("post");
const commentsKey = clubsQueryKeys.postComments("post");

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
const json = (value: unknown) =>
  new Response(JSON.stringify(value), {
    headers: { "Content-Type": "application/json" }
  });
const wrapper =
  (client: QueryClient) =>
  ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
const createClient = async (mutationCache?: MutationCache) => {
  const client = new QueryClient({
    mutationCache,
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });
  await replaceAuthenticatedQueryState(client, userA);
  return client;
};
const switchAccount = async (
  client: QueryClient,
  destination: AuthUser | null
) => {
  await replaceAuthenticatedQueryState(client, null);
  if (destination) await replaceAuthenticatedQueryState(client, destination);
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("mutation ownership with installed TanStack Query", () => {
  it.each(destinations)(
    "does not restore A's delayed profile after transition to %j",
    async (destination) => {
      const client = await createClient();
      const request = deferred<Response>();
      const fetch = vi.fn(() => request.promise);
      vi.stubGlobal("fetch", fetch);
      const { result } = renderHook(useUpdateCurrentUserProfile, {
        wrapper: wrapper(client)
      });
      const onSuccess = vi.fn();
      let completion!: Promise<unknown>;
      act(() => {
        completion = result.current
          .mutateAsync(
            { displayName: "A edited", bio: "Private" },
            { onSuccess }
          )
          .catch((error) => error);
      });
      await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
      await act(() => switchAccount(client, destination));
      await act(async () => {
        request.resolve(json({ user: { ...userA, bio: "Private" } }));
        await completion;
      });
      expect(client.getQueryData(authQueryKeys.me)).toEqual(destination);
      expect(onSuccess).not.toHaveBeenCalled();
      expect(client.getMutationCache().getAll()).toHaveLength(0);
    }
  );

  for (const reaction of ["post", "comment"] as const) {
    for (const outcome of ["resolve", "reject"] as const) {
      it.each(destinations)(
        `does not restore optimistic ${reaction} data on ${outcome} after transition to %j`,
        async (destination) => {
          const client = await createClient();
          client.setQueryData(detailKey, { post });
          client.setQueryData(feedKey, {
            pages: [{ posts: [post] }],
            pageParams: [null]
          });
          client.setQueryData(commentsKey, {
            pages: [{ comments: [comment] }],
            pageParams: [null]
          });
          const request = deferred<Response>();
          const fetch = vi.fn(() => request.promise);
          vi.stubGlobal("fetch", fetch);
          const rollback = vi.fn();
          const { result } = renderHook(
            () => {
              const postMutation = useTogglePostReactionMutation("post", {
                onRollbackPost: rollback
              });
              const commentMutation = useToggleCommentReactionMutation(
                "post",
                "comment"
              );
              return reaction === "post" ? postMutation : commentMutation;
            },
            { wrapper: wrapper(client) }
          );
          let completion!: Promise<unknown>;
          act(() => {
            completion = result.current
              .mutateAsync({ emoji: "👍", active: true })
              .catch((error) => error);
          });
          await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
          expect(
            JSON.stringify(
              client.getQueryData(reaction === "post" ? detailKey : commentsKey)
            )
          ).toContain('"reactedByMe":true');
          await act(() => switchAccount(client, destination));
          if (destination) {
            client.setQueryData(detailKey, { currentSession: "safe detail" });
            client.setQueryData(feedKey, { currentSession: "safe feed" });
            client.setQueryData(commentsKey, {
              currentSession: "safe comments"
            });
          }
          const before = [detailKey, feedKey, commentsKey].map((key) =>
            client.getQueryData(key)
          );
          const invalidate = vi.spyOn(client, "invalidateQueries");
          await act(async () => {
            if (outcome === "resolve") request.resolve(json({ post, comment }));
            else request.reject(new Error("Write failed"));
            await completion;
          });
          expect(
            [detailKey, feedKey, commentsKey].map((key) =>
              client.getQueryData(key)
            )
          ).toEqual(before);
          expect(rollback).not.toHaveBeenCalled();
          expect(invalidate).not.toHaveBeenCalled();
          expect(client.getQueryData(authQueryKeys.me)).toEqual(destination);
        }
      );
    }
  }

  it("leaves B's notifications and unread count unchanged on A's delayed success", async () => {
    const client = await createClient();
    const request = deferred<Response>();
    const fetch = vi.fn(() => request.promise);
    vi.stubGlobal("fetch", fetch);
    const { result } = renderHook(useMarkAllNotificationsReadMutation, {
      wrapper: wrapper(client)
    });
    act(() => result.current.mutate(undefined));
    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    await act(() => switchAccount(client, userB));
    const unread = { unreadCount: 7, notifications: [] };
    const list = { pages: [unread], pageParams: [null] };
    client.setQueryData(notificationsQueryKeys.unread, unread);
    client.setQueryData(notificationsQueryKeys.list, list);
    const invalidate = vi.spyOn(client, "invalidateQueries");
    await act(async () => {
      request.resolve(json({ unreadCount: 0, updatedCount: 12 }));
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(client.getQueryData(notificationsQueryKeys.unread)).toEqual(unread);
    expect(client.getQueryData(notificationsQueryKeys.list)).toEqual(list);
    expect(invalidate).not.toHaveBeenCalled();
  });

  it("fences asynchronous onMutate preparation before optimistic writes and the request", async () => {
    const preparation = deferred<void>();
    const entered = vi.fn();
    const client = await createClient(
      new MutationCache({
        onMutate: () => {
          entered();
          return preparation.promise;
        }
      })
    );
    const mutationFn = vi.fn(async () => "A response");
    const onMutate = vi.fn(() => {
      client.setQueryData(["private"], "A optimistic");
    });
    const onSettled = vi.fn(() => {
      client.invalidateQueries();
    });
    const { result } = renderHook(
      () => useOwnedMutation({ mutationFn, onMutate, onSettled }),
      { wrapper: wrapper(client) }
    );
    act(() => result.current.mutate(undefined));
    await waitFor(() => expect(entered).toHaveBeenCalledOnce());
    await act(() => switchAccount(client, userB));
    await act(async () => {
      preparation.resolve();
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(onMutate).not.toHaveBeenCalled();
    expect(mutationFn).not.toHaveBeenCalled();
    expect(onSettled).not.toHaveBeenCalled();
    expect(client.getQueryData(["private"])).toBeUndefined();
  });

  it("rejects a queued mutation before it sends a request with the next account", async () => {
    const client = await createClient();
    const first = deferred<string>();
    const mutationFn = vi.fn(() => first.promise);
    const { result } = renderHook(
      () => useOwnedMutation({ mutationFn, scope: { id: "serial" } }),
      { wrapper: wrapper(client) }
    );
    act(() => {
      result.current.mutate(undefined);
      result.current.mutate(undefined);
    });
    await waitFor(() => expect(mutationFn).toHaveBeenCalledOnce());
    // Preserve the queue to exercise TanStack's continuation as well as normal cache clearing.
    vi.spyOn(client.getMutationCache(), "clear").mockImplementation(
      () => undefined
    );
    await act(() => switchAccount(client, userB));
    await act(async () => {
      first.resolve("A response");
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mutationFn).toHaveBeenCalledOnce();
  });

  it("advances the fence before cancellation resolves and ignores superseded replacements", async () => {
    const client = await createClient();
    const cancellation = deferred<void>();
    vi.spyOn(client, "cancelQueries").mockReturnValueOnce(cancellation.promise);
    const firstReplacement = replaceAuthenticatedQueryState(client, null);
    await replaceAuthenticatedQueryState(client, userB);
    cancellation.resolve();
    await firstReplacement;
    expect(client.getQueryData(authQueryKeys.me)).toEqual(userB);
  });

  it.each(["login", "logout"] as const)(
    "ignores delayed %s A after login B",
    async (operation) => {
      const client = await createClient();
      const request = deferred<Response>();
      const fetch = vi.fn(() => request.promise);
      vi.stubGlobal("fetch", fetch);
      const { result } = renderHook(
        () => ({ login: useLogin(), logout: useLogout() }),
        { wrapper: wrapper(client) }
      );
      const onSuccess = vi.fn();
      act(() => {
        if (operation === "login")
          result.current.login.mutate(
            { email: userA.email, password: "password" },
            { onSuccess }
          );
        else result.current.logout.mutate(undefined, { onSuccess });
      });
      await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
      await act(() => switchAccount(client, userB));
      await act(async () => {
        request.resolve(json(operation === "login" ? { user: userA } : null));
      });
      await waitFor(() => expect(result.current[operation].isError).toBe(true));
      expect(client.getQueryData(authQueryKeys.me)).toEqual(userB);
      expect(onSuccess).not.toHaveBeenCalled();
    }
  );

  it("preserves current login/logout success callbacks across their own auth replacement", async () => {
    const client = await createClient();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(json({ user: userB }))
        .mockResolvedValueOnce(json(null))
    );
    const { result } = renderHook(
      () => ({ login: useLogin(), logout: useLogout() }),
      { wrapper: wrapper(client) }
    );
    const loggedIn = vi.fn();
    const loggedOut = vi.fn();
    await act(() =>
      result.current.login.mutateAsync(
        { email: userB.email, password: "password" },
        { onSuccess: loggedIn }
      )
    );
    expect(client.getQueryData(authQueryKeys.me)).toEqual(userB);
    expect(loggedIn).toHaveBeenCalledOnce();
    await act(() =>
      result.current.logout.mutateAsync(undefined, { onSuccess: loggedOut })
    );
    expect(client.getQueryData(authQueryKeys.me)).toBeNull();
    expect(loggedOut).toHaveBeenCalledOnce();
  });
  it("preserves account deletion's navigation callback", async () => {
    const client = await createClient();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(null)));
    const { result } = renderHook(useDeleteCurrentUserAccount, {
      wrapper: wrapper(client)
    });
    const onSuccess = vi.fn();
    await act(() =>
      result.current.mutateAsync(
        { confirmation: "delete", password: "password" },
        { onSuccess }
      )
    );
    expect(client.getQueryData(authQueryKeys.me)).toBeNull();
    expect(onSuccess).toHaveBeenCalledOnce();
  });

  it("rejects an old await continuation when identity changes during an async success callback", async () => {
    const client = await createClient();
    const callback = deferred<void>();
    const entered = vi.fn();
    const onSettled = vi.fn();
    const { result } = renderHook(
      () =>
        useOwnedMutation({
          mutationFn: async () => "A private response",
          onSuccess: () => {
            entered();
            return callback.promise;
          },
          onSettled
        }),
      { wrapper: wrapper(client) }
    );
    const continuation = vi.fn();
    let completion!: Promise<unknown>;
    act(() => {
      completion = result.current
        .mutateAsync(undefined)
        .then(continuation)
        .catch((error) => error);
    });
    await waitFor(() => expect(entered).toHaveBeenCalledOnce());
    await act(() => switchAccount(client, userB));
    await act(async () => {
      callback.resolve();
      await completion;
    });
    expect(continuation).not.toHaveBeenCalled();
    expect(onSettled).not.toHaveBeenCalled();
  });

  it("blocks old success writes immediately while auth cancellation is still pending", async () => {
    const client = await createClient();
    const request = deferred<Response>();
    const fetch = vi.fn(() => request.promise);
    vi.stubGlobal("fetch", fetch);
    const { result } = renderHook(useUpdateCurrentUserProfile, {
      wrapper: wrapper(client)
    });
    act(() =>
      result.current.mutate({ displayName: "A edited", bio: "Private" })
    );
    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    const cancellation = deferred<void>();
    vi.spyOn(client, "cancelQueries").mockReturnValueOnce(cancellation.promise);
    const replacement = replaceAuthenticatedQueryState(client, userB);
    await act(async () => {
      request.resolve(json({ user: { ...userA, bio: "Private" } }));
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(client.getQueryData(authQueryKeys.me)).toEqual(userA);
    await act(async () => {
      cancellation.resolve();
      await replacement;
    });
    expect(client.getQueryData(authQueryKeys.me)).toEqual(userB);
  });
  it("keeps mutation functions stable across pending and success rerenders", async () => {
    const client = await createClient();
    const request = deferred<string>();
    const { result, rerender } = renderHook(
      () => useOwnedMutation({ mutationFn: () => request.promise }),
      { wrapper: wrapper(client) }
    );
    const { mutate, mutateAsync } = result.current;
    act(() => result.current.mutate(undefined));
    await waitFor(() => expect(result.current.isPending).toBe(true));
    rerender();
    expect(result.current.mutate).toBe(mutate);
    expect(result.current.mutateAsync).toBe(mutateAsync);
    await act(async () => {
      request.resolve("done");
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.mutate).toBe(mutate);
    expect(result.current.mutateAsync).toBe(mutateAsync);
  });

  it("retains normal profile success and optimistic reaction rollback for the current owner", async () => {
    const client = await createClient();
    const changed = { ...userA, displayName: "Changed" };
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(json({ user: changed }))
        .mockRejectedValueOnce(new Error("Rejected"))
    );
    client.setQueryData(detailKey, { post });
    const { result } = renderHook(
      () => ({
        profile: useUpdateCurrentUserProfile(),
        reaction: useTogglePostReactionMutation("post")
      }),
      { wrapper: wrapper(client) }
    );
    await act(() =>
      result.current.profile.mutateAsync({ displayName: "Changed", bio: "" })
    );
    expect(client.getQueryData(authQueryKeys.me)).toEqual(changed);
    await act(async () => {
      await result.current.reaction
        .mutateAsync({ emoji: "👍", active: true })
        .catch(() => undefined);
    });
    expect(client.getQueryData(detailKey)).toEqual({ post });
  });
  it("rejects success after an awaited global success callback crosses an auth transition", async () => {
    const callback = deferred<void>();
    const entered = vi.fn();
    const client = await createClient(
      new MutationCache({
        onSuccess: () => {
          entered();
          return callback.promise;
        }
      })
    );
    const onSuccess = vi.fn();
    const { result } = renderHook(
      () =>
        useOwnedMutation({
          mutationFn: async () => "A private response",
          onSuccess
        }),
      { wrapper: wrapper(client) }
    );
    act(() => result.current.mutate(undefined));
    await waitFor(() => expect(entered).toHaveBeenCalledOnce());
    await act(() => switchAccount(client, userB));
    await act(async () => {
      callback.resolve();
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
