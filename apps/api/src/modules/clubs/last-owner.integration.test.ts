import { describe, expect, it } from "vitest";

import { prisma } from "../../core/prisma/client.js";
import { clubsRepository } from "./clubs.repository.js";

const describeDatabase =
  process.env.RUN_DATABASE_INTEGRATION_TESTS === "1" ? describe : describe.skip;

describeDatabase("last-owner database invariant", () => {
  it("allows only one of two owners to leave concurrently", async () => {
    const suffix = crypto.randomUUID();
    const linkName = `owner-race-${suffix}`;
    let clubId: string | null = null;

    try {
      const users = await Promise.all(
        ["first", "second"].map((label) =>
          prisma.user.create({
            data: {
              email: `${label}-${suffix}@example.com`,
              displayName: `${label}-${suffix}`,
              username: `${label}_${suffix}`.slice(0, 30),
              passwordHash: "$argon2id$v=19$integration-fixture"
            },
            select: {
              id: true
            }
          })
        )
      );
      const club = await prisma.club.create({
        data: {
          title: "Owner race fixture",
          linkName,
          category: "CUSTOM_TIMELINE",
          visibility: "PUBLIC",
          memberships: {
            create: users.map((user) => ({
              userId: user.id,
              role: "OWNER"
            }))
          }
        },
        select: {
          id: true
        }
      });
      clubId = club.id;
      const results = await Promise.all(
        users.map((user) =>
          clubsRepository.leaveClubByLinkName(linkName, user.id)
        )
      );
      const statuses = results.map((result) => result.status).sort();
      const ownerCount = await prisma.clubMembership.count({
        where: {
          clubId,
          role: "OWNER"
        }
      });

      expect(statuses).toEqual(["LAST_OWNER", "SUCCESS"]);
      expect(ownerCount).toBe(1);
    } finally {
      if (clubId) {
        await prisma.club.deleteMany({
          where: {
            id: clubId
          }
        });
      }
      await prisma.user.deleteMany({
        where: {
          email: {
            endsWith: `-${suffix}@example.com`
          }
        }
      });
    }
  });
});
