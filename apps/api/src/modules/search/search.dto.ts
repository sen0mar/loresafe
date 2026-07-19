import { r2Storage } from "../../core/storage/r2-storage.js";
import type { ClubCategory } from "../clubs/clubs.schema.js";
import type { ClubPostCardDto } from "../posts/posts.dto.js";
import type {
  SearchClubRecord,
  SearchPostRecord
} from "./search.repository.js";
import type { SearchFilter } from "./search.schema.js";

export type SearchClubDto = {
  id: string;
  title: string;
  linkName: string;
  description: string | null;
  category: ClubCategory;
  coverUrl: string | null;
  visibility: "PUBLIC" | "PRIVATE" | "INVITE_ONLY";
  memberCount: number;
  createdAt: string;
  updatedAt: string;
};

export type SearchResponse = {
  query: string;
  scope: "all" | "clubs" | "posts";
  filters: SearchFilter[];
  clubs: SearchClubDto[];
  posts: SearchPostDto[];
  pagination: {
    limit: number;
    nextCursor: string | null;
    hasMore: boolean;
  };
};

export type SearchPostDto = {
  post: ClubPostCardDto;
  club: {
    id: string;
    title: string;
    linkName: string;
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

export const toSearchPostDto = (
  result: SearchPostRecord,
  post: ClubPostCardDto
): SearchPostDto => ({
  post,
  club: {
    id: result.club.id,
    title: result.club.title,
    linkName: result.club.linkName
  }
});
