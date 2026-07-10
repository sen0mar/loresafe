import { SignJWT } from "jose";
import { describe, expect, it } from "vitest";

import { env } from "../../config/env.js";
import { verifySessionTokenWithSecrets } from "./session-token.js";

describe("session token verification", () => {
  it("accepts the previous key during rotation and rejects unrelated keys", async () => {
    const previousSecret = "p".repeat(32);
    const sessionId = crypto.randomUUID();
    const token = await new SignJWT({ sessionVersion: 4 })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setIssuer(env.JWT_ISSUER)
      .setAudience(env.JWT_AUDIENCE)
      .setJti(sessionId)
      .setSubject(crypto.randomUUID())
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(new TextEncoder().encode(previousSecret));

    await expect(
      verifySessionTokenWithSecrets(token, [env.JWT_SECRET, previousSecret])
    ).resolves.toMatchObject({ sessionId, sessionVersion: 4 });
    await expect(
      verifySessionTokenWithSecrets(token, ["x".repeat(32)])
    ).resolves.toBeNull();
  });

  it("requires issuer, audience, and a unique session identifier", async () => {
    const token = await new SignJWT({ sessionVersion: 1 })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setSubject(crypto.randomUUID())
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(new TextEncoder().encode(env.JWT_SECRET));

    await expect(
      verifySessionTokenWithSecrets(token, [env.JWT_SECRET])
    ).resolves.toBeNull();
  });
});
