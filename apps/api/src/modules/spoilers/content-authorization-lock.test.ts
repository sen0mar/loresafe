import { describe, expect, it, vi } from "vitest";

import type { Prisma } from "../../generated/prisma/client.js";
import {
  lockCommentForWriteAuthorization,
  lockPostForReadAuthorization,
  lockPostForWriteAuthorization
} from "./content-authorization-lock.js";

describe("content authorization locks", () => {
  it("locks posts for writes before reaction or deletion authorization", async () => {
    const { queryRaw, transaction } = createTransaction();

    await lockPostForWriteAuthorization(transaction, crypto.randomUUID());

    expect(readQuery(queryRaw)).toContain('FROM "posts"');
    expect(readQuery(queryRaw)).toContain("FOR UPDATE");
  });

  it("allows shared post locks while serializing comment writes", async () => {
    const postTransaction = createTransaction();
    const commentTransaction = createTransaction();

    await lockPostForReadAuthorization(
      postTransaction.transaction,
      crypto.randomUUID()
    );
    await lockCommentForWriteAuthorization(
      commentTransaction.transaction,
      crypto.randomUUID()
    );

    expect(readQuery(postTransaction.queryRaw)).toContain("FOR SHARE");
    expect(readQuery(commentTransaction.queryRaw)).toContain('FROM "comments"');
    expect(readQuery(commentTransaction.queryRaw)).toContain("FOR UPDATE");
  });
});

const createTransaction = () => {
  const queryRaw = vi.fn(async (..._args: unknown[]) => [
    { id: crypto.randomUUID() }
  ]);

  return {
    queryRaw,
    transaction: {
      $queryRaw: queryRaw
    } as unknown as Prisma.TransactionClient
  };
};

const readQuery = (queryRaw: ReturnType<typeof vi.fn>) =>
  (queryRaw.mock.calls[0]?.[0] as TemplateStringsArray).join(" ");
