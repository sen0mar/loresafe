import type { Prisma } from "../../generated/prisma/client.js";

type ClubLockMode = "SHARE" | "UPDATE";

const lockClubRowByLinkName = async (
  transaction: Prisma.TransactionClient,
  linkName: string,
  mode: ClubLockMode
) => {
  const rows =
    mode === "SHARE"
      ? await transaction.$queryRaw<Array<{ id: string }>>`
          SELECT "id"
          FROM "clubs"
          WHERE "link_name" = ${linkName}
          FOR SHARE
        `
      : await transaction.$queryRaw<Array<{ id: string }>>`
          SELECT "id"
          FROM "clubs"
          WHERE "link_name" = ${linkName}
          FOR UPDATE
        `;

  return rows[0]?.id ?? null;
};

const lockClubRow = async (
  transaction: Prisma.TransactionClient,
  clubId: string,
  mode: ClubLockMode
) => {
  const rows =
    mode === "SHARE"
      ? await transaction.$queryRaw<Array<{ id: string }>>`
          SELECT "id"
          FROM "clubs"
          WHERE "id" = ${clubId}::uuid
          FOR SHARE
        `
      : await transaction.$queryRaw<Array<{ id: string }>>`
          SELECT "id"
          FROM "clubs"
          WHERE "id" = ${clubId}::uuid
          FOR UPDATE
        `;

  return rows.length === 1;
};

export const lockClubAuthorization = (
  transaction: Prisma.TransactionClient,
  clubId: string
) => lockClubRow(transaction, clubId, "SHARE");

export const lockClubAuthorizationChanges = (
  transaction: Prisma.TransactionClient,
  clubId: string
) => lockClubRow(transaction, clubId, "UPDATE");

export const lockClubAuthorizationByLinkName = (
  transaction: Prisma.TransactionClient,
  linkName: string
) => lockClubRowByLinkName(transaction, linkName, "SHARE");

export const lockClubAuthorizationChangesByLinkName = (
  transaction: Prisma.TransactionClient,
  linkName: string
) => lockClubRowByLinkName(transaction, linkName, "UPDATE");
