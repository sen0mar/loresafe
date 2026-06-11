import { useMutation } from "@tanstack/react-query";

import { apiPost } from "@/shared/api/api-client";

import type { SignupFormValues } from "../schemas/signup.schema.js";

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
};

export type SignupResponse = {
  user: AuthUser;
};

export const signup = (input: SignupFormValues) =>
  apiPost<SignupResponse, SignupFormValues>("/api/auth/signup", input);

// Signup changes server state and may set a cookie, so it belongs in a mutation.
export const useSignupMutation = () =>
  useMutation({
    mutationFn: signup
  });
