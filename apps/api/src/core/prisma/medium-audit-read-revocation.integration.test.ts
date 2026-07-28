import { describe, expect, it } from "vitest";

import type { Prisma } from "../../generated/prisma/client.js";
import { lockClubAuthorizationChanges } from "../../modules/clubs/club-authorization-lock.js";
import { commentsService } from "../../modules/comments/comments.service.js";
import { postsService } from "../../modules/posts/posts.service.js";
import { lockUserClubProgress } from "../../modules/progress/progress-authorization-lock.js";
import { reportsService } from "../../modules/reports/reports.service.js";
import { prisma } from "./client.js";

const describeDatabase =
  process.env.RUN_DATABASE_INTEGRATION_TESTS === "1" ? describe : describe.skip;

describeDatabase("medium audit sensitive read revocation", () => {
  it("does not return private posts or comments after membership revocation commits", async () => {
    const fixture = await createReadFixture("private-revocation");

    try {
      const revocation = await startHeldClubMutation(
        fixture.club.id,
        async (transaction) => {
          await transaction.clubMembership.delete({
            where: {
              userId_clubId: {
                userId: fixture.viewer.id,
                clubId: fixture.club.id
              }
            }
          });
        }
      );
      const postsRead = expect(
        postsService.listClubPostsByLinkName(
          fixture.club.linkName,
          fixture.viewer.id,
          { tab: "all", limit: 20 }
        )
      ).rejects.toMatchObject({ statusCode: 404 });
      const commentsRead = expect(
        commentsService.listPostComments(fixture.post.id, fixture.viewer.id, {
          limit: 20
        })
      ).rejects.toMatchObject({ statusCode: 404 });

      await allowReadsToReachFinalAuthorization();
      revocation.release();
      await revocation.completion;

      await postsRead;
      await commentsRead;
    } finally {
      await cleanupReadFixture(fixture);
    }
  });

  it("projects a spoiler-locked response after a concurrent progress rewind", async () => {
    const fixture = await createReadFixture("progress-revocation");

    try {
      const rewind = await startHeldProgressMutation(
        fixture.viewer.id,
        fixture.club.id,
        async (transaction) => {
          await transaction.clubProgress.update({
            where: {
              userId_clubId: {
                userId: fixture.viewer.id,
                clubId: fixture.club.id
              }
            },
            data: {
              currentMilestoneId: fixture.lowMilestone.id,
              mode: "STRICT"
            }
          });
        }
      );
      const read = postsService.listClubPostsByLinkName(
        fixture.club.linkName,
        fixture.viewer.id,
        { tab: "all", limit: 20 }
      );

      await allowReadsToReachFinalAuthorization();
      rewind.release();
      await rewind.completion;

      const response = await read;
      expect(response.posts).toEqual([
        expect.objectContaining({
          id: fixture.post.id,
          visibility: "LOCKED"
        })
      ]);
      expect(JSON.stringify(response)).not.toContain(fixture.secretBody);
      expect(JSON.stringify(response)).not.toContain(fixture.secretTitle);
    } finally {
      await cleanupReadFixture(fixture);
    }
  });

  it("does not reveal moderation data after moderator demotion commits", async () => {
    const fixture = await createReadFixture("moderation-revocation");

    try {
      const demotion = await startHeldClubMutation(
        fixture.club.id,
        async (transaction) => {
          await transaction.clubMembership.update({
            where: {
              userId_clubId: {
                userId: fixture.moderator.id,
                clubId: fixture.club.id
              }
            },
            data: { role: "MEMBER" }
          });
        }
      );
      const reveal = expect(
        reportsService.revealModerationReportForClub(
          fixture.club.linkName,
          fixture.report.id,
          fixture.moderator.id
        )
      ).rejects.toMatchObject({ statusCode: 404 });

      await allowReadsToReachFinalAuthorization();
      demotion.release();
      await demotion.completion;

      await reveal;
    } finally {
      await cleanupReadFixture(fixture);
    }
  });
});

