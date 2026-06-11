import { jwtVerify, SignJWT } from "jose";

import { env } from "../../config/env.js";

const secretKey = new TextEncoder().encode(env.JWT_SECRET);

type CreateSessionTokenInput = {
  userId: string;
  sessionVersion: number;
};

export type VerifiedSessionToken = {
  userId: string;
  sessionVersion: number;
};

// The cookie is the session transport; the JWT should never move through JS-readable storage.
export const sessionCookieOptions = {
  httpOnly: true,
  secure: env.SESSION_COOKIE_SECURE,
  sameSite: "lax" as const,
  path: "/",
  maxAge: env.SESSION_TTL_SECONDS * 1000
};

export const createSessionToken = ({
  userId,
  sessionVersion
}: CreateSessionTokenInput) =>
  // Keep authorization data out of the JWT; later routes must load roles/progress from PostgreSQL.
  new SignJWT({ sessionVersion })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + env.SESSION_TTL_SECONDS)
    .sign(secretKey);

export const verifySessionToken = async (
  token: string
): Promise<VerifiedSessionToken | null> => {
  try {
    const { payload } = await jwtVerify(token, secretKey, {
      algorithms: ["HS256"]
    });

    if (
      typeof payload.sub !== "string" ||
      typeof payload.sessionVersion !== "number"
    ) {
      return null;
    }

    return {
      userId: payload.sub,
      sessionVersion: payload.sessionVersion
    };
  } catch {
    // Invalid, expired, or malformed tokens all become "no session" for uniform auth handling.
    return null;
  }
};
