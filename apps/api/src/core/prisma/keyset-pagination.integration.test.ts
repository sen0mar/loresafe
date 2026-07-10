import { describe, expect, it } from "vitest";

import { clubsRepository } from "../../modules/clubs/clubs.repository.js";
import { usersRepository } from "../../modules/users/users.repository.js";
import { prisma } from "./client.js";

const describeDatabase =
  process.env.RUN_DATABASE_INTEGRATION_TESTS === "1" ? describe : describe.skip;

describeDatabase("growing-list keyset pagination", () => {
  it("pages public and joined clubs without OFFSET scans or duplicates", async () => {
    const suffix = crypto.randomUUID();
    const user = await prisma.user.create({
      data: {
        email: `pagination-${suffix}@example.com`,
        displayName: `pagination-${suffix}`.slice(0, 80),
        username: `pagination_${suffix}`.slice(0, 30),
        passwordHash: "$argon2id$v=19$integration-fixture"
      },
      select: { id: true }
    });

    try {
      const clubs = await Promise.all(
        [1, 2, 3].map((position) =>
          prisma.club.create({
            data: {
              title: `Pagination club ${position}`,
              linkName: `pagination-${position}-${suffix}`,
              category: "CUSTOM_TIMELINE",
              visibility: "PUBLIC",
              createdAt: new Date(`2099-01-0${position}T00:00:00.000Z`),
              memberships: {
                create: {
                  userId: user.id,
                  role: position === 1 ? "OWNER" : "MEMBER",
                  createdAt: new Date(`2026-02-0${position}T00:00:00.000Z`)
                }
              }
            },
            select: { id: true }
          })
        )
      );
      const firstPublicPage = await clubsRepository.listPublicClubs(user.id, {
        cursor: null,
        limit: 2,
        sort: "newest"
      });
      const secondPublicPage = await clubsRepository.listPublicClubs(user.id, {
        cursor: firstPublicPage.nextCursor,
        limit: 2,
        sort: "newest"
      });
      const firstJoinedPage = await usersRepository.listJoinedClubsForUser(
        user.id,
        { cursor: null, limit: 2, q: "" }
      );
      const secondJoinedPage = await usersRepository.listJoinedClubsForUser(
        user.id,
        { cursor: firstJoinedPage.nextCursor, limit: 2, q: "" }
      );

      expect(firstPublicPage.hasMore).toBe(true);
      const publicIds = [
        ...firstPublicPage.clubs,
        ...secondPublicPage.clubs
      ].map(({ id }) => id);
      expect(new Set(publicIds).size).toBe(publicIds.length);
      expect(publicIds).toEqual(
        expect.arrayContaining(clubs.map(({ id }) => id))
      );
      expect(firstJoinedPage.hasMore).toBe(true);
      expect(secondJoinedPage.hasMore).toBe(false);
      expect(
        new Set([...firstJoinedPage.clubs, ...secondJoinedPage.clubs].map(({ id }) => id))
      ).toEqual(new Set(clubs.map(({ id }) => id)));
    } finally {
      await prisma.club.deleteMany({
        where: { linkName: { endsWith: suffix } }
      });
      await prisma.user.deleteMany({ where: { id: user.id } });
    }
  });
});
