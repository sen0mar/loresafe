import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  authQueryKeys,
  type AuthResponse
} from "@/features/auth/api/auth";
import { clearAuthSessionHint } from "@/features/auth/api/auth-session-hint";
import { apiDelete, apiPatch } from "@/shared/api/api-client";

import type { ProfileFormValues } from "../schemas/profile.schema.js";

export type DeleteCurrentUserAccountInput = {
  confirmation: "delete";
};

export const updateCurrentUserProfile = (input: ProfileFormValues) =>
  apiPatch<AuthResponse, ProfileFormValues>("/api/users/me", input);

export const deleteCurrentUserAccount = (
  input: DeleteCurrentUserAccountInput
) => apiDelete<null, DeleteCurrentUserAccountInput>("/api/users/me", input);

export const useUpdateCurrentUserProfile = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateCurrentUserProfile,
    onSuccess: (response) => {
      queryClient.setQueryData(authQueryKeys.me, response.user);
    }
  });
};

export const useDeleteCurrentUserAccount = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteCurrentUserAccount,
    onSuccess: () => {
      clearAuthSessionHint();
      queryClient.clear();
      queryClient.setQueryData(authQueryKeys.me, null);
    }
  });
};
