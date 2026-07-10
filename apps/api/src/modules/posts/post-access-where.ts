import type { Prisma } from "../../generated/prisma/client.js";
import { activeUserBanWhere } from "../clubs/club-bans.js";

export const visiblePostAccessWhere = (
  userId: string,
  now = new Date()
): Prisma.PostWhereInput => ({
  status: "VISIBLE",
  deletedAt: null,
  club: {
    bans: {
      none: activeUserBanWhere(userId, now)
    },
    OR: [
      {
        visibility: "PUBLIC"
      },
      {
        memberships: {
          some: {
            userId
          }
        }
      }
    ]
  }
});
