import { describe, expect, it } from "vitest";

import { createMemoryAuthSessionsRepository } from "./auth-session.repository.js";

describe("refresh token family rotation", () => {
  it("allows a short rejected retry window before revoking a reused family", async () => {
    const repository = createMemoryAuthSessionsRepository();
    const now = new Date("2026-07-28T12:00:00.000Z");
    const session = await repository.createSession({
      userId: crypto.randomUUID(),
      sessionIdHash: "1".repeat(64),
      refreshTokenHash: "2".repeat(64),
      sessionVersion: 1,
      expiresAt: new Date("2026-08-28T12:00:00.000Z")
    });
    const rotationInput = {
      currentRefreshTokenHash: session.refreshTokenHash,
      nextSessionIdHash: "3".repeat(64),
      nextRefreshTokenHash: "4".repeat(64),
      now,
      graceUntil: new Date(now.getTime() + 5_000),
      tombstoneExpiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000)
    };

    await expect(
      repository.rotateOrDetectRefreshReuse(rotationInput)
    ).resolves.toMatchObject({
      status: "ROTATED",
      session: {
        tokenFamilyId: session.tokenFamilyId,
        generation: 2
      }
    });
    await expect(
      repository.rotateOrDetectRefreshReuse({
        ...rotationInput,
        now: new Date(now.getTime() + 4_999)
      })
    ).resolves.toMatchObject({
      status: "GRACE_REUSE",
      familyId: session.tokenFamilyId
    });
    await expect(
      repository.rotateOrDetectRefreshReuse({
        ...rotationInput,
        now: new Date(now.getTime() + 5_001)
      })
    ).resolves.toMatchObject({
      status: "COMPROMISED",
      familyId: session.tokenFamilyId
    });
    await expect(
      repository.findActiveBySessionIdHash(
        rotationInput.nextSessionIdHash,
        new Date(now.getTime() + 5_002)
      )
    ).resolves.toBeNull();
  });
});
