import type { JoinedClubRecord } from "./users.repository.js";

export type JoinedClubDto = {
  id: string;
  title: string;
  slug: string;
  visibility: "PUBLIC" | "PRIVATE" | "INVITE_ONLY";
  role: "OWNER" | "MODERATOR" | "MEMBER";
  memberCount: number;
  joinedAt: string;
};

export type JoinedClubsResponse = {
  clubs: JoinedClubDto[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pageCount: number;
  };
};

export const toJoinedClubDto = (club: JoinedClubRecord): JoinedClubDto => ({
  id: club.id,
  title: club.title,
  slug: club.slug,
  visibility: club.visibility,
  role: club.role,
  memberCount: club.memberCount,
  joinedAt: club.joinedAt.toISOString()
});
