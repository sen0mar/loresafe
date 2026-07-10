import { HttpError } from "../../core/errors/http-error.js";
import {
  type ClubPostsResponse,
  type CreateClubPostResponse,
  type DeletePostResponse,
  type PostDetailResponse,
  type RevealPostResponse,
  type TogglePostReactionResponse,
  toClubPostCardDto,
  toRevealedClubPostDto
} from "./posts.dto.js";
import {
  canCreateClubPost,
  canDeletePost,
  canViewClubFeed
} from "./posts.policy.js";
import {
  type ClubFeedRecord,
  type ClubPostsCursor,
  type PostDetailRecord,
  postsRepository,
  type PostsRepository
} from "./posts.repository.js";
import type { ListClubPostsQuery } from "./posts.schema.js";
import type {
  CreateClubPostRequest,
  SetPostReactionRequest
} from "./posts.schema.js";
import {
  canRevealRequiredMilestone,
  canViewRequiredMilestone
} from "../spoilers/spoiler.policy.js";
import { bannedFromClubError } from "../clubs/club-bans.js";
import { r2Storage, type ObjectStorage } from "../../core/storage/r2-storage.js";
import {
  decodeTimestampUuidCursor,
  encodeTimestampUuidCursor
} from "../../core/http/cursor.js";

export type PostsService = {
  createClubPostForLinkName: (
    linkName: string,
    userId: string,
    input: CreateClubPostRequest
  ) => Promise<CreateClubPostResponse>;
  listClubPostsByLinkName: (
    linkName: string,
    userId: string,
    query: ListClubPostsQuery
  ) => Promise<ClubPostsResponse>;
  getPostById: (postId: string, userId: string) => Promise<PostDetailResponse>;
  revealPostById: (
    postId: string,
    userId: string
  ) => Promise<RevealPostResponse>;
  setPostReactionById: (
    postId: string,
    userId: string,
    input: SetPostReactionRequest
  ) => Promise<TogglePostReactionResponse>;
  deletePostById: (
    postId: string,
    userId: string
  ) => Promise<DeletePostResponse>;
};

export const createPostsService = (
  repository: PostsRepository = postsRepository,
  storage: Pick<ObjectStorage, "createPresignedRead"> = r2Storage
): PostsService => ({
  createClubPostForLinkName: async (linkName, userId, input) => {
    const club = await repository.findClubForPostCreation(linkName, userId);

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
      post: await toClubPostCardDto(
        post,
        toPostVisibilityContext(userId, club),
        storage
      )
    };
  },

  listClubPostsByLinkName: async (linkName, userId, query) => {
    const club = await repository.findClubForFeed(linkName, userId);

    if (!club) {
      throw new HttpError(404, "NOT_FOUND", "Club not found");
    }

    if (club.isCurrentUserBanned) {
      throw bannedFromClubError();
    }

    if (!canViewClubFeed(club)) {
      throw new HttpError(404, "NOT_FOUND", "Club not found");
    }

    const cursor = decodeTimestampUuidCursor(query.cursor);
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
          toClubPostCardDto(
            post,
            toPostVisibilityContext(userId, club),
            storage
          )
        )
      ),
      pagination: {
        limit: query.limit,
        nextCursor: result.nextCursor
          ? encodeTimestampUuidCursor(result.nextCursor)
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
      post: await toClubPostCardDto(
        detail.post,
        toPostVisibilityContext(userId, detail.club),
        storage
      ),
      club: {
        id: detail.club.id,
        linkName: detail.club.linkName
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
      post: await toRevealedClubPostDto(
        detail.post,
        toPostVisibilityContext(userId, detail.club),
        storage
      ),
      club: {
        id: detail.club.id,
        linkName: detail.club.linkName
      }
    };
  },

  setPostReactionById: async (postId, userId, input) => {
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

    if (detail.club.currentUserRole === null) {
      throw new HttpError(403, "FORBIDDEN", "Join this club before reacting.");
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

    const toggledDetail = await repository.setPostReaction(
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
        toPostVisibilityContext(userId, toggledDetail.club),
        storage
      )
    };
  },

  deletePostById: async (postId, userId) => {
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

    if (!canDeletePost(toPostDeletePolicyInput(detail, userId))) {
      throw new HttpError(
        403,
        "FORBIDDEN",
        "You can delete only your own posts in this club."
      );
    }

    const result = await repository.softDeletePost({
      actorId: userId,
      clubId: detail.club.id,
      postId: detail.post.id,
      targetUserId: detail.post.author.id
    });

    if (!result) {
      throw new HttpError(404, "NOT_FOUND", "Post not found");
    }

    return {
      post: {
        id: result.id,
        deletedAt: result.deletedAt.toISOString()
      }
    };
  }
});

export const postsService = createPostsService();

const toPostVisibilityContext = (
  currentUserId: string,
  club: ClubFeedRecord
) => ({
  ...club.progress,
  currentUserId,
  currentUserRole: club.currentUserRole
});

const toPostDeletePolicyInput = (
  detail: PostDetailRecord,
  currentUserId: string
) => ({
  authorId: detail.post.author.id,
  currentUserId,
  currentUserRole: detail.club.currentUserRole
});