const createReadFixture = async (label: string) => {
  const suffix = crypto.randomUUID();
  const [owner, viewer, moderator] = await Promise.all(
    ["owner", "viewer", "moderator"].map((role) =>
      prisma.user.create({
        data: {
          email: `${label}-${role}-${suffix}@example.com`,
          displayName: `${role}-${suffix}`.slice(0, 80),
          username: `${role}_${suffix}`.slice(0, 30),
          passwordHash: "$argon2id$v=19$integration-fixture",
          emailVerifiedAt: new Date()
        },
        select: { id: true }
      })
    )
  );

  if (!owner || !viewer || !moderator) {
    throw new Error("Read revocation users were not created.");
  }

  const club = await prisma.club.create({
    data: {
      title: `${label} fixture`,
      linkName: `${label}-${suffix}`,
      category: "CUSTOM_TIMELINE",
      visibility: "PRIVATE",
      memberships: {
        create: [
          { userId: owner.id, role: "OWNER" },
          { userId: viewer.id, role: "MEMBER" },
          { userId: moderator.id, role: "MODERATOR" }
        ]
      }
    },
    select: { id: true, linkName: true }
  });
  const lowMilestone = await prisma.milestone.create({
    data: {
      clubId: club.id,
      position: 1,
      safeTitle: "Safe checkpoint"
    },
    select: { id: true }
  });
  const highMilestone = await prisma.milestone.create({
    data: {
      clubId: club.id,
      position: 2,
      safeTitle: "Future checkpoint"
    },
    select: { id: true }
  });
  await prisma.clubProgress.create({
    data: {
      userId: viewer.id,
      clubId: club.id,
      currentMilestoneId: highMilestone.id,
      mode: "STRICT"
    }
  });
  const secretTitle = `secret-title-${suffix}`;
  const secretBody = `secret-body-${suffix}`;
  const post = await prisma.post.create({
    data: {
      clubId: club.id,
      authorId: owner.id,
      requiredMilestoneId: highMilestone.id,
      type: "DISCUSSION",
      title: secretTitle,
      body: secretBody
    },
    select: { id: true }
  });
  await prisma.comment.create({
    data: {
      postId: post.id,
      authorId: owner.id,
      requiredMilestoneId: highMilestone.id,
      body: `secret-comment-${suffix}`
    }
  });
  const report = await prisma.report.create({
    data: {
      clubId: club.id,
      reporterId: viewer.id,
      postId: post.id,
      targetType: "POST",
      reason: "SPOILER",
      details: `secret-report-${suffix}`
    },
    select: { id: true }
  });

  return {
    club,
    users: [owner, viewer, moderator],
    owner,
    viewer,
    moderator,
    lowMilestone,
    post,
    report,
    secretTitle,
    secretBody
  };
};

const startHeldClubMutation = async (
  clubId: string,
  mutate: (transaction: Prisma.TransactionClient) => Promise<void>
) => {
  return startHeldMutation(async (transaction) => {
    await lockClubAuthorizationChanges(transaction, clubId);
    await mutate(transaction);
  });
};

const startHeldProgressMutation = async (
  userId: string,
  clubId: string,
  mutate: (transaction: Prisma.TransactionClient) => Promise<void>
) =>
  startHeldMutation(async (transaction) => {
    await lockUserClubProgress(transaction, userId, clubId);
    await mutate(transaction);
  });

const startHeldMutation = async (
  mutate: (transaction: Prisma.TransactionClient) => Promise<void>
) => {
  let releaseMutation: () => void = () => undefined;
  let signalMutationApplied: () => void = () => undefined;
  const mutationApplied = new Promise<void>((resolve) => {
    signalMutationApplied = resolve;
  });
  const releaseRequested = new Promise<void>((resolve) => {
    releaseMutation = resolve;
  });
  const completion = prisma.$transaction(async (transaction) => {
    await mutate(transaction);
    signalMutationApplied();
    await releaseRequested;
  });

  await mutationApplied;

  return {
    completion,
    release: releaseMutation
  };
};

const allowReadsToReachFinalAuthorization = () =>
  new Promise((resolve) => setTimeout(resolve, 100));

const cleanupReadFixture = async (
  fixture: Awaited<ReturnType<typeof createReadFixture>>
) => {
  await prisma.report.deleteMany({ where: { clubId: fixture.club.id } });
  await prisma.comment.deleteMany({
    where: { post: { clubId: fixture.club.id } }
  });
  await prisma.post.deleteMany({ where: { clubId: fixture.club.id } });
  await prisma.clubProgress.deleteMany({
    where: { clubId: fixture.club.id }
  });
  await prisma.club.deleteMany({ where: { id: fixture.club.id } });
  await prisma.user.deleteMany({
    where: { id: { in: fixture.users.map((user) => user.id) } }
  });
};
