import type { AuthUserDto } from "./auth.dto.js";

declare global {
  namespace Express {
    interface Request {
      currentUser?: AuthUserDto | null;
    }
  }
}

export {};
