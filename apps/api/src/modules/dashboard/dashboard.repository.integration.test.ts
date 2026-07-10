import { describe, expect, it } from "vitest";

import { prisma } from "../../core/prisma/client.js";
import { dashboardRepository } from "./dashboard.repository.js";

const describeDatabase =
  process.env.RUN_DATABASE_INTEGRATION_TESTS === "1" ? describe : describe.skip;

describeDatabase("dashboard repository aggregates", () => {
  it("returns consolidated stats and ranks only recent club discussions", async () => {
    const suffix = crypto.randomUUID();
    const linkName = `dashboard-bounds-${suffix}`;
    let clubId: string | null = null;

    try {
      const users = await Promise.all(
        ["owner", "viewer", "reactor"].map((label) =>
          prisma.user.create({
            data: {
              email: `${label}-${suffix}@example.com`,
              displayName: `${label}-${suffix}`.slice(0, 80),
              username: `${label}_${suffix}`.slice(0, 30),
              passwordHash: "$argon2id$v=19$integration-fixture"
            },
            select: {
              id: true
            }
          })
        )
      );
      const owner = users[0];
      const viewer = users[1];
      const reactor = users[2];

      if (!owner || !viewer || !reactor) {
        throw new Error("Dashboard fixture users were not created.");
      }

      const club = await prisma.club.create({
        data: {
          title: "Dashboard bounds fixture",
          linkName,
          category: "CUSTOM_TIMELINE",
          visibility: "PUBLIC",
          memberships: {
            create: [
              { userId: owner.id, role: "OWNER" },
              { userId: viewer.id, role: "MEMBER" },
              { userId: reactor.id, role: "MEMBER" }
            ]
          },
          milestones: {
            create: [
              { position: 1, safeTitle: "Opening" },
              { position: 2, safeTitle: "Later" }
            ]
          }
        },
        select: {
          id: true,
          milestones: {
            orderBy: {
              position: "asc"
            },
            select: {
              id: true
            }
          }
        }
      });
      clubId = club.id;
      const firstMilestone = club.milestones[0];
      const secondMilestone = club.milestones[1];

      if (!firstMilestone || !secondMilestone) {
        throw new Error("Dashboard fixture milestones were not created.");
      }

      await prisma.clubProgress.create({
        data: {
          clubId,
          userId: viewer.id,
          currentMilestoneId: firstMilestone.id,
          mode: "STRICT"
        }
      });

      const recentPost = await prisma.post.create({
        data: {
          clubId,
          authorId: owner.id,
          type: "DISCUSSION",
          title: "Recent discussion",
          body: "Recent and safe",
          requiredMilestoneId: firstMilestone.id
        },
        select: {
          id: true
        }
      });
      const oldPost = await prisma.post.create({
        data: {
          clubId,
          authorId: viewer.id,
          type: "DISCUSSION",
          title: "Old discussion",
          body: "Old and locked",
          requiredMilestoneId: secondMilestone.id,
          createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000)
        },
        select: {
          id: true
        }
      });
      const hiddenPost = await prisma.post.create({
        data: {
          clubId,
          authorId: owner.id,
          type: "DISCUSSION",
          title: "Hidden discussion",
          body: "Must not count",
          requiredMilestoneId: firstMilestone.id,
          status: "HIDDEN"
        },
        select: {
          id: true
        }
      });

      await prisma.comment.createMany({
        data: [
          {
            postId: recentPost.id,
            authorId: viewer.id,
            body: "Viewer comment",
            requiredMilestoneId: firstMilestone.id
          },
          {
            postId: oldPost.id,
            authorId: owner.id,
            body: "Old comment",
            requiredMilestoneId: secondMilestone.id
          },
          {
            postId: hiddenPost.id,
            authorId: owner.id,
            body: "Hidden post comment",
            requiredMilestoneId: firstMilestone.id
          },
          {
            postId: recentPost.id,
            authorId: owner.id,
            body: "Hidden comment",
            requiredMilestoneId: firstMilestone.id,
            status: "HIDDEN"
          }
        ]
      });
      await prisma.postReaction.createMany({
        data: [
          { postId: recentPost.id, userId: viewer.id, emoji: "👍" },
          { postId: oldPost.id, userId: owner.id, emoji: "👍" },
          { postId: oldPost.id, userId: reactor.id, emoji: "❤️" },
          { postId: hiddenPost.id, userId: viewer.id, emoji: "👍" }
        ]
      });

      const dashboardClub = await dashboardRepository.findClubForDashboard(
        linkName,
        viewer.id
      );

      if (!dashboardClub) {
        throw new Error("Dashboard fixture club was not found.");
      }

      const stats = await dashboardRepository.getClubDashboardStats(
        viewer.id,
        dashboardClub
      );
      const popular = await dashboardRepository.getPopularDiscussions(
        viewer.id,
        clubId,
        5
      );

      expect(stats).toMatchObject({
        memberCount: 3,
        milestoneCount: 2,
        visiblePostCount: 2,
        visibleCommentCount: 2,
        postReactionCount: 3,
        safePostCount: 1,
        lockedPostCount: 1,
        viewer: {
          postCount: 1,
          commentCount: 1
        }
      });
      expect(stats.viewer.joinedAt).toBeInstanceOf(Date);
      expect(popular).toHaveLength(1);
      expect(popular[0]?.post.id).toBe(recentPost.id);
      expect(popular[0]?.engagementScore).toBe(2);
    } finally {
      if (clubId) {
        await prisma.comment.deleteMany({
          where: {
            post: {
              clubId
            }
          }
        });
        await prisma.post.deleteMany({
          where: {
            clubId
          }
        });
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
