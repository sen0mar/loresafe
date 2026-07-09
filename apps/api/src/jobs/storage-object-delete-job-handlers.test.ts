import type { Job } from "pg-boss";
import { describe, expect, it, vi } from "vitest";

import type { ObjectStorage } from "../core/storage/r2-storage.js";
import {
  processStorageObjectDeleteJob,
  runLoggedStorageObjectDeleteJob,
  type StorageDeletionRepository
} from "./storage-object-delete-job-handlers.js";

describe("storage object delete job handlers", () => {
  it("deletes all queued object keys", async () => {
    const storage = createStorageMock();
    const repository = createDeletionRepository([
      ["11111111-1111-4111-8111-111111111111", "public/avatars/user/avatar.webp"],
      ["22222222-2222-4222-8222-222222222222", "private/posts/image.webp"]
    ]);

    await processStorageObjectDeleteJob(
      {
        deletionIds: [
          "11111111-1111-4111-8111-111111111111",
          "22222222-2222-4222-8222-222222222222"
        ]
      },
      storage,
      repository
    );

    expect(storage.deletedObjectKeys).toEqual([
      "public/avatars/user/avatar.webp",
      "private/posts/image.webp"
    ]);
    expect(repository.markCompleted).toHaveBeenCalledWith([
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222"
    ]);
  });

  it("treats missing objects as a successful storage delete", async () => {
    const storage = createStorageMock();
    const repository = createDeletionRepository([
      ["33333333-3333-4333-8333-333333333333", "public/avatars/missing.webp"]
    ]);

    await expect(
      processStorageObjectDeleteJob(
        {
          deletionIds: ["33333333-3333-4333-8333-333333333333"]
        },
        storage,
        repository
      )
    ).resolves.toBeUndefined();

    expect(storage.deletedObjectKeys).toEqual(["public/avatars/missing.webp"]);
  });

  it("keeps failed deletion intents pending for reconciliation", async () => {
    const storage = createStorageMock();
    const deletionId = "55555555-5555-4555-8555-555555555555";
    const repository = createDeletionRepository([
      [deletionId, "private/post-images/retry.webp"]
    ]);
    storage.deleteObjects = async () => {
      throw new Error("R2 unavailable");
    };

    await expect(
      processStorageObjectDeleteJob(
        {
          deletionIds: [deletionId]
        },
        storage,
        repository
      )
    ).rejects.toThrow("R2 unavailable");

    expect(repository.recordFailure).toHaveBeenCalledWith(
      [deletionId],
      expect.any(Error)
    );
    expect(repository.markCompleted).not.toHaveBeenCalled();
  });

  it("logs sanitized metadata and rethrows failed jobs", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const job = {
      id: crypto.randomUUID(),
      name: "storage.object-delete",
      data: {
        deletionIds: ["44444444-4444-4444-8444-444444444444"]
      }
    } as Job<{ deletionIds: string[] }>;

    await expect(
      runLoggedStorageObjectDeleteJob("storage.object-delete", job, async () => {
        throw new Error("r2 unavailable");
      })
    ).rejects.toThrow("r2 unavailable");

    const logPayload = String(consoleErrorSpy.mock.calls[0]?.[0]);

    expect(consoleErrorSpy).toHaveBeenCalledOnce();
    expect(logPayload).not.toContain("secret-image.webp");
    expect(JSON.parse(logPayload)).toMatchObject({
      level: "error",
      message: "Storage cleanup job failed",
      jobName: "storage.object-delete",
      jobId: job.id,
      objectCount: 1,
      error: {
        name: "Error",
        message: "r2 unavailable"
      }
    });
  });
});

const createStorageMock = () => {
  const storage: ObjectStorage & { deletedObjectKeys: string[] } = {
    deletedObjectKeys: [],
    createPresignedRead: async () => ({
      readUrl: "https://example.test/read",
      expiresAt: new Date()
    }),
    createPresignedUpload: async () => ({
      uploadUrl: "https://example.test/upload",
      method: "PUT",
      requiredHeaders: {},
      expiresAt: new Date()
    }),
    getObjectBytes: async () => new Uint8Array(),
    deleteObjects: async (objectKeys) => {
      storage.deletedObjectKeys.push(...objectKeys);
    },
    getObjectMetadata: async () => null,
    getPublicUrl: (objectKey) => `https://example.test/${objectKey}`
  };

  return storage;
};

const createDeletionRepository = (
  entries: Array<[id: string, objectKey: string]>
): StorageDeletionRepository => ({
  listPending: vi.fn(async (deletionIds: string[]) =>
    entries
      .filter(([id]) => deletionIds.includes(id))
      .map(([id, objectKey]) => ({ id, objectKey }))
  ),
  markCompleted: vi.fn(async () => undefined),
  recordFailure: vi.fn(async () => undefined)
});
