import { HttpError } from "../../core/errors/http-error.js";
import { r2Storage, type ObjectStorage } from "../../core/storage/r2-storage.js";
import { toClubPostCardDto } from "../posts/posts.dto.js";
import {
  toSearchClubDto,
  toSearchPostDto,
  type SearchResponse
} from "./search.dto.js";
import {
  searchRepository,
  type SearchRepository
} from "./search.repository.js";
import type { SearchFilter, SearchQuery } from "./search.schema.js";

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
    const filters = normalizeSearchFilters(query);

    if (!normalizedQuery) {
      return emptySearchResponse(query, filters);
    }

    const cursor = decodeSearchCursor(query.cursor);
    const pageInput = {
      offset: cursor?.offset ?? 0,
      limit: query.limit
    };
    const includeClubs = filters.includes("clubs");
    const includePosts = filters.includes("posts");
    const [clubResult, postResult] = await Promise.all([
      includeClubs
        ? repository.searchClubs(normalizedQuery, userId, pageInput)
        : Promise.resolve({ records: [], hasMore: false }),
      includePosts
        ? repository.searchPosts(normalizedQuery, userId, {
            ...pageInput,
            includeSafe: filters.includes("safe"),
            includeSpoiler: filters.includes("spoiler")
          })
        : Promise.resolve({ records: [], hasMore: false })
    ]);
    const hasMore = clubResult.hasMore || postResult.hasMore;
    const posts = await Promise.all(
      postResult.records.map(async (result) =>
        toSearchPostDto(
          result,
          await toClubPostCardDto(
            result.post,
            {
              ...result.club.progress,
              currentUserId: userId,
              currentUserRole: result.club.currentUserRole
            },
            storage
          )
        )
      )
    );

    return {
      query: normalizedQuery,
      scope: query.scope,
      filters,
      clubs: clubResult.records.map(toSearchClubDto),
      posts,
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

const emptySearchResponse = (
  query: SearchQuery,
  filters: SearchFilter[]
): SearchResponse => ({
  query: "",
  scope: query.scope,
  filters,
  clubs: [],
  posts: [],
  pagination: {
    limit: query.limit,
    nextCursor: null,
    hasMore: false
  }
});

const defaultSearchFilters: SearchFilter[] = [
  "safe",
  "spoiler",
  "clubs",
  "posts"
];

const normalizeSearchFilters = (query: SearchQuery): SearchFilter[] => {
  const filters = query.filters
    ? uniqueSearchFilters(query.filters.split(",") as SearchFilter[])
    : filtersFromLegacyScope(query.scope);
  const hasSafetyFilter =
    filters.includes("safe") || filters.includes("spoiler");

  if (hasSafetyFilter && !filters.includes("posts")) {
    return uniqueSearchFilters([...filters, "posts"]);
  }

  if (filters.includes("posts") && !hasSafetyFilter) {
    return [...filters, "safe", "spoiler"];
  }

  return filters;
};

const filtersFromLegacyScope = (scope: SearchQuery["scope"]): SearchFilter[] => {
  if (scope === "clubs") {
    return ["clubs"];
  }

  if (scope === "posts") {
    return ["safe", "spoiler", "posts"];
  }

  return defaultSearchFilters;
};

const uniqueSearchFilters = (filters: SearchFilter[]) =>
  defaultSearchFilters.filter((filter) => filters.includes(filter));

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
