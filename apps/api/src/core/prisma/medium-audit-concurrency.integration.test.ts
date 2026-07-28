import { describe, expect, it } from "vitest";

import type { Prisma } from "../../generated/prisma/client.js";
import { lockClubAuthorizationChanges } from "../../modules/clubs/club-authorization-lock.js";
import { clubsRepository } from "../../modules/clubs/clubs.repository.js";
import { invitesRepository } from "../../modules/invites/invites.repository.js";
import { uploadsCleanupRepository } from "../../modules/uploads/uploads-cleanup.repository.js";
import { uploadsRepository } from "../../modules/uploads/uploads.repository.js";
import { prisma } from "./client.js";

const describeDatabase =
  process.env.RUN_DATABASE_INTEGRATION_TESTS === "1" ? describe : describe.skip;

describeDatabase("medium audit authorization concurrency", () => {
  it("denies a public join that waits behind a private visibility change", async () => {
    const fixture = await createClubFixture("join-visibility", [
      "owner",
      "joiner"
    ]);
    const owner = fixture.users[0];
    const joiner = fixture.users[1];

    if (!owner || !joiner) {
      throw new Error("Join fixture users were not created.");
    }

    try {
      const visibilityChange = await startHeldClubMutation(
        fixture.club.id,
        async (transaction) => {
          await transaction.club.update({
            where: {
              id: fixture.club.id
            },
            data: {
              visibility: "PRIVATE"
            }
          });
        }
      );
      const join = clubsRepository.joinPublicClubByLinkName(
        fixture.club.linkName,
        joiner.id
      );

      await allowCommandToReachClubLock();
      visibilityChange.release();
      await visibilityChange.completion;

      await expect(join).resolves.toEqual({
        status: "NOT_FOUND"
      });
      expect(
        await prisma.clubMembership.count({
          where: {
            clubId: fixture.club.id,
            userId: joiner.id
          }
        })
      ).toBe(0);
    } finally {
      await cleanupFixture(fixture);
    }
  });

  it("denies invite creation that waits behind moderator demotion", async () => {
    const fixture = await createClubFixture("invite-authority", [
      "owner",
      "moderator"
    ]);
    const moderator = fixture.users[1];

    if (!moderator) {
      throw new Error("Invite fixture moderator was not created.");
    }

    try {
      await prisma.clubMembership.create({
        data: {
          clubId: fixture.club.id,
          userId: moderator.id,
          role: "MODERATOR"
        }
      });
      const demotion = await startHeldClubMutation(
        fixture.club.id,
        async (transaction) => {
          await transaction.clubMembership.update({
            where: {
              userId_clubId: {
                clubId: fixture.club.id,
                userId: moderator.id
              }
            },
            data: {
              role: "MEMBER"
            }
          });
        }
      );
      const createInvite = invitesRepository.createClubInvite({
        clubId: fixture.club.id,
        createdById: moderator.id,
        tokenHash: crypto.randomUUID().replaceAll("-", "").padEnd(64, "0"),
        expiresAt: new Date(Date.now() + 60_000),
        maxUses: 1
      });

      await allowCommandToReachClubLock();
      demotion.release();
      await demotion.completion;

      await expect(createInvite).resolves.toEqual({
        status: "FORBIDDEN"
      });
      expect(
        await prisma.clubInvite.count({
          where: {
            clubId: fixture.club.id
          }
        })
      ).toBe(0);
    } finally {
      await cleanupFixture(fixture);
    }
  });

  it("denies unban that waits behind moderator demotion", async () => {
    const fixture = await createClubFixture("unban-authority", [
      "owner",
      "moderator",
      "target"
    ]);
    const moderator = fixture.users[1];
    const target = fixture.users[2];

    if (!moderator || !target) {
      throw new Error("Unban fixture users were not created.");
    }

    try {
      await prisma.clubMembership.create({
        data: {
          clubId: fixture.club.id,
          userId: moderator.id,
          role: "MODERATOR"
        }
      });
      const ban = await prisma.clubBan.create({
        data: {
          clubId: fixture.club.id,
          userId: target.id,
          roleAtBan: "MEMBER",
          reason: "Concurrency fixture"
        }
      });
      const demotion = await startHeldClubMutation(
        fixture.club.id,
        async (transaction) => {
          await transaction.clubMembership.update({
            where: {
              userId_clubId: {
                clubId: fixture.club.id,
                userId: moderator.id
              }
            },
            data: {
              role: "MEMBER"
            }
          });
        }
      );
      const unban = clubsRepository.unbanClubBan(
        fixture.club.linkName,
        ban.id,
        moderator.id
      );

      await allowCommandToReachClubLock();
      demotion.release();
      await demotion.completion;

      await expect(unban).resolves.toEqual({
        status: "ACTOR_NOT_ALLOWED"
      });
      expect(
        await prisma.clubBan.findUniqueOrThrow({
          where: {
            id: ban.id
          },
          select: {
            revokedAt: true
          }
        })
      ).toEqual({
        revokedAt: null
      });
    } finally {
      await cleanupFixture(fixture);
    }
  });

  it("denies club-cover completion that waits behind moderator demotion", async () => {
    const fixture = await createClubFixture("cover-authority", [
      "owner",
      "moderator"
    ]);
    const moderator = fixture.users[1];

    if (!moderator) {
      throw new Error("Cover fixture moderator was not created.");
    }

    try {
      await prisma.clubMembership.create({
        data: {
          clubId: fixture.club.id,
          userId: moderator.id,
          role: "MODERATOR"
        }
      });
      const asset = await createPendingCoverAsset(
        fixture,
        moderator.id,
        "denied"
      );
      const demotion = await startHeldClubMutation(
        fixture.club.id,
        async (transaction) => {
          await transaction.clubMembership.update({
            where: {
              userId_clubId: {
                clubId: fixture.club.id,
                userId: moderator.id
              }
            },
            data: {
              role: "MEMBER"
            }
          });
        }
      );
      const completion = uploadsRepository.markAssetReadyAndAttach(
        asset,
        moderator.id,
        new Date(),
        imageValidation
      );

      await allowCommandToReachClubLock();
      demotion.release();
      await demotion.completion;

      await expect(completion).resolves.toEqual({
        status: "FORBIDDEN"
      });
      expect(
        await prisma.fileAsset.findUniqueOrThrow({
          where: {
            id: asset.id
          },
          select: {
            status: true
          }
        })
      ).toEqual({
        status: "PENDING"
      });
      expect(
        await prisma.club.findUniqueOrThrow({
          where: {
            id: fixture.club.id
          },
          select: {
            coverAssetId: true
          }
        })
      ).toEqual({
        coverAssetId: null
      });
    } finally {
      await cleanupFixture(fixture);
    }
  });

  it("serializes simultaneous covers and reconciles the unattached ready asset", async () => {
    const fixture = await createClubFixture("cover-race", ["owner"]);
    const owner = fixture.users[0];

    if (!owner) {
      throw new Error("Cover race owner was not created.");
    }

    try {
      const firstAsset = await createPendingCoverAsset(
        fixture,
        owner.id,
        "first"
      );
      const secondAsset = await createPendingCoverAsset(
        fixture,
        owner.id,
        "second"
      );
      const completedAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      const results = await Promise.all([
        uploadsRepository.markAssetReadyAndAttach(
          firstAsset,
          owner.id,
          completedAt,
          imageValidation
        ),
        uploadsRepository.markAssetReadyAndAttach(
          secondAsset,
          owner.id,
          completedAt,
          imageValidation
        )
      ]);

      expect(results.map((result) => result.status)).toEqual([
        "SUCCESS",
        "SUCCESS"
      ]);

      const club = await prisma.club.findUniqueOrThrow({
        where: {
          id: fixture.club.id
        },
        select: {
          coverAssetId: true
        }
      });
      const unattachedAssetId =
        club.coverAssetId === firstAsset.id ? secondAsset.id : firstAsset.id;

      await uploadsCleanupRepository.requestCleanupForStaleAssets(
        new Date(),
        10
      );

      expect(
        await prisma.fileAsset.findUniqueOrThrow({
          where: {
            id: unattachedAssetId
          },
          select: {
            status: true
          }
        })
      ).toEqual({
        status: "FAILED"
      });
      expect(
        await prisma.storageObjectDeletion.count({
          where: {
            objectKey:
              unattachedAssetId === firstAsset.id
                ? firstAsset.objectKey
                : secondAsset.objectKey,
            reason: "REPLACED_ASSET"
          }
        })
      ).toBe(1);
    } finally {
      await cleanupFixture(fixture);
    }
  });
});

