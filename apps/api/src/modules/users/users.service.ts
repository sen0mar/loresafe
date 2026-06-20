import { HttpError } from "../../core/errors/http-error.js";
import { normalizeNameReservationKey } from "../../core/identity/user-names.js";
import { type AuthUserDto, toAuthUserDto } from "../auth/auth.dto.js";
import {
  type JoinedClubsResponse,
  toJoinedClubDto
} from "./users.dto.js";
import type {
  ListCurrentUserClubsQuery,
  UpdateCurrentUserProfileRequest
} from "./users.schema.js";
import {
  isUniqueConstraintError,
  usersRepository,
  type UsersRepository
} from "./users.repository.js";

export type UsersService = {
  listCurrentUserClubs: (
    userId: string,
    query: ListCurrentUserClubsQuery
  ) => Promise<JoinedClubsResponse>;
  updateCurrentUserProfile: (
    userId: string,
    input: UpdateCurrentUserProfileRequest
  ) => Promise<AuthUserDto>;
};

export const createUsersService = (
  repository: UsersRepository = usersRepository
): UsersService => ({
  listCurrentUserClubs: async (userId, query) => {
    const result = await repository.listJoinedClubsForUser(userId, query);

    return {
      clubs: result.clubs.map(toJoinedClubDto),
      pagination: {
        page: query.page,
        limit: query.limit,
        total: result.total,
        pageCount: Math.ceil(result.total / query.limit)
      }
    };
  },

  updateCurrentUserProfile: async (userId, input) => {
    if (input.displayName !== undefined) {
      const existingUser = await repository.findActiveUserByReservedName(
        normalizeNameReservationKey(input.displayName)
      );

      if (existingUser && existingUser.id !== userId) {
        throw duplicateDisplayNameError();
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
        throw duplicateProfileFieldError(error);
      }

      throw error;
    }
  }
});

export const usersService = createUsersService();

const duplicateDisplayNameError = () =>
  new HttpError(409, "CONFLICT", "That display name is already taken.");

const duplicateProfileFieldError = (_error: unknown) => duplicateDisplayNameError();
