import { HttpError } from "../../core/errors/http-error.js";
import { hashPassword, verifyPassword } from "../../core/security/password.js";
import {
  createSessionToken,
  verifySessionToken
} from "../../core/security/session-token.js";
import { type AuthUserDto, toAuthUserDto } from "./auth.dto.js";
import type { LoginRequest, SignupRequest } from "./auth.schema.js";
import {
  authUsersRepository,
  type AuthUsersRepository,
  isUniqueConstraintError
} from "./auth.repository.js";

export type SignupResult = {
  user: AuthUserDto;
  sessionToken: string;
};

export type LoginResult = SignupResult;

export type AuthService = {
  signup: (input: SignupRequest) => Promise<SignupResult>;
  login: (input: LoginRequest) => Promise<LoginResult>;
  resolveCurrentUser: (
    sessionToken: string | undefined
  ) => Promise<AuthUserDto | null>;
  getCurrentUser: (sessionToken: string | undefined) => Promise<AuthUserDto>;
};

export const createAuthService = (
  usersRepository: AuthUsersRepository = authUsersRepository
): AuthService => {
  const resolveCurrentUser = async (sessionToken: string | undefined) => {
    if (!sessionToken) {
      return null;
    }

    const verifiedSession = await verifySessionToken(sessionToken);

    if (!verifiedSession) {
      return null;
    }

    const user = await usersRepository.findActiveUserById(
      verifiedSession.userId
    );

    // The version check lets password/session invalidation revoke otherwise valid JWTs.
    if (!user || user.sessionVersion !== verifiedSession.sessionVersion) {
      return null;
    }

    return toAuthUserDto(user);
  };

  return {
    signup: async ({ email, displayName, password }) => {
      const existingUser = await usersRepository.findActiveUserByEmail(email);

      if (existingUser) {
        throw duplicateEmailError();
      }

      const existingDisplayName = usersRepository.findActiveUserByDisplayName
        ? await usersRepository.findActiveUserByDisplayName(displayName)
        : null;

      if (existingDisplayName) {
        throw duplicateDisplayNameError();
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
          throw duplicateSignupError(error);
        }

        throw error;
      }
    },

    login: async ({ email, password }) => {
      const user = await usersRepository.findActiveUserCredentialsByEmail(email);

      // Missing users and bad passwords share one response to avoid account enumeration.
      if (!user) {
        throw invalidCredentialsError();
      }

      const isPasswordValid = await verifyPassword(user.passwordHash, password);

      if (!isPasswordValid) {
        throw invalidCredentialsError();
      }

      const sessionToken = await createSessionToken({
        userId: user.id,
        sessionVersion: user.sessionVersion
      });

      return {
        user: toAuthUserDto(user),
        sessionToken
      };
    },

    resolveCurrentUser,

    getCurrentUser: async (sessionToken) => {
      const user = await resolveCurrentUser(sessionToken);

      if (!user) {
        throw authenticationRequiredError();
      }

      return user;
    }
  };
};

export const authService = createAuthService();

const invalidCredentialsError = () =>
  new HttpError(401, "UNAUTHORIZED", "Invalid credentials");

const authenticationRequiredError = () =>
  new HttpError(401, "UNAUTHORIZED", "Authentication required");

const duplicateEmailError = () =>
  new HttpError(409, "CONFLICT", "An account with that email already exists.");

const duplicateDisplayNameError = () =>
  new HttpError(409, "CONFLICT", "That display name is already taken.");

const duplicateSignupError = (error: unknown) => {
  if (uniqueConstraintTargets(error).includes("display_name")) {
    return duplicateDisplayNameError();
  }

  return duplicateEmailError();
};

const uniqueConstraintTargets = (error: unknown) => {
  if (!error || typeof error !== "object" || !("meta" in error)) {
    return [];
  }

  const meta = (error as { meta?: { target?: unknown } }).meta;

  return Array.isArray(meta?.target)
    ? meta.target.filter((target): target is string => typeof target === "string")
    : [];
};
