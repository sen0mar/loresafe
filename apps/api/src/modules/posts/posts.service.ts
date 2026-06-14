import { HttpError } from "../../core/errors/http-error.js";
import {
  type ClubPostsResponse,
  type CreateClubPostResponse,
  toClubPostCardDto
} from "./posts.dto.js";
import { canCreateClubPost, canViewClubFeed } from "./posts.policy.js";
import {
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

    const result = await repository.listClubPosts(club.id, query);

    return {
      posts: result.posts.map((post) =>
        toClubPostCardDto(post, club.progress)
      ),
      pagination: {
        page: query.page,
        limit: query.limit,
        total: result.total,
        pageCount: Math.ceil(result.total / query.limit)
      }
    };
  }
});

export const postsService = createPostsService();
