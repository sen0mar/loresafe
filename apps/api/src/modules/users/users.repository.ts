import { prisma } from "../../core/prisma/client.js";
import type { AuthUserRecord } from "../auth/auth.repository.js";

export type UpdateCurrentUserProfileInput = {
  displayName?: string;
  username?: string;
  bio?: string | null;
};

export type UsersRepository = {
  findActiveUserByUsername: (username: string) => Promise<AuthUserRecord | null>;
  updateActiveUserProfile: (
    userId: string,
    input: UpdateCurrentUserProfileInput
  ) => Promise<AuthUserRecord | null>;
};

const userSelect = {
  id: true,
  email: true,
  displayName: true,
  username: true,
  bio: true,
  sessionVersion: true,
  createdAt: true,
  updatedAt: true
} as const;

export const usersRepository: UsersRepository = {
  findActiveUserByUsername: (username) =>
    prisma.user.findFirst({
      where: {
        username,
        deletedAt: null
      },
      select: userSelect
    }),

  updateActiveUserProfile: async (userId, input) => {
    const updateResult = await prisma.user.updateMany({
      where: {
        id: userId,
        deletedAt: null
      },
      data: input
    });

    if (updateResult.count === 0) {
      return null;
    }

    return prisma.user.findFirst({
      where: {
        id: userId,
        deletedAt: null
      },
      select: userSelect
    });
  }
};

export const isUniqueConstraintError = (error: unknown) =>
  !!error &&
  typeof error === "object" &&
  "code" in error &&
  (error as { code: unknown }).code === "P2002";
