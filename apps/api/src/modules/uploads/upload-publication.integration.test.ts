import { describe, expect, it, vi } from "vitest";
import { prisma } from "../../core/prisma/client.js";
import { getUploadStagingKey } from "../../core/storage/upload-object-keys.js";
import { usersRepository } from "../users/users.repository.js";
import { uploadsCleanupRepository } from "./uploads-cleanup.repository.js";
import { uploadsRepository } from "./uploads.repository.js";
const describeDatabase =
  process.env.RUN_DATABASE_INTEGRATION_TESTS === "1" ? describe : describe.skip;

describeDatabase("upload publication boundary", () => {
  it("retains both keys after publication succeeds but the transaction rolls back", async () => {
    const suffix = crypto.randomUUID();
    const owner = await prisma.user.create({
      data: {
        email: `rollback-${suffix}@example.com`,
        displayName: suffix,
        username: suffix.slice(0, 30),
        passwordHash: "integration-fixture"
      }
    });
    const finalKey = `public/avatars/${owner.id}/final/${suffix}.png`;
    const stageKey = getUploadStagingKey(finalKey);
    const published = new Map<string, Uint8Array>();
    try {
      const asset = await uploadsRepository.createPendingFileAsset({
        ownerId: owner.id,
        clubId: null,
        purpose: "AVATAR",
        objectKey: finalKey,
        contentType: "image/png",
        sizeBytes: 128
      });
      const publish = vi.fn(async () => {
        published.set(finalKey, new Uint8Array([1, 2, 3]));
      });
      // Invalid database metadata fails after the successful storage write.
      await expect(
        uploadsRepository.markAssetReadyAndAttach(
          asset,
          owner.id,
          new Date(),
          { widthPx: 2 ** 40, heightPx: 32, isAnimated: false },
          publish
        )
      ).rejects.toThrow();
      expect(publish).toHaveBeenCalledTimes(1);
      expect(published.has(finalKey)).toBe(true);
      expect(await uploadsRepository.findAssetById(asset.id)).toMatchObject({
        status: "PENDING",
        objectKey: finalKey
      });
      expect(
        (await prisma.user.findUniqueOrThrow({ where: { id: owner.id } }))
          .avatarAssetId
      ).toBeNull();
      await uploadsCleanupRepository.requestCleanupForStaleAssets(
        new Date(Date.now() + 30 * 60 * 1000),
        100
      );
      const deletions = await prisma.storageObjectDeletion.findMany({
        where: { objectKey: { in: [finalKey, stageKey] } }
      });
      expect(deletions.map((row) => row.objectKey).sort()).toEqual(
        [finalKey, stageKey].sort()
      );
      expect(deletions.every((row) => row.status === "PENDING")).toBe(true);
      await uploadsRepository.markAssetReadyAndAttach(
        asset,
        owner.id,
        new Date(),
        { widthPx: 32, heightPx: 32, isAnimated: false },
        publish
      );
      expect(publish).toHaveBeenCalledTimes(1);
    } finally {
      await prisma.user.deleteMany({ where: { id: owner.id } });
      await prisma.storageObjectDeletion.deleteMany({
        where: { objectKey: { in: [finalKey, stageKey] } }
      });
    }
  });

  it("publishes once across concurrent completion and never queues the committed final key", async () => {
    const suffix = crypto.randomUUID();
    const owner = await prisma.user.create({
      data: {
        email: `publish-once-${suffix}@example.com`,
        displayName: suffix,
        username: suffix.slice(0, 30),
        passwordHash: "integration-fixture"
      }
    });
    const finalKey = `public/avatars/${owner.id}/final/${suffix}.png`;
    const stageKey = getUploadStagingKey(finalKey);
    try {
      const asset = await uploadsRepository.createPendingFileAsset({
        ownerId: owner.id,
        clubId: null,
        purpose: "AVATAR",
        objectKey: finalKey,
        contentType: "image/png",
        sizeBytes: 128
      });
      const publish = vi.fn(async () => undefined);
      const complete = () =>
        uploadsRepository.markAssetReadyAndAttach(
          asset,
          owner.id,
          new Date(),
          { widthPx: 32, heightPx: 32, isAnimated: false },
          publish
        );
      const results = await Promise.all([complete(), complete()]);
      await complete();
      expect(
        results.every(
          (result) =>
            result.status === "SUCCESS" && result.asset.status === "READY"
        )
      ).toBe(true);
      expect(publish).toHaveBeenCalledTimes(1);
      await uploadsCleanupRepository.requestCleanupForStaleAssets(
        new Date(Date.now() + 30 * 60 * 1000),
        100
      );
      expect(
        await prisma.storageObjectDeletion.findUnique({
          where: { objectKey: finalKey }
        })
      ).toBeNull();
      expect(
        await prisma.storageObjectDeletion.findUnique({
          where: { objectKey: stageKey }
        })
      ).toMatchObject({ status: "PENDING" });
      await usersRepository.deleteCurrentUserAccount(owner.id, 1);
      expect(
        await prisma.storageObjectDeletion.findUnique({
          where: { objectKey: finalKey }
        })
      ).toMatchObject({ reason: "ACCOUNT_DELETION" });
    } finally {
      await prisma.user.deleteMany({ where: { id: owner.id } });
      await prisma.storageObjectDeletion.deleteMany({
        where: { objectKey: { in: [finalKey, stageKey] } }
      });
    }
  });

  it("does not delete a completed final key using a stale pending cleanup snapshot", async () => {
    const suffix = crypto.randomUUID();
    const owner = await prisma.user.create({
      data: {
        email: `cleanup-race-${suffix}@example.com`,
        displayName: suffix,
        username: suffix.slice(0, 30),
        passwordHash: "integration-fixture"
      }
    });
    const finalKey = `public/avatars/${owner.id}/final/${suffix}.png`;
    const stageKey = getUploadStagingKey(finalKey);
    let release: () => void = () => undefined;
    const hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    let entered: () => void = () => undefined;
    const publishing = new Promise<void>((resolve) => {
      entered = resolve;
    });
    let completion: Promise<unknown> | undefined;
    let cleanup: Promise<unknown> | undefined;
    try {
      const asset = await uploadsRepository.createPendingFileAsset({
        ownerId: owner.id,
        clubId: null,
        purpose: "AVATAR",
        objectKey: finalKey,
        contentType: "image/png",
        sizeBytes: 128
      });
      completion = uploadsRepository.markAssetReadyAndAttach(
        asset,
        owner.id,
        new Date(),
        { widthPx: 32, heightPx: 32, isAnimated: false },
        async () => {
          entered();
          await hold;
        }
      );
      await publishing;
      cleanup = uploadsCleanupRepository.requestCleanupForStaleAssets(
        new Date(Date.now() + 30 * 60 * 1000),
        100
      );
      await vi.waitFor(async () => {
        const waiting = await prisma.$queryRaw<Array<{ count: bigint }>>`
          SELECT count(*) FROM pg_stat_activity WHERE wait_event_type = 'Lock'
          AND query LIKE '%file_assets%' AND pid <> pg_backend_pid()
        `;
        expect(Number(waiting[0]?.count)).toBeGreaterThan(0);
      });
      release();
      await Promise.all([completion, cleanup]);
      expect(await uploadsRepository.findAssetById(asset.id)).toMatchObject({
        status: "READY"
      });
      expect(
        await prisma.storageObjectDeletion.findUnique({
          where: { objectKey: finalKey }
        })
      ).toBeNull();
    } finally {
      release();
      await Promise.allSettled([completion, cleanup]);
      await prisma.user.deleteMany({ where: { id: owner.id } });
      await prisma.storageObjectDeletion.deleteMany({
        where: { objectKey: { in: [finalKey, stageKey] } }
      });
    }
  });
});
