import { describe, expect, it, vi } from "vitest";

import { prisma } from "../../core/prisma/client.js";
import { postsRepository } from "../posts/posts.repository.js";
import { uploadsCleanupRepository } from "./uploads-cleanup.repository.js";
import { uploadsRepository } from "./uploads.repository.js";

const describeDatabase =
  process.env.RUN_DATABASE_INTEGRATION_TESTS === "1" ? describe : describe.skip;

const staleReadyAt = new Date("2000-01-01T00:00:00.000Z");

describeDatabase("post image attach and cleanup", () => {
  it("keeps an image that a post attaches while cleanup holds a stale snapshot", async () => {
    const fixture = await createPostImageFixture("attach-wins");
    const holder = startHeldTransaction();

    try {
      const asset = await createStaleReadyPostImage(fixture);
      const post = await createPostWithoutImage(fixture);

      // Attach in an open transaction so cleanup sees the asset as unattached.
      await holder.run(async (transaction) => {
        await transaction.fileAsset.update({
          where: { id: asset.id },
          data: { postId: post.id }
        });
      });

      const cleanup = uploadsCleanupRepository.requestCleanupForStaleAssets(
        new Date(),
        100
      );
      await waitForFileAssetLockWaiter();
      holder.release();
      await holder.completion;
      await cleanup;

      expect(
        await prisma.fileAsset.findUniqueOrThrow({
          where: { id: asset.id },
          select: { status: true, postId: true }
        })
      ).toEqual({ status: "READY", postId: post.id });
      expect(
        await prisma.storageObjectDeletion.findUnique({
          where: { objectKey: asset.objectKey }
        })
      ).toBeNull();
    } finally {
      holder.release();
      await holder.completion.catch(() => undefined);
      await deleteFixture(fixture);
    }
  });

  it("does not attach an image that cleanup claimed first", async () => {
    const fixture = await createPostImageFixture("cleanup-wins");
    const holder = startHeldTransaction();

    try {
      const asset = await createStaleReadyPostImage(fixture);

      await holder.run(async (transaction) => {
        await transaction.fileAsset.update({
          where: { id: asset.id },
          data: { status: "FAILED" }
        });
      });

      const attach = postsRepository.createClubPost(
        fixture.clubId,
        fixture.memberId,
        {
          type: "DISCUSSION",
          title: "Late attach",
          body: "Attaching a claimed image",
          requiredMilestoneId: fixture.milestoneId,
          mediaAssetId: asset.id
        }
      );
      await waitForFileAssetLockWaiter();
      holder.release();
      await holder.completion;

      await expect(attach).resolves.toBeNull();
      expect(
        await prisma.fileAsset.findUniqueOrThrow({
          where: { id: asset.id },
          select: { postId: true }
        })
      ).toEqual({ postId: null });
    } finally {
      holder.release();
      await holder.completion.catch(() => undefined);
      await deleteFixture(fixture);
    }
  });

  it.each([
    ["owned by another user", "otherOwner"],
    ["from another club", "otherClub"],
    ["already attached", "attached"],
    ["still pending", "PENDING"],
    ["failed", "FAILED"]
  ] as const)(
    "does not create a post with an image %s",
    async (_label, variant) => {
      const fixture = await createPostImageFixture(`attach-${variant}`);
      const otherFixture = await createPostImageFixture(`other-${variant}`);

      try {
        const asset = await prisma.fileAsset.create({
          data: {
            ownerId:
              variant === "otherOwner"
                ? otherFixture.memberId
                : fixture.memberId,
            clubId:
              variant === "otherClub" ? otherFixture.clubId : fixture.clubId,
            postId:
              variant === "attached"
                ? (await createPostWithoutImage(fixture)).id
                : null,
            purpose: "POST_IMAGE",
            visibility: "PRIVATE",
            objectKey: `private/post-images/${fixture.clubId}/final/${crypto.randomUUID()}.png`,
            contentType: "image/png",
            sizeBytes: 128,
            status:
              variant === "PENDING" || variant === "FAILED" ? variant : "READY",
            readyAt:
              variant === "PENDING" || variant === "FAILED" ? null : new Date()
          },
          select: { id: true, postId: true }
        });
        const postCountBefore = await prisma.post.count({
          where: { clubId: fixture.clubId }
        });

        await expect(
          postsRepository.createClubPost(fixture.clubId, fixture.memberId, {
            type: "DISCUSSION",
            title: "Borrowed image",
            body: "Trying to attach an ineligible image",
            requiredMilestoneId: fixture.milestoneId,
            mediaAssetId: asset.id
          })
        ).resolves.toBeNull();
        expect(
          await prisma.post.count({ where: { clubId: fixture.clubId } })
        ).toBe(postCountBefore);
        expect(
          await prisma.fileAsset.findUniqueOrThrow({
            where: { id: asset.id },
            select: { postId: true }
          })
        ).toEqual({ postId: asset.postId });
      } finally {
        await deleteFixture(fixture);
        await deleteFixture(otherFixture);
      }
    }
  );

  it("rejects post image completion after the uploader is banned", async () => {
    const fixture = await createPostImageFixture("banned-complete");

    try {
      const asset = await uploadsRepository.createPendingFileAsset({
        ownerId: fixture.memberId,
        clubId: fixture.clubId,
        purpose: "POST_IMAGE",
        visibility: "PRIVATE",
        objectKey: `private/post-images/${fixture.clubId}/final/${fixture.suffix}.png`,
        contentType: "image/png",
        sizeBytes: 128
      });
      await prisma.clubMembership.delete({
        where: {
          userId_clubId: { userId: fixture.memberId, clubId: fixture.clubId }
        }
      });
      await prisma.clubBan.create({
        data: {
          clubId: fixture.clubId,
          userId: fixture.memberId,
          roleAtBan: "MEMBER",
          reason: "Integration fixture"
        }
      });
      const publish = vi.fn(async () => undefined);

      await expect(
        uploadsRepository.markAssetReadyAndAttach(
          asset,
          fixture.memberId,
          new Date(),
          { widthPx: 32, heightPx: 32, isAnimated: false },
          publish
        )
      ).resolves.toEqual({ status: "BANNED" });
      expect(publish).not.toHaveBeenCalled();
      expect(await uploadsRepository.findAssetById(asset.id)).toMatchObject({
        status: "PENDING"
      });
    } finally {
      await deleteFixture(fixture);
    }
  });
});

