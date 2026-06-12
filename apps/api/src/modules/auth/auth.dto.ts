import type { AuthUserRecord } from "./auth.repository.js";

export type AuthUserDto = {
  id: string;
  email: string;
  displayName: string;
  username: string | null;
  bio: string | null;
  createdAt: string;
  updatedAt: string;
};

// Return only public account fields; password hashes and session internals stay server-side.
export const toAuthUserDto = (user: AuthUserRecord): AuthUserDto => ({
  id: user.id,
  email: user.email,
  displayName: user.displayName,
  username: user.username,
  bio: user.bio,
  createdAt: user.createdAt.toISOString(),
  updatedAt: user.updatedAt.toISOString()
});
