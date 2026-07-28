import type { Prisma } from "../../generated/prisma/client.js";

export const lockUserClubProgress = async (
  transaction: Prisma.TransactionClient,
  userId: string,
  clubId: string
) => {
  await transaction.$executeRaw`
    SELECT pg_advisory_xact_lock(
      hashtextextended(${`${userId}:${clubId}`}, 0)
    )
  `;

  await transaction.$queryRaw`
    SELECT "id"
    FROM "club_progress"
    WHERE "user_id" = ${userId}::uuid
      AND "club_id" = ${clubId}::uuid
    FOR UPDATE
  `;
};
