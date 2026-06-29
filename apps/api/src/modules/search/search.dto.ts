import { r2Storage } from "../../core/storage/r2-storage.js";
import type { ClubPostCardDto } from "../posts/posts.dto.js";
import type { SearchClubRecord } from "./search.repository.js";

export type SearchClubDto = {
  id: string;
  title: string;
  linkName: string;
  description: string | null;
  category: string | null;
  coverUrl: string | null;
  visibility: "PUBLIC" | "PRIVATE" | "INVITE_ONLY";
  memberCount: number;
  createdAt: string;
  updatedAt: string;
};

export type SearchResponse = {
  query: string;
  scope: "all" | "clubs" | "posts";
  clubs: SearchClubDto[];
  posts: ClubPostCardDto[];
  pagination: {
    limit: number;
    nextCursor: string | null;
    hasMore: boolean;
  };
};

export const toSearchClubDto = (club: SearchClubRecord): SearchClubDto => ({
  id: club.id,
  title: club.title,
  linkName: club.linkName,
  description: club.description,
  category: club.category,
  coverUrl:
    club.coverAsset?.status === "READY"
      ? r2Storage.getPublicUrl(club.coverAsset.objectKey)
      : null,
  visibility: club.visibility,
  memberCount: club.memberCount,
  createdAt: club.createdAt.toISOString(),
  updatedAt: club.updatedAt.toISOString()
});
