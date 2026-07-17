import { prisma } from "../../core/prisma/client.js";
import { normalizeNameReservationKey } from "../../core/identity/user-names.js";
import {
  activeUserSelect,
  findActiveUserByReservedName
} from "../../core/identity/active-user.js";

export type AuthUserRecord = {
  id: string;
  email: string;
  displayName: string;
  username: string | null;
  bio: string | null;
  avatarAsset?:
    | {
        objectKey: string;
        status: "PENDING" | "READY" | "FAILED";
      }
    | null
    | undefined;
  sessionVersion: number;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateAuthUserInput = {
  email: string;
  displayName: string;
  username?: string;
  passwordHash: string;
};

export type AuthUserCredentialsRecord = AuthUserRecord & {
  passwordHash: string;
};

export type AuthUsersRepository = {
  findActiveUserByEmail: (email: string) => Promise<AuthUserRecord | null>;
  findActiveUserByReservedName?: (
    normalizedName: string
  ) => Promise<AuthUserRecord | null>;
  findActiveUserById: (id: string) => Promise<AuthUserRecord | null>;
  findActiveUserCredentialsByEmail: (
    email: string
  ) => Promise<AuthUserCredentialsRecord | null>;
  createUser: (input: CreateAuthUserInput) => Promise<AuthUserRecord>;
};

const userCredentialsSelect = {
  ...activeUserSelect,
  // Login verification is the only read path that may load the password hash.
  passwordHash: true
} as const;

export const authUsersRepository: AuthUsersRepository = {
  findActiveUserByEmail: (email) =>
    prisma.user.findFirst({
      where: {
        email,
        // Soft-deleted users do not reserve their email for future active accounts.
        deletedAt: null
      },
      select: activeUserSelect
    }),

  findActiveUserByReservedName,

  findActiveUserById: (id) =>
    prisma.user.findFirst({
      where: {
        id,
        deletedAt: null
      },
      select: activeUserSelect
    }),

  findActiveUserCredentialsByEmail: (email) =>
    prisma.user.findFirst({
      where: {
        email,
        deletedAt: null
      },
      select: userCredentialsSelect
    }),

  // The repository accepts the hash for writes but never selects it back into auth DTOs.
  createUser: ({ email, displayName, username, passwordHash }) =>
    prisma.$transaction(async (transaction) => {
      const lockedUsername = username ?? toFallbackUsername(displayName);
      const user = await transaction.user.create({
        data: {
          email,
          displayName,
          username: lockedUsername,
          passwordHash
        },
        select: activeUserSelect
      });

      const reservationKeys = new Set([
        normalizeNameReservationKey(lockedUsername),
        normalizeNameReservationKey(displayName)
      ]);

      for (const normalizedName of reservationKeys) {
        await transaction.userNameReservation.create({
          data: {
            normalizedName,
            userId: user.id
          }
        });
      }

      return user;
    })
};

export const isUniqueConstraintError = (error: unknown) =>
  !!error &&
  typeof error === "object" &&
  "code" in error &&
  (error as { code: unknown }).code === "P2002";

const toFallbackUsername = (displayName: string) => {
  const username = displayName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return username.length >= 3 ? username.slice(0, 30) : "user";
};
