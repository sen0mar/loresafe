import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "../../core/prisma/client.js";
import {
  startNotificationJobQueue,
  stopNotificationJobQueue
} from "../../jobs/notification-job-queue.js";
import { usersRepository } from "../users/users.repository.js";
import { uploadsRepository } from "./uploads.repository.js";

const describeDatabase =
  process.env.RUN_DATABASE_INTEGRATION_TESTS === "1" ? describe : describe.skip;

describeDatabase("upload deletion lifecycle", () => {
  beforeAll(async () => {
    await startNotificationJobQueue();
  });

  afterAll(async () => {
    await stopNotificationJobQueue();
  });

  it("retains replacement and account-deletion cleanup after asset metadata cascades", async () => {
    const suffix = crypto.randomUUID();
    const objectKeys = [
      `public/avatars/${suffix}/old.png`,
      `public/avatars/${suffix}/new.png`
    ];
    let userId: string | null = null;

    try {
      const user = await prisma.user.create({
        data: {
          email: `asset-lifecycle-${suffix}@example.com`,
          displayName: `asset-${suffix}`.slice(0, 80),
          username: `asset_${suffix}`.slice(0, 30),
          passwordHash: "$argon2id$v=19$integration-fixture"
        },
        select: {
          id: true
        }
      });
      userId = user.id;
      const firstAsset = await uploadsRepository.createPendingFileAsset({
        ownerId: user.id,
        clubId: null,
        purpose: "AVATAR",
        objectKey: objectKeys[0] ?? "",
        contentType: "image/png",
        sizeBytes: 128
      });

      await uploadsRepository.markAssetReadyAndAttach(firstAsset, new Date(), {
        widthPx: 64,
        heightPx: 64,
        isAnimated: false
      });

      const secondAsset = await uploadsRepository.createPendingFileAsset({
        ownerId: user.id,
        clubId: null,
        purpose: "AVATAR",
        objectKey: objectKeys[1] ?? "",
        contentType: "image/png",
        sizeBytes: 128
      });

      await uploadsRepository.markAssetReadyAndAttach(secondAsset, new Date(), {
        widthPx: 64,
        heightPx: 64,
        isAnimated: false
      });

      expect(
        await prisma.storageObjectDeletion.findUnique({
          where: {
            objectKey: firstAsset.objectKey
          },
          select: {
            reason: true,
            status: true
          }
        })
      ).toEqual({
        reason: "REPLACED_ASSET",
        status: "PENDING"
      });

      await expect(
        usersRepository.deleteCurrentUserAccount(user.id, 1)
      ).resolves.toBe("DELETED");

      expect(
        await prisma.fileAsset.count({
          where: {
            ownerId: user.id
          }
        })
      ).toBe(0);
      const deletionRows = await prisma.storageObjectDeletion.findMany({
          where: {
            objectKey: {
              in: objectKeys
            }
          },
          orderBy: {
            objectKey: "asc"
          },
          select: {
            objectKey: true,
            reason: true,
            status: true
          }
        });

      expect(
        deletionRows.map(({ objectKey, reason }) => ({ objectKey, reason }))
      ).toEqual([
        {
          objectKey: objectKeys[1],
          reason: "ACCOUNT_DELETION"
        },
        {
          objectKey: objectKeys[0],
          reason: "REPLACED_ASSET"
        }
      ].sort((first, second) => first.objectKey.localeCompare(second.objectKey)));
      expect(
        deletionRows.every(
          (deletion) =>
            deletion.status === "PENDING" || deletion.status === "COMPLETED"
        )
      ).toBe(true);
    } finally {
      if (userId) {
        await prisma.user.deleteMany({
          where: {
            id: userId
          }
        });
      }
      await prisma.storageObjectDeletion.deleteMany({
        where: {
          objectKey: {
            in: objectKeys
          }
        }
      });
    }
  }, 20_000);
});
