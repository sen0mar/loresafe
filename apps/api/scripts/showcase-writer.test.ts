import { describe, expect, it, vi } from "vitest";

import { hashInviteToken } from "../src/modules/invites/invites.token.js";
import {
  assertEmptyShowcaseTarget,
  createShowcaseInvite
} from "../prisma/showcase/showcase.writer.js";

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

describe("showcase invite writer", () => {
  it("stores only the configured invite token hash", async () => {
    const create = vi.fn().mockResolvedValue({ id: "invite-1" });
    const inviteToken = "fresh-showcase-invite-token";
    const seededAt = new Date("2026-07-19T12:00:00.000Z");

    await createShowcaseInvite({ clubInvite: { create } } as never, {
      clubId: "club-1",
      createdById: "user-1",
      inviteToken,
      seededAt
    });

    expect(create).toHaveBeenCalledWith({
      data: {
        clubId: "club-1",
        createdById: "user-1",
        tokenHash: hashInviteToken(inviteToken),
        expiresAt: new Date("2026-08-18T12:00:00.000Z"),
        maxUses: 100,
        createdAt: new Date("2026-07-17T12:00:00.000Z")
      }
    });
    expect(JSON.stringify(create.mock.calls)).not.toContain(inviteToken);
  });
});
