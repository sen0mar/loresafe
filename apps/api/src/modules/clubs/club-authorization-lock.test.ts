import { describe, expect, it, vi } from "vitest";

import type { Prisma } from "../../generated/prisma/client.js";
import {
  lockClubAuthorization,
  lockClubAuthorizationChanges,
  lockClubAuthorizationChangesByLinkName
} from "./club-authorization-lock.js";

describe("club authorization locks", () => {
  it("uses a shared row lock for authorization-bound content commands", async () => {
    const clubId = crypto.randomUUID();
    const { queryRaw, transaction } = createTransaction(clubId);

    await expect(lockClubAuthorization(transaction, clubId)).resolves.toBe(
      true
    );
    expect(readQuery(queryRaw)).toContain("FOR SHARE");
    expect(queryRaw.mock.calls[0]?.[1]).toBe(clubId);
  });

  it("uses an exclusive stable club-row lock for authorization changes", async () => {
    const clubId = crypto.randomUUID();
    const { queryRaw, transaction } = createTransaction(clubId);

    await expect(
      lockClubAuthorizationChanges(transaction, clubId)
    ).resolves.toBe(true);
    expect(readQuery(queryRaw)).toContain("FOR UPDATE");
  });

  it("locks owner mutations by the unique club link name", async () => {
    const clubId = crypto.randomUUID();
    const { queryRaw, transaction } = createTransaction(clubId);

    await expect(
      lockClubAuthorizationChangesByLinkName(transaction, "story-circle")
    ).resolves.toBe(clubId);
    expect(readQuery(queryRaw)).toContain('WHERE "link_name" =');
    expect(readQuery(queryRaw)).toContain("FOR UPDATE");
  });
});

const createTransaction = (clubId: string) => {
  const queryRaw = vi.fn(async (..._args: unknown[]) => [{ id: clubId }]);

  return {
    queryRaw,
    transaction: {
      $queryRaw: queryRaw
    } as unknown as Prisma.TransactionClient
  };
};

const readQuery = (queryRaw: ReturnType<typeof vi.fn>) =>
  (queryRaw.mock.calls[0]?.[0] as TemplateStringsArray).join(" ");
