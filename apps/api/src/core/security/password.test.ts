import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "./password.js";

describe("password helpers", () => {
  it("stores passwords as Argon2id hashes and verifies matching passwords", async () => {
    const passwordHash = await hashPassword("correct horse battery staple");

    expect(passwordHash).toMatch(/^\$argon2id\$/);
    await expect(
      verifyPassword(passwordHash, "correct horse battery staple")
    ).resolves.toBe(true);
  });

  it("rejects non-matching passwords", async () => {
    const passwordHash = await hashPassword("correct horse battery staple");

    await expect(verifyPassword(passwordHash, "wrong password")).resolves.toBe(
      false
    );
  });
});
