import { createHash, randomBytes } from "node:crypto";

// Email verification lives on pending signups; the VERIFY_EMAIL enum value
// remains in PostgreSQL only for migration history.
export type EmailIdentityTokenPurpose = "RESET_PASSWORD";

export const createEmailIdentityToken = () =>
  randomBytes(32).toString("base64url");

export const hashEmailIdentityToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");