const imageValidation = {
  widthPx: 64,
  heightPx: 64,
  isAnimated: false
};

const allowCommandToReachClubLock = () =>
  new Promise((resolve) => setTimeout(resolve, 100));

const createClubFixture = async (label: string, userLabels: string[]) => {
  const suffix = crypto.randomUUID();
  const users = await Promise.all(
    userLabels.map((userLabel) =>
      prisma.user.create({
        data: {
          email: `${label}-${userLabel}-${suffix}@example.com`,
          displayName: `${label}-${userLabel}-${suffix}`.slice(0, 80),
          username: `${label}_${userLabel}_${suffix}`.slice(0, 30),
          passwordHash: "$argon2id$v=19$integration-fixture"
        },
        select: {
          id: true
        }
      })
    )
  );
  const owner = users[0];

  if (!owner) {
    throw new Error("Club fixture owner was not created.");
  }

  const club = await prisma.club.create({
    data: {
      title: `${label} fixture`,
      linkName: `${label}-${suffix}`,
      category: "CUSTOM_TIMELINE",
      visibility: "PUBLIC",
      memberships: {
        create: {
          userId: owner.id,
          role: "OWNER"
        }
      }
    },
    select: {
      id: true,
      linkName: true
    }
  });

  return {
    club,
    suffix,
    users
  };
};

const createPendingCoverAsset = (
  fixture: Awaited<ReturnType<typeof createClubFixture>>,
  ownerId: string,
  label: string
) =>
  uploadsRepository.createPendingFileAsset({
    ownerId,
    clubId: fixture.club.id,
    purpose: "CLUB_COVER",
    objectKey: `public/club-covers/${fixture.club.id}/${label}-${fixture.suffix}.png`,
    contentType: "image/png",
    sizeBytes: 128
  });

const startHeldClubMutation = async (
  clubId: string,
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
    await lockClubAuthorizationChanges(transaction, clubId);
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

const cleanupFixture = async (
  fixture: Awaited<ReturnType<typeof createClubFixture>>
) => {
  await prisma.club.deleteMany({
    where: {
      id: fixture.club.id
    }
  });
  await prisma.user.deleteMany({
    where: {
      id: {
        in: fixture.users.map((user) => user.id)
      }
    }
  });
  await prisma.storageObjectDeletion.deleteMany({
    where: {
      objectKey: {
        contains: fixture.suffix
      }
    }
  });
};
