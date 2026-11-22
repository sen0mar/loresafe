import { HttpError } from "../../core/errors/http-error.js";
import {
  dummyPasswordHash,
  hashPassword,
  verifyPassword
} from "../../core/security/password.js";
import {
  createRefreshToken,
  createSessionIdentifier,
  createSessionToken,
  hashSessionIdentifier,
  verifySessionToken
} from "../../core/security/session-token.js";
import { env } from "../../config/env.js";
import { normalizeNameReservationKey } from "../../core/identity/user-names.js";
import { type AuthUserDto, toAuthUserDto } from "./auth.dto.js";
import type {
  ForgotPasswordRequest,
  LoginRequest,
  ResendVerificationRequest,
  ResetPasswordRequest,
  SignupRequest,
  VerifyEmailRequest
} from "./auth.schema.js";
import {
  authUsersRepository,
  type AuthUserRecord,
  type AuthUsersRepository
} from "./auth.repository.js";
import {
  authSessionsRepository,
  createMemoryAuthSessionsRepository,
  type AuthSessionsRepository
} from "./auth-session.repository.js";
import {
  createMemoryEmailIdentityRepository,
  emailIdentityRepository,
  type EmailIdentityRepository
} from "./email-identity.repository.js";
import {
  createEmailIdentityToken,
  hashEmailIdentityToken
} from "./email-identity-token.js";
import { emailDelivery, type EmailDelivery } from "./email-delivery.js";
import {
  createMemoryPendingSignupRepository,
  pendingSignupRepository as defaultPendingSignupRepository,
  type PendingSignupRepository
} from "./pending-signup.repository.js";

export type SignupResult = {
  accepted: true;
};

export type LoginResult = {
  user: AuthUserDto;
  sessionToken: string;
  refreshToken: string;
};

export type AuthService = {
  signup: (input: SignupRequest) => Promise<SignupResult>;
  login: (input: LoginRequest) => Promise<LoginResult>;
  resolveCurrentUser: (
    sessionToken: string | undefined
  ) => Promise<AuthUserDto | null>;
  getCurrentUser: (sessionToken: string | undefined) => Promise<AuthUserDto>;
  refresh: (refreshToken: string | undefined) => Promise<LoginResult>;
  revokeSession: (input: {
    sessionToken?: string;
    refreshToken?: string;
  }) => Promise<string | null>;
  revokeAllSessions: (userId: string) => Promise<number>;
  resendVerification: (input: ResendVerificationRequest) => Promise<void>;
  verifyEmail: (input: VerifyEmailRequest) => Promise<void>;
  forgotPassword: (input: ForgotPasswordRequest) => Promise<void>;
  resetPassword: (input: ResetPasswordRequest) => Promise<string | null>;
};

type PasswordVerifier = typeof verifyPassword;
const verificationTtlMs = 24 * 60 * 60 * 1000;
const passwordResetTtlMs = 60 * 60 * 1000;
export const refreshReuseGraceMs = 5_000;
export const refreshTombstoneTtlMs = 24 * 60 * 60 * 1000;

export class RefreshTokenReuseError extends HttpError {
  readonly userId: string;

  constructor(userId: string) {
    super(401, "UNAUTHORIZED", "Authentication required");
    this.name = "RefreshTokenReuseError";
    this.userId = userId;
  }
}

