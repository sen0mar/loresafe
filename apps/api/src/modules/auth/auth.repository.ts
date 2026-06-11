import { prisma } from "../../core/prisma/client.js";

export type AuthUserRecord = {
  id: string;
  email: string;
  displayName: string;
  sessionVersion: number;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateAuthUserInput = {
  email: string;
  displayName: string;
  passwordHash: string;
};

export type AuthUsersRepository = {
  findActiveUserByEmail: (email: string) => Promise<AuthUserRecord | null>;
  createUser: (input: CreateAuthUserInput) => Promise<AuthUserRecord>;
};

const userSelect = {
  id: true,
  email: true,
  displayName: true,
  sessionVersion: true,
  createdAt: true,
  updatedAt: true
} as const;

export const authUsersRepository: AuthUsersRepository = {
  findActiveUserByEmail: (email) =>
    prisma.user.findFirst({
      where: {
        email,
        // Soft-deleted users do not reserve their email for future active accounts.
        deletedAt: null
      },
      select: userSelect
    }),

  // The repository accepts the hash for writes but never selects it back into auth DTOs.
  createUser: ({ email, displayName, passwordHash }) =>
    prisma.user.create({
      data: {
        email,
        displayName,
        passwordHash
      },
      select: userSelect
    })
};

export const isUniqueConstraintError = (error: unknown) =>
  !!error &&
  typeof error === "object" &&
  "code" in error &&
  (error as { code: unknown }).code === "P2002";
