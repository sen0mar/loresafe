import { describe, expect, it } from "vitest";

import { prisma } from "./client.js";
import { invitesRepository } from "../../modules/invites/invites.repository.js";
import { hashInviteToken } from "../../modules/invites/invites.token.js";
import { postsRepository } from "../../modules/posts/posts.repository.js";
import { uploadsRepository } from "../../modules/uploads/uploads.repository.js";
import { lockClubAuthorizationChanges } from "../../modules/clubs/club-authorization-lock.js";

const describeDatabase =
  process.env.RUN_DATABASE_INTEGRATION_TESTS === "1" ? describe : describe.skip;

describeDatabase("security-sensitive database commands", () => {
  it("spends a single-use invite only once under concurrent acceptance", async () => {
    const suffix = crypto.randomUUID();
    const tokenHash = hashInviteToken(`integration-${suffix}`);
    let clubId: string | null = null;

    try {
      const users = await createFixtureUsers(suffix, [
        "owner",
        "first",
        "second"
      ]);
      const owner = users[0];
      const first = users[1];
      const second = users[2];

      if (!owner || !first || !second) {
        throw new Error("Invite fixture users were not created.");
      }

      const club = await prisma.club.create({
        data: {
          title: "Invite concurrency fixture",
          linkName: `invite-race-${suffix}`,
          category: "CUSTOM_TIMELINE",
          visibility: "INVITE_ONLY",
          memberships: {
            create: {
              userId: owner.id,
              role: "OWNER"
            }
          },
          invites: {
            create: {
              createdById: owner.id,
              tokenHash,
              expiresAt: new Date(Date.now() + 60_000),
              maxUses: 1
            }
          }
        },
        select: {
          id: true
        }
      });
      clubId = club.id;

      const results = await Promise.all([
        invitesRepository.acceptInviteByTokenHash(
          tokenHash,
          first.id,
          new Date()
        ),
        invitesRepository.acceptInviteByTokenHash(
          tokenHash,
          second.id,
          new Date()
        )
      ]);
      const invite = await prisma.clubInvite.findUniqueOrThrow({
        where: {
          tokenHash
        },
        select: {
          usedCount: true
        }
      });
      const acceptedMemberCount = await prisma.clubMembership.count({
        where: {
          clubId,
          userId: {
            in: [first.id, second.id]
          }
        }
      });

      expect(results.map((result) => result.status).sort()).toEqual([
        "accepted",
        "maxed"
      ]);
      expect(invite.usedCount).toBe(1);
      expect(acceptedMemberCount).toBe(1);
    } finally {
      await cleanupFixture(suffix, clubId);
    }
  });

  it("serializes reaction retries and denies a write when membership disappears in flight", async () => {
    const suffix = crypto.randomUUID();
    let clubId: string | null = null;

    try {
      const users = await createFixtureUsers(suffix, ["owner", "reader"]);
      const owner = users[0];
      const reader = users[1];

      if (!owner || !reader) {
        throw new Error("Reaction fixture users were not created.");
      }

      const club = await prisma.club.create({
        data: {
          title: "Reaction concurrency fixture",
          linkName: `reaction-race-${suffix}`,
          category: "CUSTOM_TIMELINE",
          visibility: "PUBLIC",
          memberships: {
            create: [
              { userId: owner.id, role: "OWNER" },
              { userId: reader.id, role: "MEMBER" }
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
            }
          }
        }
      });
      clubId = club.id;
      const milestone = club.milestones[0];

      if (!milestone) {
        throw new Error("Reaction fixture milestone was not created.");
      }

      await prisma.clubProgress.create({
        data: {
          clubId,
          userId: reader.id,
          currentMilestoneId: milestone.id,
          mode: "STRICT"
        }
      });

      const post = await prisma.post.create({
        data: {
          clubId,
          authorId: owner.id,
          type: "DISCUSSION",
          title: "Concurrent reaction target",
          body: "Visible integration fixture",
          requiredMilestoneId: milestone.id
        },
        select: {
          id: true
        }
      });

      await Promise.all([
        postsRepository.setPostReaction(post.id, reader.id, {
          emoji: "👍",
          active: true
        }),
        postsRepository.setPostReaction(post.id, reader.id, {
          emoji: "👍",
          active: true
        })
      ]);

      expect(
        await prisma.postReaction.count({
          where: {
            postId: post.id,
            userId: reader.id,
            emoji: "👍"
          }
        })
      ).toBe(1);

      await prisma.postReaction.deleteMany({
        where: { postId: post.id, userId: reader.id }
      });

      let signalMembershipDeleted: () => void = () => {};
      let allowMembershipCommit: () => void = () => {};
      const membershipDeleted = new Promise<void>((resolve) => {
        signalMembershipDeleted = resolve;
      });
      const membershipCommitAllowed = new Promise<void>((resolve) => {
        allowMembershipCommit = resolve;
      });
      const reactionClubId = club.id;
      const membershipRemoval = prisma.$transaction(async (transaction) => {
        await lockClubAuthorizationChanges(transaction, reactionClubId);
        await transaction.clubMembership.delete({
          where: {
            userId_clubId: {
              userId: reader.id,
              clubId: reactionClubId
            }
          }
        });
        signalMembershipDeleted();
        await membershipCommitAllowed;
      });

      await membershipDeleted;
      const inFlightReaction = postsRepository.setPostReaction(
        post.id,
        reader.id,
        { emoji: "👍", active: true }
      );
      await new Promise((resolve) => setTimeout(resolve, 100));
      allowMembershipCommit();
      await membershipRemoval;

      await expect(inFlightReaction).resolves.toBeNull();
      expect(
        await prisma.postReaction.count({
          where: {
            postId: post.id,
            userId: reader.id
          }
        })
      ).toBe(0);
    } finally {
      await cleanupFixture(suffix, clubId);
    }
  });

  it("returns one stable READY result for concurrent upload completion", async () => {
    const suffix = crypto.randomUUID();

    try {
      const [owner] = await createFixtureUsers(suffix, ["upload-owner"]);

      if (!owner) {
        throw new Error("Upload fixture user was not created.");
      }

      const asset = await prisma.fileAsset.create({
        data: {
          ownerId: owner.id,
          purpose: "AVATAR",
          visibility: "PUBLIC",
          objectKey: `public/avatars/${owner.id}/${suffix}.png`,
          contentType: "image/png",
          sizeBytes: 128,
          status: "PENDING"
        }
      });
      const completedAt = new Date();
      const validation = {
        widthPx: 32,
        heightPx: 32,
        isAnimated: false
      };
      const results = await Promise.all([
        uploadsRepository.markAssetReadyAndAttach(
          asset,
          completedAt,
          validation
        ),
        uploadsRepository.markAssetReadyAndAttach(
          asset,
          completedAt,
          validation
        )
      ]);

      expect(results.map((result) => result?.asset.status)).toEqual([
        "READY",
        "READY"
      ]);
      expect(
        await prisma.fileAsset.count({
          where: { id: asset.id, status: "READY" }
        })
      ).toBe(1);
    } finally {
      await cleanupFixture(suffix, null);
    }
  });
});

const createFixtureUsers = (suffix: string, labels: string[]) =>
  Promise.all(
    labels.map((label) =>
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

const cleanupFixture = async (suffix: string, clubId: string | null) => {
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
};
