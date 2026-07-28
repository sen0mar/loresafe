import { useEffect } from "react";
import {
  type QueryClient,
  useMutation,
  useQuery,
  useQueryClient
} from "@tanstack/react-query";

import { ApiError, apiGet, apiPost } from "@/shared/api/api-client";

import type { LoginFormValues } from "../schemas/login.schema.js";
import type { SignupRequestValues } from "../schemas/signup.schema.js";
import {
  clearAuthSessionHint,
  rememberAuthSessionHint
} from "./auth-session-hint.js";

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  username: string;
  bio: string | null;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AuthResponse = {
  user: AuthUser;
};

export const authQueryKeys = {
  me: ["auth", "me"] as const,
  cacheOwner: ["auth", "cache-owner"] as const
};

export const getMe = async (signal?: AbortSignal) => {
  try {
    const response = await apiGet<AuthResponse>("/api/auth/me", { signal });

    rememberAuthSessionHint();

    return response.user;
  } catch (error) {
    // Signed-out users are normal UI state, not a query error.
    if (error instanceof ApiError && error.statusCode === 401) {
      clearAuthSessionHint();

      return null;
    }

    throw error;
  }
};

export const login = (input: LoginFormValues) =>
  apiPost<AuthResponse, LoginFormValues>("/api/auth/login", input);

export const logout = () => apiPost<null>("/api/auth/logout");

export const signup = (input: SignupRequestValues) =>
  apiPost<AuthResponse, SignupRequestValues>("/api/auth/signup", input);

export const useMe = ({ enabled = true }: { enabled?: boolean } = {}) => {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: authQueryKeys.me,
    queryFn: ({ signal }) => getMe(signal),
    enabled
  });

  useEffect(() => {
    if (query.isSuccess) {
      void reconcileAuthenticatedQueryState(queryClient, query.data);
    }
  }, [query.isSuccess, query.data, queryClient]);

  return query;
};

export const useLogin = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: login,
    onSuccess: async (response) => {
      rememberAuthSessionHint();
      await replaceAuthenticatedQueryState(queryClient, response.user);
    }
  });
};

export const useLogout = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: logout,
    onSuccess: async () => {
      clearAuthSessionHint();
      await replaceAuthenticatedQueryState(queryClient, null);
    }
  });
};

export const useSignup = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: signup,
    onSuccess: async (response) => {
      rememberAuthSessionHint();
      await replaceAuthenticatedQueryState(queryClient, response.user);
    }
  });
};

export const replaceAuthenticatedQueryState = async (
  queryClient: QueryClient,
  user: AuthUser | null
) => {
  await queryClient.cancelQueries();
  queryClient.removeQueries({
    predicate: ({ queryKey }) => !isAuthStateQuery(queryKey)
  });
  queryClient.getMutationCache().clear();
  queryClient.setQueryData(authQueryKeys.cacheOwner, {
    userId: user?.id ?? null
  });
  queryClient.setQueryData(authQueryKeys.me, user);
};

const isAuthStateQuery = (queryKey: readonly unknown[]) =>
  queryKey.length === 2 &&
  queryKey[0] === "auth" &&
  (queryKey[1] === "me" || queryKey[1] === "cache-owner");

const reconcileAuthenticatedQueryState = async (
  queryClient: QueryClient,
  user: AuthUser | null
) => {
  const cacheOwner = queryClient.getQueryData<{ userId: string | null }>(
    authQueryKeys.cacheOwner
  );
  const userId = user?.id ?? null;

  if (!cacheOwner) {
    queryClient.setQueryData(authQueryKeys.cacheOwner, { userId });
    return;
  }

  if (cacheOwner.userId !== userId) {
    await replaceAuthenticatedQueryState(queryClient, user);
  }
};
