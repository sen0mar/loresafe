import { describe, expect, it, vi } from "vitest";

import type { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../core/prisma/client.js";
import { searchRepository } from "./search.repository.js";
import { createSearchService } from "./search.service.js";

const describeDatabase =
  process.env.RUN_DATABASE_INTEGRATION_TESTS === "1" ? describe : describe.skip;
const service = createSearchService();

describeDatabase("search spoiler boundaries", () => {
  it.each([
    { mode: null, position: null, safe: false },
    { mode: "STRICT", position: null, safe: false },
    { mode: "BRAVE", position: null, safe: false },
    { mode: "STRICT", position: 1, safe: false },
    { mode: "BRAVE", position: 1, safe: false },
    { mode: "STRICT", position: 2, safe: true },
    { mode: "BRAVE", position: 2, safe: true },
    { mode: "FINISHED", position: null, safe: true }
  ] as const)(
    "matches only readable text with $mode progress at $position",
    async ({ mode, position, safe }) => {
      const fixture = await createFixture();
      try {
        if (mode) {
          await prisma.clubProgress.create({
            data: {
              userId: fixture.viewer.id,
              clubId: fixture.club.id,
              mode,
              currentMilestoneId:
                position === null ? null : fixture.milestones[position - 1]!.id
            }
          });
        }
        for (const filters of [
          "safe,posts",
          "spoiler,posts",
          "safe,spoiler,posts"
        ]) {
          const included = safe
            ? filters.includes("safe")
            : filters.includes("spoiler");
          const metadata = await search(
            fixture.viewer.id,
            fixture.term,
            filters
          );
          expect(metadata.posts.map(({ post }) => post.id)).toEqual(
            included ? fixture.postIds : []
          );
          expect(
            metadata.posts.every(
              ({ post }) => post.visibility === (safe ? "VISIBLE" : "LOCKED")
            )
          ).toBe(true);
          for (const secret of [fixture.secretTitle, fixture.secretBody]) {
            const hidden = await search(fixture.viewer.id, secret, filters);
            expect(hidden.posts.map(({ post }) => post.id)).toEqual(
              safe && included ? [fixture.postIds[1]] : []
            );
            expect(hidden.pagination.hasMore).toBe(false);
            if (!safe) {
              expect(JSON.stringify(metadata)).not.toContain(secret);
              const disjunction = await search(
                fixture.viewer.id,
                `${fixture.term} OR ${secret}`,
                filters
              );
              const negation = await search(
                fixture.viewer.id,
                `${fixture.term} -${secret}`,
                filters
              );
              expect(disjunction.posts).toEqual(metadata.posts);
              expect(negation.posts).toEqual(metadata.posts);
            }
          }
        }
      } finally {
        await fixture.cleanup();
      }
    }
  );

  it.each(["rewind", "milestone", "lookahead"])(
    "discards stale protected matches after %s changes before hydration",
    async (change) => {
      const fixture = await createFixture();
      const findMany = prisma.post.findMany.bind(prisma.post);
      try {
        await prisma.clubProgress.create({
          data: {
            clubId: fixture.club.id,
            userId: fixture.viewer.id,
            mode: "STRICT",
            currentMilestoneId: fixture.milestones[1]!.id
          }
        });
        const later = await prisma.milestone.create({
          data: {
            clubId: fixture.club.id,
            position: 3,
            safeTitle: "Latest"
          }
        });
        const postQueries: {
          findMany: (args?: Prisma.PostFindManyArgs) => Promise<unknown[]>;
        } = prisma.post;
        vi.spyOn(postQueries, "findMany").mockImplementationOnce(
          async (args) => {
            if (change === "rewind") {
              await prisma.clubProgress.update({
                where: {
                  userId_clubId: {
                    userId: fixture.viewer.id,
                    clubId: fixture.club.id
                  }
                },
                data: { currentMilestoneId: null }
              });
            } else {
              await prisma.post.update({
                where: { id: fixture.postIds[1] },
                data: { requiredMilestoneId: later.id }
              });
            }
            return findMany(args);
          }
        );
        const response = await service.search(fixture.viewer.id, {
          q: change === "lookahead" ? fixture.term : fixture.secretBody,
          scope: "posts",
          filters: "safe,spoiler,posts",
          limit: 1
        });
        expect(response.posts).toEqual([]);
        expect(response.pagination).toEqual({
          limit: 1,
          hasMore: false,
          nextCursor: null
        });
      } finally {
        vi.restoreAllMocks();
        await fixture.cleanup();
      }
    }
  );

  it("keeps locked ranking and pagination independent of protected text", async () => {
    const fixture = await createFixture();
    try {
      const readPage = (offset: number) =>
        searchRepository.searchPosts(fixture.term, fixture.viewer.id, {
          includeSafe: true,
          includeSpoiler: true,
          offset,
          limit: 1
        });
      const before = await Promise.all([readPage(0), readPage(1)]);
      await prisma.post.update({
        where: { id: fixture.postIds[1] },
        data: {
          title: fixture.term,
          body: Array(30).fill(fixture.term).join(" ")
        }
      });
      const after = await Promise.all([readPage(0), readPage(1)]);
      const projection = (pages: typeof before) =>
        pages.map((page) => ({
          ids: page.records.map(({ post }) => post.id),
          hasMore: page.hasMore
        }));
      expect(projection(after)).toEqual(projection(before));
      expect(projection(after)).toEqual([
        { ids: [fixture.postIds[0]], hasMore: true },
        { ids: [fixture.postIds[1]], hasMore: false }
      ]);
    } finally {
      await fixture.cleanup();
    }
  });
});

const search = (userId: string, q: string, filters: string) =>
  service.search(userId, { q, scope: "posts", filters, limit: 20 });

const createFixture = async () => {
  const suffix = crypto.randomUUID().replaceAll("-", "");
  const term = `discovery${suffix}`;
  const secretTitle = `title${suffix}`;
  const secretBody = `body${suffix}`;
  const viewer = await prisma.user.create({
    data: {
      email: `${suffix}@example.com`,
      displayName: suffix,
      username: suffix.slice(0, 30),
      passwordHash: "integration-fixture"
    }
  });
  const club = await prisma.club.create({
    data: {
      title: term,
      linkName: `search-${suffix}`,
      category: "BOOKS",
      visibility: "PUBLIC",
      memberships: { create: { userId: viewer.id, role: "OWNER" } },
      milestones: {
        create: [
          { position: 1, safeTitle: "Opening" },
          { position: 2, safeTitle: "Later" }
        ]
      }
    },
    include: { milestones: { orderBy: { position: "asc" } } }
  });
  const posts = await Promise.all(
    [0, 1].map((index) =>
      prisma.post.create({
        data: {
          clubId: club.id,
          authorId: viewer.id,
          type: "DISCUSSION",
          title: index ? secretTitle : "Ordinary discussion",
          body: index ? secretBody : "Ordinary body",
          requiredMilestoneId: club.milestones[1]!.id,
          createdAt: new Date(Date.now() - index * 60_000)
        }
      })
    )
  );
  return {
    viewer,
    club,
    milestones: club.milestones,
    term,
    secretTitle,
    secretBody,
    postIds: posts.map((post) => post.id),
    cleanup: async () => {
      await prisma.post.deleteMany({ where: { clubId: club.id } });
      await prisma.club.delete({ where: { id: club.id } });
      await prisma.user.delete({ where: { id: viewer.id } });
    }
  };
};