export const createAuthService = (
  usersRepository: AuthUsersRepository = authUsersRepository,
  sessionsRepository: AuthSessionsRepository = usersRepository ===
  authUsersRepository
    ? authSessionsRepository
    : createMemoryAuthSessionsRepository(),
  passwordVerifier: PasswordVerifier = verifyPassword,
  identityRepository: EmailIdentityRepository = usersRepository ===
  authUsersRepository
    ? emailIdentityRepository
    : createMemoryEmailIdentityRepository(),
  delivery: EmailDelivery = emailDelivery,
  pendingSignupRepository: PendingSignupRepository = usersRepository ===
  authUsersRepository
    ? defaultPendingSignupRepository
    : createMemoryPendingSignupRepository(usersRepository)
): AuthService => {
  const allowLegacyUnpersistedTestTokens =
    env.NODE_ENV === "test" && usersRepository !== authUsersRepository;
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
    const session = await sessionsRepository.findActiveBySessionIdHash(
      hashSessionIdentifier(verifiedSession.sessionId),
      new Date()
    );

    const isKnownPersistedSession =
      !session && allowLegacyUnpersistedTestTokens
        ? await sessionsRepository.hasSessionIdHash(
            hashSessionIdentifier(verifiedSession.sessionId)
          )
        : session !== null;

    if (
      !user ||
      (!session &&
        (!allowLegacyUnpersistedTestTokens || isKnownPersistedSession)) ||
      (session !== null && session.userId !== user.id) ||
      user.sessionVersion !== verifiedSession.sessionVersion
    ) {
      return null;
    }

    return toAuthUserDto(user);
  };

  return {
    signup: async ({ email, username, password }) => {
      // Account existence never skips the signup Argon2id cost.
      const passwordHash = await hashPassword(password);
      const existingReservedName =
        await usersRepository.findActiveUserByReservedName?.(
          normalizeNameReservationKey(username)
        );

      if (existingReservedName) {
        throw duplicateUsernameError();
      }

      // No account exists until the link is confirmed, so an unverified signup
      // never takes the username. Existing emails follow the same path to keep
      // the response, timing, and email side effects account neutral; their
      // confirmation creates nothing.
      const token = createEmailIdentityToken();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + verificationTtlMs);

      await pendingSignupRepository.savePendingSignup({
        email,
        username,
        passwordHash,
        tokenHash: hashEmailIdentityToken(token),
        expiresAt,
        now
      });
      sendWithoutWaiting(
        delivery.sendEmailVerification({ email, token, expiresAt })
      );

      return { accepted: true };
    },

    login: async ({ email, password }) => {
      const user =
        await usersRepository.findActiveUserCredentialsByEmail(email);

      const isPasswordValid = await passwordVerifier(
        user?.passwordHash ?? dummyPasswordHash,
        password
      );

      // Keep both the work performed and the client response independent of
      // whether an active account exists for this email address.
      if (!user || user.emailVerifiedAt === null || !isPasswordValid) {
        throw invalidCredentialsError();
      }

      const tokens = await createPersistedSession(user, sessionsRepository);

      return {
        user: toAuthUserDto(user),
        ...tokens
      };
    },

    refresh: async (refreshToken) => {
      if (!refreshToken) {
        throw authenticationRequiredError();
      }

      const currentRefreshTokenHash = hashSessionIdentifier(refreshToken);
      const nextRefreshToken = createRefreshToken();
      const nextSessionId = createSessionIdentifier();
      const now = new Date();
      const rotation = await sessionsRepository.rotateOrDetectRefreshReuse({
        currentRefreshTokenHash,
        nextSessionIdHash: hashSessionIdentifier(nextSessionId),
        nextRefreshTokenHash: hashSessionIdentifier(nextRefreshToken),
        now,
        graceUntil: new Date(now.getTime() + refreshReuseGraceMs),
        tombstoneExpiresAt: new Date(now.getTime() + refreshTombstoneTtlMs)
      });

      if (rotation.status === "COMPROMISED") {
        throw new RefreshTokenReuseError(rotation.userId);
      }

      if (rotation.status !== "ROTATED") {
        throw authenticationRequiredError();
      }

      const user = await usersRepository.findActiveUserById(
        rotation.session.userId
      );

      if (!user || rotation.session.sessionVersion !== user.sessionVersion) {
        await sessionsRepository.revokeSession(
          {
            sessionIdHash: rotation.session.sessionIdHash
          },
          new Date()
        );
        throw authenticationRequiredError();
      }

      return {
        user: toAuthUserDto(user),
        sessionToken: await createSessionToken({
          userId: user.id,
          sessionVersion: user.sessionVersion,
          sessionId: nextSessionId
        }),
        refreshToken: nextRefreshToken
      };
    },

    resolveCurrentUser,

    getCurrentUser: async (sessionToken) => {
      const user = await resolveCurrentUser(sessionToken);

      if (!user) {
        throw authenticationRequiredError();
      }

      return user;
    },

    revokeSession: async ({ sessionToken, refreshToken }) => {
      const verifiedSession = sessionToken
        ? await verifySessionToken(sessionToken)
        : null;
      const identifiers = {
        ...(verifiedSession
          ? {
              sessionIdHash: hashSessionIdentifier(verifiedSession.sessionId)
            }
          : {}),
        ...(refreshToken
          ? { refreshTokenHash: hashSessionIdentifier(refreshToken) }
          : {})
      };

      if (!identifiers.sessionIdHash && !identifiers.refreshTokenHash) {
        return null;
      }

      return sessionsRepository.revokeSession(identifiers, new Date());
    },

    revokeAllSessions: (userId) =>
      sessionsRepository.revokeAllSessions(userId, new Date()),

    resendVerification: async ({ email }) => {
      await performNeutralIdentityWork();
      const token = createEmailIdentityToken();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + verificationTtlMs);
      const rotated = await pendingSignupRepository.rotatePendingSignupToken({
        email,
        tokenHash: hashEmailIdentityToken(token),
        expiresAt,
        now
      });

      if (rotated) {
        sendWithoutWaiting(
          delivery.sendEmailVerification({ email, token, expiresAt })
        );
      }
    },

    verifyEmail: async ({ token }) => {
      const result = await pendingSignupRepository.completePendingSignup({
        tokenHash: hashEmailIdentityToken(token),
        now: new Date()
      });

      if (result.status === "INVALID") {
        throw invalidVerificationLinkError();
      }

      if (result.status === "USERNAME_TAKEN") {
        throw usernameTakenBeforeVerificationError();
      }
    },

    forgotPassword: async ({ email }) => {
      await performNeutralIdentityWork();
      const user = await usersRepository.findActiveUserByEmail(email);

      if (user && user.emailVerifiedAt !== null) {
        await issuePasswordResetToken({ user, identityRepository, delivery });
      }
    },

    resetPassword: async ({ token, password }) => {
      // Invalid, expired, consumed, and valid tokens all pay the Argon2id cost.
      const passwordHash = await hashPassword(password);
      const result = await identityRepository.consumePasswordResetToken({
        tokenHash: hashEmailIdentityToken(token),
        passwordHash,
        now: new Date()
      });

      if (result.status === "INVALID") {
        throw invalidIdentityTokenError();
      }

      return result.userId;
    }
  };
};

