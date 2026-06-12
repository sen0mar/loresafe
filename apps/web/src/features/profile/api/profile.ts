import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  authQueryKeys,
  type AuthResponse
} from "@/features/auth/api/auth";
import { apiPatch } from "@/shared/api/api-client";

import type { ProfileFormValues } from "../schemas/profile.schema.js";

export const updateCurrentUserProfile = (input: ProfileFormValues) =>
  apiPatch<AuthResponse, ProfileFormValues>("/api/users/me", input);

export const useUpdateCurrentUserProfile = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateCurrentUserProfile,
    onSuccess: (response) => {
      queryClient.setQueryData(authQueryKeys.me, response.user);
    }
  });
};
