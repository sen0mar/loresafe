import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ApiError, apiGet, apiPost } from "@/shared/api/api-client";

import type { LoginFormValues } from "../schemas/login.schema.js";
import type { SignupFormValues } from "../schemas/signup.schema.js";

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  username: string | null;
  bio: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AuthResponse = {
  user: AuthUser;
};

export const authQueryKeys = {
  me: ["auth", "me"] as const
};

export const getMe = async () => {
  try {
    const response = await apiGet<AuthResponse>("/api/auth/me");

    return response.user;
  } catch (error) {
    // Signed-out users are normal UI state, not a query error.
    if (error instanceof ApiError && error.statusCode === 401) {
      return null;
    }

    throw error;
  }
};

export const login = (input: LoginFormValues) =>
  apiPost<AuthResponse, LoginFormValues>("/api/auth/login", input);

export const logout = () => apiPost<null>("/api/auth/logout");

export const signup = (input: SignupFormValues) =>
  apiPost<AuthResponse, SignupFormValues>("/api/auth/signup", input);

export const useMe = () =>
  useQuery({
    queryKey: authQueryKeys.me,
    queryFn: getMe
  });

export const useLogin = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: login,
    onSuccess: (response) => {
      queryClient.setQueryData(authQueryKeys.me, response.user);
    }
  });
};

export const useLogout = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.setQueryData(authQueryKeys.me, null);
    }
  });
};

export const useSignup = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: signup,
    onSuccess: (response) => {
      queryClient.setQueryData(authQueryKeys.me, response.user);
    }
  });
};
