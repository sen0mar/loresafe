import { HttpError } from "../../core/errors/http-error.js";

export const bannedFromClubMessage = "You are banned from this club.";

export const bannedFromClubError = () =>
  new HttpError(403, "BANNED", bannedFromClubMessage);

export const activeBanWhere = (now: Date) => ({
  revokedAt: null,
  OR: [
    {
      expiresAt: null
    },
    {
      expiresAt: {
        gt: now
      }
    }
  ]
});

export const activeUserBanWhere = (userId: string, now: Date) => ({
  userId,
  ...activeBanWhere(now)
});

export const canActorBanTarget = (
  actorRole: "OWNER" | "MODERATOR" | "MEMBER",
  targetRole: "OWNER" | "MODERATOR" | "MEMBER"
) =>
  actorRole === "OWNER" ||
  (actorRole === "MODERATOR" && targetRole === "MEMBER");
