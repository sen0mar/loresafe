import { describe, expect, it } from "vitest";

import { prisma } from "../../core/prisma/client.js";
import { createCommentNotificationInTransaction } from "../notifications/notifications.commands.repository.js";
import { commentsRepository } from "./comments.repository.js";

const describeDatabase =
  process.env.RUN_DATABASE_INTEGRATION_TESTS === "1" ? describe : describe.skip;

describeDatabase("comment notification transaction", () => {
  it("commits one spoiler-safe notification with its comment", async () => {
    const suffix = crypto.randomUUID();
    const userIds: string[] = [];
    let clubId: string | null = null;

    try {
      const [author, commenter] = await Promise.all(
        ["author", "commenter"].map((role) =>
          prisma.user.create({
            data: {
              email: `comment-${role}-${suffix}@example.com`,
              displayName: `${role}-${suffix}`.slice(0, 80),
              username: `${role}_${suffix}`.slice(0, 30),
              passwordHash: "$argon2id$v=19$integration-fixture"
            },
            select: {
              id: true
            }
          })
        )
      );
      userIds.push(author.id, commenter.id);
      const club = await prisma.club.create({
        data: {
          title: "Atomic comment fixture",
          linkName: `atomic-comment-${suffix}`,
          category: "CUSTOM_TIMELINE",
          visibility: "PUBLIC",
          memberships: {
            create: [
              { userId: author.id, role: "OWNER" },
              { userId: commenter.id, role: "MEMBER" }
            ]
          },
          milestones: {
            create: {
              position: 1,
              safeTitle: "Opening"
            }
          }
        },
        select: {
          id: true,
          milestones: {
            select: {
              id: true
            },
            take: 1
          }
        }
      });
      clubId = club.id;
      const milestone = club.milestones[0];

      if (!milestone) {
        throw new Error("Expected a milestone fixture.");
      }

      await prisma.clubProgress.create({
        data: {
          userId: commenter.id,
          clubId: club.id,
          currentMilestoneId: milestone.id,
          mode: "FINISHED",
          onboardingCompletedAt: new Date(),
          version: 1
        }
      });
      const post = await prisma.post.create({
        data: {
          clubId: club.id,
          authorId: author.id,
          type: "DISCUSSION",
          title: "Opening discussion",
          body: "A safe fixture discussion.",
          requiredMilestoneId: milestone.id
        },
        select: {
          id: true
        }
      });

      const comment = await commentsRepository.createPostComment(
        post.id,
        commenter.id,
        {
          body: "A transactionally notified comment.",
          requiredMilestoneId: milestone.id
        }
      );

      expect(comment).not.toBeNull();

      if (!comment) {
        throw new Error("Expected the comment transaction to commit.");
      }

      await Promise.all([
        prisma.$transaction((transaction) =>
          createCommentNotificationInTransaction(transaction, comment.id)
        ),
        prisma.$transaction((transaction) =>
          createCommentNotificationInTransaction(transaction, comment.id)
        )
      ]);
      expect(
        await prisma.notification.findMany({
          where: {
            commentId: comment.id
          },
          select: {
            userId: true,
            type: true,
            safeText: true,
            requiredMilestoneId: true
          }
        })
      ).toEqual([
        {
          userId: author.id,
          type: "POST_COMMENT",
          safeText: "New comment in Atomic comment fixture",
          requiredMilestoneId: milestone.id
        }
      ]);
    } finally {
      if (clubId) {
        await prisma.notification.deleteMany({ where: { clubId } });
        await prisma.comment.deleteMany({ where: { post: { clubId } } });
        await prisma.post.deleteMany({ where: { clubId } });
        await prisma.club.deleteMany({ where: { id: clubId } });
      }
      if (userIds.length > 0) {
        await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      }
    }
  }, 20_000);
});
