import { HttpError } from "../../core/errors/http-error.js";
import { type AuthUserDto, toAuthUserDto } from "../auth/auth.dto.js";
import type { UpdateCurrentUserProfileRequest } from "./users.schema.js";
import {
  isUniqueConstraintError,
  usersRepository,
  type UsersRepository
} from "./users.repository.js";

export type UsersService = {
  updateCurrentUserProfile: (
    userId: string,
    input: UpdateCurrentUserProfileRequest
  ) => Promise<AuthUserDto>;
};

export const createUsersService = (
  repository: UsersRepository = usersRepository
): UsersService => ({
  updateCurrentUserProfile: async (userId, input) => {
    if (input.username !== undefined) {
      const existingUser = await repository.findActiveUserByUsername(input.username);

      if (existingUser && existingUser.id !== userId) {
        throw duplicateUsernameError();
      }
    }

    try {
      const updatedUser = await repository.updateActiveUserProfile(userId, input);

      if (!updatedUser) {
        throw new HttpError(401, "UNAUTHORIZED", "Authentication required");
      }

      return toAuthUserDto(updatedUser);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw duplicateUsernameError();
      }

      throw error;
    }
  }
});

export const usersService = createUsersService();

const duplicateUsernameError = () =>
  new HttpError(409, "CONFLICT", "That username is already taken.");
