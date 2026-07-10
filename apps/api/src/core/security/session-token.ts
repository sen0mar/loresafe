import { createHash, randomBytes, randomUUID } from "node:crypto";

import type { CookieOptions } from "express";
import { jwtVerify, SignJWT } from "jose";

import { env } from "../../config/env.js";

const currentSecretKey = new TextEncoder().encode(env.JWT_SECRET);
const previousSecretKey = env.JWT_PREVIOUS_SECRET
  ? new TextEncoder().encode(env.JWT_PREVIOUS_SECRET)
  : null;
const sessionCookieSameSite: CookieOptions["sameSite"] = "lax";

type CreateSessionTokenInput = {
  userId: string;
  sessionVersion: number;
  sessionId?: string;
};

export type VerifiedSessionToken = {
  userId: string;
  sessionVersion: number;
  sessionId: string;
};

export const refreshSessionCookieName = `${env.SESSION_COOKIE_NAME}_refresh`;

export const sessionCookieOptions = {
  httpOnly: true,
  secure: env.SESSION_COOKIE_SECURE,
  sameSite: sessionCookieSameSite,
  path: "/",
  maxAge: env.SESSION_ACCESS_TTL_SECONDS * 1000
} satisfies CookieOptions;

export const refreshSessionCookieOptions = {
  ...sessionCookieOptions,
  path: "/api/auth",
  maxAge: env.SESSION_TTL_SECONDS * 1000
} satisfies CookieOptions;

export const clearedSessionCookieOptions = {
  httpOnly: sessionCookieOptions.httpOnly,
  secure: sessionCookieOptions.secure,
  sameSite: sessionCookieOptions.sameSite,
  path: sessionCookieOptions.path
} satisfies CookieOptions;

export const clearedRefreshSessionCookieOptions = {
  httpOnly: refreshSessionCookieOptions.httpOnly,
  secure: refreshSessionCookieOptions.secure,
  sameSite: refreshSessionCookieOptions.sameSite,
  path: refreshSessionCookieOptions.path
} satisfies CookieOptions;

export const createSessionIdentifier = () => randomUUID();

export const createRefreshToken = () => randomBytes(32).toString("base64url");

export const hashSessionIdentifier = (identifier: string) =>
  createHash("sha256").update(identifier, "utf8").digest("hex");

export const createSessionToken = ({
  userId,
  sessionVersion,
  sessionId = createSessionIdentifier()
}: CreateSessionTokenInput) =>
  new SignJWT({ sessionVersion })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(env.JWT_ISSUER)
    .setAudience(env.JWT_AUDIENCE)
    .setJti(sessionId)
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(
      Math.floor(Date.now() / 1000) + env.SESSION_ACCESS_TTL_SECONDS
    )
    .sign(currentSecretKey);

export const verifySessionToken = async (
  token: string
): Promise<VerifiedSessionToken | null> =>
  verifySessionTokenWithKeys(token, [currentSecretKey, previousSecretKey]);

export const verifySessionTokenWithSecrets = (
  token: string,
  secrets: string[]
) =>
  verifySessionTokenWithKeys(
    token,
    secrets.map((secret) => new TextEncoder().encode(secret))
  );

const verifySessionTokenWithKeys = async (
  token: string,
  secretKeys: Array<Uint8Array | null>
): Promise<VerifiedSessionToken | null> => {
  for (const secretKey of secretKeys) {
    if (!secretKey) {
      continue;
    }

    try {
      const { payload } = await jwtVerify(token, secretKey, {
        algorithms: ["HS256"],
        issuer: env.JWT_ISSUER,
        audience: env.JWT_AUDIENCE
      });

      if (
        typeof payload.sub === "string" &&
        typeof payload.jti === "string" &&
        typeof payload.sessionVersion === "number"
      ) {
        return {
          userId: payload.sub,
          sessionVersion: payload.sessionVersion,
          sessionId: payload.jti
        };
      }
    } catch {
      // Try the previous key during a configured rotation window.
    }
  }

  return null;
};
