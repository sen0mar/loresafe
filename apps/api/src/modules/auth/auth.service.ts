import { HttpError } from "../../core/errors/http-error.js";
import { hashPassword } from "../../core/security/password.js";
import { createSessionToken } from "../../core/security/session-token.js";
import type { SignupRequest } from "./auth.schema.js";
import {
  authUsersRepository,
  type AuthUserRecord,
  type AuthUsersRepository,
  isUniqueConstraintError
} from "./auth.repository.js";

export type AuthUserDto = {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
};

export type SignupResult = {
  user: AuthUserDto;
  sessionToken: string;
};

export type AuthService = {
  signup: (input: SignupRequest) => Promise<SignupResult>;
};

export const createAuthService = (
  usersRepository: AuthUsersRepository = authUsersRepository
): AuthService => ({
  signup: async ({ email, displayName, password }) => {
    const existingUser = await usersRepository.findActiveUserByEmail(email);

    if (existingUser) {
      throw new HttpError(
        409,
        "CONFLICT",
        "An account with that email already exists."
      );
    }

    // Plaintext passwords should not cross into repositories or Prisma calls.
    const passwordHash = await hashPassword(password);

    try {
      const user = await usersRepository.createUser({
        email,
        displayName,
        passwordHash
      });
      const sessionToken = await createSessionToken({
        userId: user.id,
        sessionVersion: user.sessionVersion
      });

      return {
        user: toAuthUserDto(user),
        sessionToken
      };
    } catch (error) {
      // The database constraint closes the race where two signups pass the pre-check together.
      if (isUniqueConstraintError(error)) {
        throw new HttpError(
          409,
          "CONFLICT",
          "An account with that email already exists."
        );
      }

      throw error;
    }
  }
});

export const authService = createAuthService();

// Return only public account fields; password hashes and session internals stay server-side.
const toAuthUserDto = (user: AuthUserRecord): AuthUserDto => ({
  id: user.id,
  email: user.email,
  displayName: user.displayName,
  createdAt: user.createdAt.toISOString(),
  updatedAt: user.updatedAt.toISOString()
});
