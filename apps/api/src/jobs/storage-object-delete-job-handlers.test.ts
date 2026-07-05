import type { Job } from "pg-boss";
import { describe, expect, it, vi } from "vitest";

import type { ObjectStorage } from "../core/storage/r2-storage.js";
import {
  processStorageObjectDeleteJob,
  runLoggedStorageObjectDeleteJob
} from "./storage-object-delete-job-handlers.js";

describe("storage object delete job handlers", () => {
  it("deletes all queued object keys", async () => {
    const storage = createStorageMock();

    await processStorageObjectDeleteJob(
      {
        objectKeys: ["public/avatars/user/avatar.webp", "private/posts/image.webp"]
      },
      storage
    );

    expect(storage.deletedObjectKeys).toEqual([
      "public/avatars/user/avatar.webp",
      "private/posts/image.webp"
    ]);
  });

  it("treats missing objects as a successful storage delete", async () => {
    const storage = createStorageMock();

    await expect(
      processStorageObjectDeleteJob(
        {
          objectKeys: ["public/avatars/missing.webp"]
        },
        storage
      )
    ).resolves.toBeUndefined();

    expect(storage.deletedObjectKeys).toEqual(["public/avatars/missing.webp"]);
  });

  it("logs sanitized metadata and rethrows failed jobs", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const job = {
      id: crypto.randomUUID(),
      name: "storage.object-delete",
      data: {
        objectKeys: ["private/post-images/secret-image.webp"]
      }
    } as Job<{ objectKeys: string[] }>;

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
    deleteObjects: async (objectKeys) => {
      storage.deletedObjectKeys.push(...objectKeys);
    },
    getObjectMetadata: async () => null,
    getPublicUrl: (objectKey) => `https://example.test/${objectKey}`
  };

  return storage;
};
