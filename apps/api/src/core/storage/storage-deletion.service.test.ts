import { describe, expect, it, vi } from "vitest";

import type { ObjectStorage } from "./r2-storage.js";
import {
  processStorageDeletionIds,
  type StorageDeletionRepository
} from "./storage-deletion.service.js";

describe("request-driven storage deletion", () => {
  it("leaves failures pending and retries them during a later request", async () => {
    const deletionId = "11111111-1111-4111-8111-111111111111";
    let pending = true;
    let shouldFail = true;
    const repository: StorageDeletionRepository = {
      listPending: vi.fn(async () =>
        pending ? [{ id: deletionId, objectKey: "private/pending.png" }] : []
      ),
      markCompleted: vi.fn(async () => {
        pending = false;
      }),
      recordFailure: vi.fn(async () => undefined)
    };
    const storage = {
      deleteObjects: vi.fn(async () => {
        if (shouldFail) {
          throw new Error("temporary R2 failure");
        }
      })
    } as unknown as ObjectStorage;

    await expect(
      processStorageDeletionIds([deletionId], storage, repository)
    ).resolves.toBeUndefined();
    expect(repository.recordFailure).toHaveBeenCalledWith(
      [deletionId],
      expect.any(Error)
    );
    expect(pending).toBe(true);

    shouldFail = false;
    await processStorageDeletionIds([deletionId], storage, repository);

    expect(storage.deleteObjects).toHaveBeenCalledTimes(2);
    expect(repository.markCompleted).toHaveBeenCalledWith([deletionId]);
    expect(pending).toBe(false);
  });
});
