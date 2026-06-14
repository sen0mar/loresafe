import { HttpError } from "../../core/errors/http-error.js";
import {
  type ClubPostsResponse,
  toClubPostCardDto
} from "./posts.dto.js";
import { canViewClubFeed } from "./posts.policy.js";
import {
  postsRepository,
  type PostsRepository
} from "./posts.repository.js";
import type { ListClubPostsQuery } from "./posts.schema.js";

export type PostsService = {
  listClubPostsBySlug: (
    slug: string,
    userId: string,
    query: ListClubPostsQuery
  ) => Promise<ClubPostsResponse>;
};

export const createPostsService = (
  repository: PostsRepository = postsRepository
): PostsService => ({
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
