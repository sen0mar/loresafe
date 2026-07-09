import { describe, expect, it } from "vitest";

import { prisma } from "./client.js";

const describeDatabase =
  process.env.RUN_DATABASE_INTEGRATION_TESTS === "1" ? describe : describe.skip;

describeDatabase("cross-club database invariants", () => {
  it("rejects mismatched content, report, and asset relationships", async () => {
    const suffix = crypto.randomUUID();
    let firstClubId: string | null = null;
    let secondClubId: string | null = null;
    let userId: string | null = null;

    try {
      const user = await prisma.user.create({
        data: {
          email: `invariants-${suffix}@example.com`,
          displayName: `invariants-${suffix}`.slice(0, 80),
          username: `invariants_${suffix}`.slice(0, 30),
          passwordHash: "$argon2id$v=19$integration-fixture"
        },
        select: {
          id: true
        }
      });
      userId = user.id;
      const [firstClub, secondClub] = await Promise.all(
        ["first", "second"].map((label) =>
          prisma.club.create({
            data: {
              title: `${label} invariant fixture`,
              linkName: `${label}-invariants-${suffix}`,
              category: "CUSTOM_TIMELINE",
              visibility: "PUBLIC",
              memberships: {
                create: {
                  userId: user.id,
                  role: "OWNER"
                }
              },
              milestones: {
                create: {
                  position: 1,
                  safeTitle: `${label} opening`
                }
              }
            },
            select: {
              id: true,
              milestones: {
                select: {
                  id: true
                }
              }
            }
          })
        )
      );
      firstClubId = firstClub.id;
      secondClubId = secondClub.id;
      const firstMilestoneId = firstClub.milestones[0]?.id;
      const secondMilestoneId = secondClub.milestones[0]?.id;

      if (!firstMilestoneId || !secondMilestoneId) {
        throw new Error("Invariant fixture milestones were not created.");
      }

      await expect(
        prisma.post.create({
          data: {
            clubId: firstClub.id,
            authorId: user.id,
            type: "DISCUSSION",
            title: "Invalid post",
            body: "This must not cross clubs.",
            requiredMilestoneId: secondMilestoneId
          }
        })
      ).rejects.toBeDefined();

      const post = await prisma.post.create({
        data: {
          clubId: firstClub.id,
          authorId: user.id,
          type: "DISCUSSION",
          title: "Valid post",
          body: "Fixture post.",
          requiredMilestoneId: firstMilestoneId
        },
        select: {
          id: true
        }
      });

      await expect(
        prisma.comment.create({
          data: {
            postId: post.id,
            authorId: user.id,
            body: "Invalid cross-club comment.",
            requiredMilestoneId: secondMilestoneId
          }
        })
      ).rejects.toBeDefined();

      await expect(
        prisma.report.create({
          data: {
            targetType: "COMMENT",
            reason: "OTHER",
            reporterId: user.id,
            clubId: firstClub.id,
            postId: post.id
          }
        })
      ).rejects.toBeDefined();

      await expect(
        prisma.fileAsset.create({
          data: {
            ownerId: user.id,
            clubId: firstClub.id,
            purpose: "AVATAR",
            visibility: "PUBLIC",
            objectKey: `public/avatars/${user.id}/invalid.png`,
            contentType: "image/png",
            sizeBytes: 100
          }
        })
      ).rejects.toBeDefined();
    } finally {
      await prisma.club.deleteMany({
        where: {
          id: {
            in: [firstClubId, secondClubId].filter(
              (id): id is string => id !== null
            )
          }
        }
      });
      if (userId) {
        await prisma.user.deleteMany({
          where: {
            id: userId
          }
        });
      }
    }
  });
});
