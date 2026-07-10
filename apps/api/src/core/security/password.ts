import { Algorithm, hash, verify } from "@node-rs/argon2";

const passwordHashOptions = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1
} as const;

// This fixed hash uses the same Argon2id parameters as account hashes. It keeps
// unknown-account logins on the same expensive verification path without ever
// being usable as an account credential.
export const dummyPasswordHash =
  "$argon2id$v=19$m=19456,t=2,p=1$bG9yZXNhZmUtZHVtbXktMQ$VwTZ49WRiQFl88QyTmwrWPJwSp4RWx5oFGm4m4bXwew";

// Keep hash and verify on the same options so future tuning does not strand existing checks.
export const hashPassword = (password: string) =>
  hash(password, passwordHashOptions);

export const verifyPassword = (passwordHash: string, password: string) =>
  verify(passwordHash, password, passwordHashOptions);
