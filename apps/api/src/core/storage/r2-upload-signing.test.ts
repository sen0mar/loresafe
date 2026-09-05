import { describe, expect, it, vi } from "vitest";

vi.mock("../../config/env.js", () => ({
  env: {
    R2_ACCOUNT_ID: "local-signing-test",
    R2_ACCESS_KEY_ID: "local-test-key",
    R2_SECRET_ACCESS_KEY: "local-test-secret",
    R2_BUCKET_NAME: "test-bucket",
    R2_PRESIGNED_URL_TTL_SECONDS: 300,
    R2_CONNECTION_TIMEOUT_MS: 1000,
    R2_REQUEST_TIMEOUT_MS: 1000
  }
}));

import { r2Storage } from "./r2-storage.js";

describe("R2 upload signing deadline", () => {
  it("signs the staging key without exceeding the persisted expiration", async () => {
    const expiresAt = new Date(Date.now() + 60_000);
    const upload = await r2Storage.createPresignedUpload({
      objectKey: "staging/uploads/public/avatars/test/final/image.png",
      contentLength: 128,
      contentType: "image/png",
      expiresAt
    });
    const url = new URL(upload.uploadUrl);
    expect(url.pathname).toContain("/staging/uploads/");
    const signedAt = url.searchParams.get("X-Amz-Date")!;
    const timestamp = Date.UTC(
      Number(signedAt.slice(0, 4)),
      Number(signedAt.slice(4, 6)) - 1,
      Number(signedAt.slice(6, 8)),
      Number(signedAt.slice(9, 11)),
      Number(signedAt.slice(11, 13)),
      Number(signedAt.slice(13, 15))
    );
    const ttlSeconds = Number(url.searchParams.get("X-Amz-Expires"));
    expect(ttlSeconds).toBeGreaterThan(0);
    expect(timestamp + ttlSeconds * 1000).toBeLessThanOrEqual(
      expiresAt.getTime()
    );
    expect(upload.expiresAt).toEqual(expiresAt);
  });

  it("does not sign an expired intent", async () => {
    await expect(
      r2Storage.createPresignedUpload({
        objectKey: "staging/uploads/expired",
        contentLength: 128,
        contentType: "image/png",
        expiresAt: new Date(Date.now() - 1)
      })
    ).rejects.toThrow("Upload intent expired before signing.");
  });
});