export const authService = createAuthService();

const createPersistedSession = async (
  user: Pick<AuthUserRecord, "id" | "sessionVersion">,
  sessionsRepository: AuthSessionsRepository
) => {
  const sessionId = createSessionIdentifier();
  const refreshToken = createRefreshToken();

  await sessionsRepository.createSession({
    userId: user.id,
    sessionIdHash: hashSessionIdentifier(sessionId),
    refreshTokenHash: hashSessionIdentifier(refreshToken),
    sessionVersion: user.sessionVersion,
    expiresAt: new Date(Date.now() + env.SESSION_TTL_SECONDS * 1000)
  });

  return {
    sessionToken: await createSessionToken({
      userId: user.id,
      sessionVersion: user.sessionVersion,
      sessionId
    }),
    refreshToken
  };
};

const invalidCredentialsError = () =>
  new HttpError(401, "UNAUTHORIZED", "Invalid credentials");

const authenticationRequiredError = () =>
  new HttpError(401, "UNAUTHORIZED", "Authentication required");

const duplicateUsernameError = () =>
  new HttpError(409, "CONFLICT", "That username is already taken.");

const invalidVerificationLinkError = () =>
  new HttpError(
    400,
    "BAD_REQUEST",
    "This link is invalid or has expired. If you already verified your email, log in; otherwise sign up again."
  );

const usernameTakenBeforeVerificationError = () =>
  new HttpError(
    409,
    "CONFLICT",
    "That username was taken before you verified your email. Sign up again with a different username."
  );

const invalidIdentityTokenError = () =>
  new HttpError(
    400,
    "BAD_REQUEST",
    "This link is invalid or has expired. Request a new one."
  );

const performNeutralIdentityWork = () =>
  hashPassword(createEmailIdentityToken()).then(() => undefined);

// Do not await delivery: a provider round trip that only known accounts pay
// would reveal account existence through response timing.
const sendWithoutWaiting = (delivered: Promise<void>) => {
  void delivered.catch(() => undefined);
};

const issuePasswordResetToken = async ({
  user,
  identityRepository,
  delivery
}: {
  user: Pick<AuthUserRecord, "id" | "email">;
  identityRepository: EmailIdentityRepository;
  delivery: EmailDelivery;
}) => {
  const token = createEmailIdentityToken();
  const expiresAt = new Date(Date.now() + passwordResetTtlMs);

  await identityRepository.issueToken({
    userId: user.id,
    purpose: "RESET_PASSWORD",
    tokenHash: hashEmailIdentityToken(token),
    expiresAt
  });
  sendWithoutWaiting(
    delivery.sendPasswordReset({ email: user.email, token, expiresAt })
  );
};
