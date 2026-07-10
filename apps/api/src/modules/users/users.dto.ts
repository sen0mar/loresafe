import type { JoinedClubRecord } from "./users.repository.js";
import { r2Storage } from "../../core/storage/r2-storage.js";

export type JoinedClubDto = {
  id: string;
  title: string;
  linkName: string;
  coverUrl: string | null;
  visibility: "PUBLIC" | "PRIVATE" | "INVITE_ONLY";
  role: "OWNER" | "MODERATOR" | "MEMBER";
  memberCount: number;
  joinedAt: string;
};

export type JoinedClubsResponse = {
  clubs: JoinedClubDto[];
  pagination: {
    limit: number;
    nextCursor: string | null;
    hasMore: boolean;
  };
};

export const toJoinedClubDto = (club: JoinedClubRecord): JoinedClubDto => ({
  id: club.id,
  title: club.title,
  linkName: club.linkName,
  coverUrl:
    club.coverAsset?.status === "READY"
      ? r2Storage.getPublicUrl(club.coverAsset.objectKey)
      : null,
  visibility: club.visibility,
  role: club.role,
  memberCount: club.memberCount,
  joinedAt: club.joinedAt.toISOString()
});
