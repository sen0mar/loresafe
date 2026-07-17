import { prisma } from "../prisma/client.js";

export const activeUserSelect = {
  id: true,
  email: true,
  displayName: true,
  username: true,
  bio: true,
  avatarAsset: {
    select: {
      objectKey: true,
      status: true
    }
  },
  sessionVersion: true,
  createdAt: true,
  updatedAt: true
} as const;

export const findActiveUserByReservedName = async (normalizedName: string) => {
  const reservation = await prisma.userNameReservation.findFirst({
    where: {
      normalizedName,
      user: {
        deletedAt: null
      }
    },
    select: {
      user: {
        select: activeUserSelect
      }
    }
  });

  return reservation?.user ?? null;
};
