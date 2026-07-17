import { describe, expect, it, vi } from "vitest";

import { assertEmptyShowcaseTarget } from "../prisma/showcase/showcase.writer.js";

const createTransaction = (counts: {
  clubs: number;
  storageDeletions: number;
  users: number;
}) =>
  ({
    user: { count: vi.fn().mockResolvedValue(counts.users) },
    club: { count: vi.fn().mockResolvedValue(counts.clubs) },
    storageObjectDeletion: {
      count: vi.fn().mockResolvedValue(counts.storageDeletions)
    }
  }) as never;

describe("showcase writer target guard", () => {
  it("accepts an empty application database", async () => {
    await expect(
      assertEmptyShowcaseTarget(
        createTransaction({ users: 0, clubs: 0, storageDeletions: 0 })
      )
    ).resolves.toBeUndefined();
  });

  it("rejects any existing application roots", async () => {
    await expect(
      assertEmptyShowcaseTarget(
        createTransaction({ users: 1, clubs: 0, storageDeletions: 0 })
      )
    ).rejects.toThrow("requires an empty application database");
  });
});
