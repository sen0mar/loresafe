import { HttpError } from "../../core/errors/http-error.js";
import { r2Storage, type ObjectStorage } from "../../core/storage/r2-storage.js";
import { toClubPostCardDto } from "../posts/posts.dto.js";
import { toSearchClubDto, type SearchResponse } from "./search.dto.js";
import {
  searchRepository,
  type SearchRepository
} from "./search.repository.js";
import type { SearchQuery } from "./search.schema.js";

export type SearchService = {
  search: (userId: string, query: SearchQuery) => Promise<SearchResponse>;
};

type SearchCursor = {
  offset: number;
};

export const createSearchService = (
  repository: SearchRepository = searchRepository,
  storage: Pick<ObjectStorage, "createPresignedRead"> = r2Storage
): SearchService => ({
  search: async (userId, query) => {
    const normalizedQuery = query.q.trim();

    if (!normalizedQuery) {
      return emptySearchResponse(query);
    }

    const cursor = decodeSearchCursor(query.cursor);
    const pageInput = {
      offset: cursor?.offset ?? 0,
      limit: query.limit
    };
    const includeClubs = query.scope === "all" || query.scope === "clubs";
    const includePosts = query.scope === "all" || query.scope === "posts";
    const [clubResult, postResult] = await Promise.all([
      includeClubs
        ? repository.searchClubs(normalizedQuery, userId, pageInput)
        : Promise.resolve({ records: [], hasMore: false }),
      includePosts
        ? repository.searchPosts(normalizedQuery, userId, pageInput)
        : Promise.resolve({ records: [], hasMore: false })
    ]);
    const hasMore = clubResult.hasMore || postResult.hasMore;

    return {
      query: normalizedQuery,
      scope: query.scope,
      clubs: clubResult.records.map(toSearchClubDto),
      posts: await Promise.all(
        postResult.records.map((result) =>
          toClubPostCardDto(result.post, result.club.progress, storage)
        )
      ),
      pagination: {
        limit: query.limit,
        nextCursor: hasMore
          ? encodeSearchCursor({ offset: pageInput.offset + query.limit })
          : null,
        hasMore
      }
    };
  }
});

export const searchService = createSearchService();

const emptySearchResponse = (query: SearchQuery): SearchResponse => ({
  query: "",
  scope: query.scope,
  clubs: [],
  posts: [],
  pagination: {
    limit: query.limit,
    nextCursor: null,
    hasMore: false
  }
});

const encodeSearchCursor = ({ offset }: SearchCursor) =>
  Buffer.from(JSON.stringify({ offset })).toString("base64url");

const decodeSearchCursor = (
  cursor: string | undefined
): SearchCursor | null => {
  if (!cursor) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8")
    ) as unknown;

    if (
      !parsed ||
      typeof parsed !== "object" ||
      !("offset" in parsed) ||
      typeof parsed.offset !== "number" ||
      !Number.isInteger(parsed.offset) ||
      parsed.offset < 0
    ) {
      throw new Error("Malformed cursor");
    }

    return {
      offset: parsed.offset
    };
  } catch {
    throw new HttpError(
      400,
      "BAD_REQUEST",
      "Check the search request and try again."
    );
  }
};
