import { HttpError } from "../../core/errors/http-error.js";
import {
  type ClubPostsResponse,
  type CreateClubPostResponse,
  type PostDetailResponse,
  type RevealPostResponse,
  type TogglePostReactionResponse,
  toClubPostCardDto,
  toRevealedClubPostDto
} from "./posts.dto.js";
import { canCreateClubPost, canViewClubFeed } from "./posts.policy.js";
import {
  type ClubPostsCursor,
  postsRepository,
  type PostsRepository
} from "./posts.repository.js";
import type { ListClubPostsQuery } from "./posts.schema.js";
import type {
  CreateClubPostRequest,
  TogglePostReactionRequest
} from "./posts.schema.js";
import {
  canRevealRequiredMilestone,
  canViewRequiredMilestone
} from "../spoilers/spoiler.policy.js";
import { bannedFromClubError } from "../clubs/club-bans.js";
import { r2Storage, type ObjectStorage } from "../../core/storage/r2-storage.js";

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
  revealPostById: (
    postId: string,
    userId: string
  ) => Promise<RevealPostResponse>;
  togglePostReactionById: (
    postId: string,
    userId: string,
    input: TogglePostReactionRequest
  ) => Promise<TogglePostReactionResponse>;
};

export const createPostsService = (
  repository: PostsRepository = postsRepository,
  storage: Pick<ObjectStorage, "createPresignedRead"> = r2Storage
): PostsService => ({
  createClubPostForSlug: async (slug, userId, input) => {
    const club = await repository.findClubForPostCreation(slug, userId);

    if (!club) {
      throw new HttpError(404, "NOT_FOUND", "Club not found");
    }

    if (club.isCurrentUserBanned) {
      throw bannedFromClubError();
    }

    if (!canCreateClubPost(club)) {
      throw new HttpError(
        403,
        "FORBIDDEN",
        "Join this club before creating posts."
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
      post: await toClubPostCardDto(post, club.progress, storage)
    };
  },

  listClubPostsBySlug: async (slug, userId, query) => {
    const club = await repository.findClubForFeed(slug, userId);

    if (!club) {
      throw new HttpError(404, "NOT_FOUND", "Club not found");
    }

    if (club.isCurrentUserBanned) {
      throw bannedFromClubError();
    }

    if (!canViewClubFeed(club)) {
      throw new HttpError(404, "NOT_FOUND", "Club not found");
    }

    const cursor = decodeClubPostsCursor(query.cursor);
    const result = await repository.listClubPosts(club.id, {
      tab: query.tab,
      cursor,
      limit: query.limit,
      authorId: userId,
      mode: club.progress.mode,
      currentMilestonePosition: club.progress.currentMilestonePosition
    });

    return {
      posts: await Promise.all(
        result.posts.map((post) =>
          toClubPostCardDto(post, club.progress, storage)
        )
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

    if (!detail) {
      throw new HttpError(404, "NOT_FOUND", "Post not found");
    }

    if (detail.club.isCurrentUserBanned) {
      throw bannedFromClubError();
    }

    if (!canViewClubFeed(detail.club)) {
      throw new HttpError(404, "NOT_FOUND", "Post not found");
    }

    return {
      post: await toClubPostCardDto(detail.post, detail.club.progress, storage),
      club: {
        id: detail.club.id,
        slug: detail.club.slug
      }
    };
  },

  revealPostById: async (postId, userId) => {
    const detail = await repository.findPostForDetail(postId, userId);

    if (!detail) {
      throw new HttpError(404, "NOT_FOUND", "Post not found");
    }

    if (detail.club.isCurrentUserBanned) {
      throw bannedFromClubError();
    }

    if (!canViewClubFeed(detail.club)) {
      throw new HttpError(404, "NOT_FOUND", "Post not found");
    }

    if (
      !canRevealRequiredMilestone({
        mode: detail.club.progress.mode,
        currentMilestonePosition:
          detail.club.progress.currentMilestonePosition,
        requiredMilestonePosition: detail.post.requiredMilestone.position
      })
    ) {
      throw new HttpError(
        403,
        "FORBIDDEN",
        "Switch to Brave mode before revealing this discussion."
      );
    }

    return {
      post: await toRevealedClubPostDto(detail.post, storage),
      club: {
        id: detail.club.id,
        slug: detail.club.slug
      }
    };
  },

  togglePostReactionById: async (postId, userId, input) => {
    const detail = await repository.findPostForDetail(postId, userId);

    if (!detail) {
      throw new HttpError(404, "NOT_FOUND", "Post not found");
    }

    if (detail.club.isCurrentUserBanned) {
      throw bannedFromClubError();
    }

    if (!canViewClubFeed(detail.club)) {
      throw new HttpError(404, "NOT_FOUND", "Post not found");
    }

    if (
      !canViewRequiredMilestone({
        mode: detail.club.progress.mode,
        currentMilestonePosition:
          detail.club.progress.currentMilestonePosition,
        requiredMilestonePosition: detail.post.requiredMilestone.position
      })
    ) {
      throw new HttpError(
        403,
        "FORBIDDEN",
        "Reach the required milestone before reacting to this discussion."
      );
    }

    const toggledDetail = await repository.togglePostReaction(
      postId,
      userId,
      input
    );

    if (!toggledDetail) {
      throw new HttpError(404, "NOT_FOUND", "Post not found");
    }

    if (toggledDetail.club.isCurrentUserBanned) {
      throw bannedFromClubError();
    }

    if (!canViewClubFeed(toggledDetail.club)) {
      throw new HttpError(404, "NOT_FOUND", "Post not found");
    }

    return {
      post: await toClubPostCardDto(
        toggledDetail.post,
        toggledDetail.club.progress,
        storage
      )
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
