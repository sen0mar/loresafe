import { describe, expect, it, vi } from "vitest";

import { createUploadsCleanupService } from "./uploads-cleanup.service.js";

describe("opportunistic upload cleanup", () => {
  it("runs bounded reconciliation only from upload traffic and throttles it", async () => {
    let currentTime = new Date("2026-07-17T08:00:00.000Z");
    const repository = {
      requestCleanupForStaleAssets: vi.fn(async () => ["stale-deletion"])
    };
    const processDeletions = vi.fn(async () => undefined);
    const service = createUploadsCleanupService(repository, {
      now: () => currentTime,
      processDeletions,
      reconciliationInterval: 6 * 60 * 60 * 1000,
      reconciliationLimit: 7
    });

    service.runAfterUploadTraffic(["committed-deletion"]);
    await vi.waitFor(() => {
      expect(repository.requestCleanupForStaleAssets).toHaveBeenCalledTimes(1);
      expect(processDeletions).toHaveBeenCalledWith(["stale-deletion"]);
    });
    expect(repository.requestCleanupForStaleAssets).toHaveBeenCalledWith(
      currentTime,
      7
    );

    service.runAfterUploadTraffic();
    await Promise.resolve();
    expect(repository.requestCleanupForStaleAssets).toHaveBeenCalledTimes(1);

    currentTime = new Date("2026-07-17T14:00:00.000Z");
    service.runAfterUploadTraffic();
    await vi.waitFor(() => {
      expect(repository.requestCleanupForStaleAssets).toHaveBeenCalledTimes(2);
    });
  });
});
