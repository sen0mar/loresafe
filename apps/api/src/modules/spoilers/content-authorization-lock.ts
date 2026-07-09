import type { Prisma } from "../../generated/prisma/client.js";

type ContentLockMode = "SHARE" | "UPDATE";

const lockContentRow = async (
  transaction: Prisma.TransactionClient,
  table: "posts" | "comments",
  id: string,
  mode: ContentLockMode
) => {
  const rows =
    table === "posts"
      ? mode === "SHARE"
        ? await transaction.$queryRaw<Array<{ id: string }>>`
            SELECT "id" FROM "posts" WHERE "id" = ${id}::uuid FOR SHARE
          `
        : await transaction.$queryRaw<Array<{ id: string }>>`
            SELECT "id" FROM "posts" WHERE "id" = ${id}::uuid FOR UPDATE
          `
      : mode === "SHARE"
        ? await transaction.$queryRaw<Array<{ id: string }>>`
            SELECT "id" FROM "comments" WHERE "id" = ${id}::uuid FOR SHARE
          `
        : await transaction.$queryRaw<Array<{ id: string }>>`
            SELECT "id" FROM "comments" WHERE "id" = ${id}::uuid FOR UPDATE
          `;

  return rows.length === 1;
};

export const lockPostForReadAuthorization = (
  transaction: Prisma.TransactionClient,
  postId: string
) => lockContentRow(transaction, "posts", postId, "SHARE");

export const lockPostForWriteAuthorization = (
  transaction: Prisma.TransactionClient,
  postId: string
) => lockContentRow(transaction, "posts", postId, "UPDATE");

export const lockCommentForReadAuthorization = (
  transaction: Prisma.TransactionClient,
  commentId: string
) => lockContentRow(transaction, "comments", commentId, "SHARE");

export const lockCommentForWriteAuthorization = (
  transaction: Prisma.TransactionClient,
  commentId: string
) => lockContentRow(transaction, "comments", commentId, "UPDATE");