type PostImageFixture = Awaited<ReturnType<typeof createPostImageFixture>>;

const createPostImageFixture = async (label: string) => {
  const suffix = crypto.randomUUID();
  const member = await prisma.user.create({
    data: {
      email: `${label}-${suffix}@example.com`,
      displayName: `${label}-${suffix}`.slice(0, 80),
      username: `${label}_${suffix}`.replaceAll("-", "_").slice(0, 30),
      passwordHash: "$argon2id$v=19$integration-fixture"
    },
    select: { id: true }
  });
  const club = await prisma.club.create({
    data: {
      title: `${label} fixture`,
      linkName: `${label}-${suffix}`,
      category: "CUSTOM_TIMELINE",
      visibility: "PUBLIC",
      memberships: { create: { userId: member.id, role: "OWNER" } }
    },
    select: { id: true }
  });
  const milestone = await prisma.milestone.create({
    data: { clubId: club.id, position: 1, safeTitle: "Start" },
    select: { id: true }
  });

  return {
    clubId: club.id,
    memberId: member.id,
    milestoneId: milestone.id,
    suffix
  };
};

const createStaleReadyPostImage = (fixture: PostImageFixture) =>
  prisma.fileAsset.create({
    data: {
      ownerId: fixture.memberId,
      clubId: fixture.clubId,
      purpose: "POST_IMAGE",
      visibility: "PRIVATE",
      objectKey: `private/post-images/${fixture.clubId}/final/${crypto.randomUUID()}.png`,
      contentType: "image/png",
      sizeBytes: 128,
      status: "READY",
      readyAt: staleReadyAt,
      createdAt: staleReadyAt
    },
    select: { id: true, objectKey: true }
  });

const createPostWithoutImage = (fixture: PostImageFixture) =>
  prisma.post.create({
    data: {
      clubId: fixture.clubId,
      authorId: fixture.memberId,
      type: "DISCUSSION",
      title: "Attach target",
      body: "Body",
      requiredMilestoneId: fixture.milestoneId,
      status: "VISIBLE"
    },
    select: { id: true }
  });

const deleteFixture = async (fixture: PostImageFixture) => {
  const assets = await prisma.fileAsset.findMany({
    where: { clubId: fixture.clubId },
    select: { objectKey: true }
  });

  await prisma.club.deleteMany({ where: { id: fixture.clubId } });
  await prisma.user.deleteMany({ where: { id: fixture.memberId } });
  await prisma.storageObjectDeletion.deleteMany({
    where: { objectKey: { in: assets.map((asset) => asset.objectKey) } }
  });
};

// Runs writes in a transaction that stays open, holding its row locks, until
// release() is called.
const startHeldTransaction = () => {
  let release: () => void = () => undefined;
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  let applied: () => void = () => undefined;
  const appliedSignal = new Promise<void>((resolve) => {
    applied = resolve;
  });
  let completion: Promise<void> = Promise.resolve();

  return {
    get completion() {
      return completion;
    },
    release: () => release(),
    run: async (
      write: (
        transaction: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]
      ) => Promise<void>
    ) => {
      completion = prisma.$transaction(
        async (transaction) => {
          await write(transaction);
          applied();
          await released;
        },
        { timeout: 15_000 }
      );
      await appliedSignal;
    }
  };
};

const waitForFileAssetLockWaiter = () =>
  vi.waitFor(
    async () => {
      const waiting = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT count(*) FROM pg_stat_activity WHERE wait_event_type = 'Lock'
        AND query LIKE '%file_assets%' AND pid <> pg_backend_pid()
      `;

      expect(Number(waiting[0]?.count ?? 0)).toBeGreaterThan(0);
    },
    { timeout: 5_000 }
  );
