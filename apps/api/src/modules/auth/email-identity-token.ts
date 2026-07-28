import { createHash, randomBytes } from "node:crypto";

export type EmailIdentityTokenPurpose = "VERIFY_EMAIL" | "RESET_PASSWORD";

export const createEmailIdentityToken = () =>
  randomBytes(32).toString("base64url");

export const hashEmailIdentityToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");
