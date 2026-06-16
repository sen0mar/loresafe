import { HttpError } from "../../core/errors/http-error.js";
import {
  type ClubPostsResponse,
  type CreateClubPostResponse,
  type PostDetailResponse,
  toClubPostCardDto
} from "./posts.dto.js";
import { canCreateClubPost, canViewClubFeed } from "./posts.policy.js";
import {
  type ClubPostsCursor,
  postsRepository,
  type PostsRepository
} from "./posts.repository.js";
import type { ListClubPostsQuery } from "./posts.schema.js";
import type { CreateClubPostRequest } from "./posts.schema.js";

export type PostsService = {
  createClubPostForSlug: (
    slug: string,
    userId: string,
    input: CreateClubPostRequest
  ) => Promise<CreateClubPostResponse>;
  listClubPostsBySlug: (
    slug: string,
    userId: string,
    query: ListClubPostsQuery
  ) => Promise<ClubPostsResponse>;
  getPostById: (postId: string, userId: string) => Promise<PostDetailResponse>;
};

export const createPostsService = (
  repository: PostsRepository = postsRepository
): PostsService => ({
  createClubPostForSlug: async (slug, userId, input) => {
    const club = await repository.findClubForPostCreation(slug, userId);

    if (!club) {
      throw new HttpError(404, "NOT_FOUND", "Club not found");
    }

    if (!canCreateClubPost(club)) {
      throw new HttpError(
        403,
        "FORBIDDEN",
        club.isCurrentUserBanned
          ? "You cannot create posts in this club."
          : "Join this club before creating posts."
      );
    }

    const post = await repository.createClubPost(club.id, userId, input);

    if (!post) {
      throw new HttpError(
        400,
        "BAD_REQUEST",
        "Choose a milestone from this club."
      );
    }

    return {
      post: toClubPostCardDto(post, club.progress)
    };
  },

  listClubPostsBySlug: async (slug, userId, query) => {
    const club = await repository.findClubForFeed(slug, userId);

    if (!club || !canViewClubFeed(club)) {
      throw new HttpError(404, "NOT_FOUND", "Club not found");
    }

    const cursor = decodeClubPostsCursor(query.cursor);
    const result = await repository.listClubPosts(club.id, {
      tab: query.tab,
      cursor,
      limit: query.limit,
      authorId: userId,
      currentMilestonePosition: club.progress.currentMilestonePosition
    });

    return {
      posts: result.posts.map((post) =>
        toClubPostCardDto(post, club.progress)
      ),
      pagination: {
        limit: query.limit,
        nextCursor: result.nextCursor
          ? encodeClubPostsCursor(result.nextCursor)
          : null,
        hasMore: result.hasMore
      }
    };
  },

  getPostById: async (postId, userId) => {
    const detail = await repository.findPostForDetail(postId, userId);

    if (!detail || !canViewClubFeed(detail.club)) {
      throw new HttpError(404, "NOT_FOUND", "Post not found");
    }

    return {
      post: toClubPostCardDto(detail.post, detail.club.progress),
      club: {
        id: detail.club.id,
        slug: detail.club.slug
      }
    };
  }
});

export const postsService = createPostsService();

const encodeClubPostsCursor = ({ createdAt, id }: ClubPostsCursor) =>
  Buffer.from(
    JSON.stringify({
      createdAt: createdAt.toISOString(),
      id
    })
  ).toString("base64url");

const decodeClubPostsCursor = (
  cursor: string | undefined
): ClubPostsCursor | null => {
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
      !("createdAt" in parsed) ||
      !("id" in parsed) ||
      typeof parsed.createdAt !== "string" ||
      typeof parsed.id !== "string"
    ) {
      throw new Error("Malformed cursor");
    }

    const createdAt = new Date(parsed.createdAt);

    if (Number.isNaN(createdAt.getTime())) {
      throw new Error("Malformed cursor");
    }

    return {
      createdAt,
      id: parsed.id
    };
  } catch {
    throw new HttpError(
      400,
      "BAD_REQUEST",
      "Check the feed request and try again."
    );
  }
};
