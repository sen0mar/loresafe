import { describe, expect, it } from "vitest";
import { prisma } from "../../core/prisma/client.js";
import type { ObjectStorage } from "../../core/storage/r2-storage.js";
import { getUploadStagingKey } from "../../core/storage/upload-object-keys.js";
import {
  listPendingStorageDeletions,
  markStorageDeletionsCompleted,
  recordStorageDeletionFailure
} from "../../core/storage/storage-deletion.repository.js";
import { processStorageDeletionIds } from "../../core/storage/storage-deletion.service.js";
import { usersRepository } from "../users/users.repository.js";
import { uploadsRepository } from "./uploads.repository.js";
import { uploadsCleanupRepository } from "./uploads-cleanup.repository.js";

const describeDatabase =
  process.env.RUN_DATABASE_INTEGRATION_TESTS === "1" ? describe : describe.skip;

describeDatabase("staging cleanup after signed PUT expiry", () => {
  it.each(["READY", "FAILED", "ACCOUNT_DELETION"] as const)(
    "keeps %s staging cleanup pending through replay until expiry",
    async (outcome) => {
      const suffix = crypto.randomUUID();
      const owner = await prisma.user.create({
        data: {
          email: `expiry-${suffix}@example.com`,
          displayName: suffix,
          username: suffix.slice(0, 30),
          passwordHash: "integration-fixture"
        }
      });
      const finalKey = `public/avatars/${owner.id}/final/${suffix}.png`;
      const stageKey = getUploadStagingKey(finalKey);
      const uploadExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
      let now = new Date();
      const objects = new Map([
        [stageKey, "original"],
        [finalKey, "sanitized"]
      ]);
      const storage = {
        deleteObjects: async (keys: string[]) => {
          for (const key of keys) objects.delete(key);
        }
      } as ObjectStorage;
      const deletionRepository = {
        listPending: (ids: string[]) => listPendingStorageDeletions(ids, now),
        markCompleted: markStorageDeletionsCompleted,
        recordFailure: recordStorageDeletionFailure
      };
      try {
        const asset = await uploadsRepository.createPendingFileAsset({
          ownerId: owner.id,
          clubId: null,
          purpose: "AVATAR",
          objectKey: finalKey,
          contentType: "image/png",
          sizeBytes: 128,
          uploadExpiresAt
        });
        if (outcome === "READY") {
          await uploadsRepository.markAssetReadyAndAttach(
            asset,
            owner.id,
            now,
            { widthPx: 32, heightPx: 32, isAnimated: false },
            async () => undefined
          );
        } else if (outcome === "FAILED") {
          await uploadsRepository.markAssetFailedAndRequestDeletion(asset.id);
        } else {
          await usersRepository.deleteCurrentUserAccount(owner.id, 1);
        }
        const ledger = await prisma.storageObjectDeletion.findMany({
          where: { objectKey: { in: [finalKey, stageKey] } }
        });
        const ids = ledger.map((row) => row.id);
        expect(
          ledger.find((row) => row.objectKey === stageKey)?.notBefore
        ).toEqual(uploadExpiresAt);
        now = new Date(uploadExpiresAt.getTime() - 1);
        await processStorageDeletionIds(ids, storage, deletionRepository);
        expect(objects.has(stageKey)).toBe(true);
        expect(
          await prisma.storageObjectDeletion.findUnique({
            where: { objectKey: stageKey }
          })
        ).toMatchObject({ status: "PENDING" });
        // A still-valid PUT can replace or recreate staging, never the final key.
        objects.set(stageKey, "replayed raw bytes");
        now = new Date(uploadExpiresAt.getTime() + 6 * 60 * 1000);
        const dueIds =
          await uploadsCleanupRepository.requestCleanupForStaleAssets(now, 100);
        expect(dueIds).toContain(
          ledger.find((row) => row.objectKey === stageKey)?.id
        );
        await processStorageDeletionIds(dueIds, storage, deletionRepository);
        expect(objects.has(stageKey)).toBe(false);
        expect(
          await prisma.storageObjectDeletion.findUnique({
            where: { objectKey: stageKey }
          })
        ).toMatchObject({ status: "COMPLETED" });
        expect(objects.get(finalKey)).toBe(
          outcome === "READY" ? "sanitized" : undefined
        );
      } finally {
        await prisma.user.deleteMany({ where: { id: owner.id } });
        await prisma.storageObjectDeletion.deleteMany({
          where: { objectKey: { in: [finalKey, stageKey] } }
        });
      }
    }
  );
});
