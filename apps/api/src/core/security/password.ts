import { Algorithm, hash, verify } from "@node-rs/argon2";

const passwordHashOptions = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1
} as const;

// Keep hash and verify on the same options so future tuning does not strand existing checks.
export const hashPassword = (password: string) =>
  hash(password, passwordHashOptions);

export const verifyPassword = (passwordHash: string, password: string) =>
  verify(passwordHash, password, passwordHashOptions);
