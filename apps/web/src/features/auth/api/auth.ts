import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

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
  me: ["auth", "me"] as const
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

export const useMe = ({ enabled = true }: { enabled?: boolean } = {}) =>
  useQuery({
    queryKey: authQueryKeys.me,
    queryFn: ({ signal }) => getMe(signal),
    enabled
  });

export const useLogin = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: login,
    onSuccess: (response) => {
      rememberAuthSessionHint();
      queryClient.setQueryData(authQueryKeys.me, response.user);
    }
  });
};

export const useLogout = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: logout,
    onSuccess: () => {
      clearAuthSessionHint();
      queryClient.setQueryData(authQueryKeys.me, null);
    }
  });
};

export const useSignup = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: signup,
    onSuccess: (response) => {
      rememberAuthSessionHint();
      queryClient.setQueryData(authQueryKeys.me, response.user);
    }
  });
};
