import { HttpError } from "../../core/errors/http-error.js";
import {
  canRevealRequiredMilestone,
  canViewRequiredMilestone
} from "../spoilers/spoiler.policy.js";
import { bannedFromClubError } from "../clubs/club-bans.js";
import {
  decodeTimestampUuidCursor,
  encodeTimestampUuidCursor
} from "../../core/http/cursor.js";
import {
  type CommentDto,
  type CreatePostCommentResponse,
  type DeleteCommentResponse,
  type PostCommentsResponse,
  type RevealCommentResponse,
  type ToggleCommentReactionResponse,
  toCommentDto,
  toRevealedCommentDto
} from "./comments.dto.js";
import {
  commentsRepository,
  type CommentsCursor,
  type CommentMilestoneRecord,
  type CommentPostRecord,
  type CommentsRepository
} from "./comments.repository.js";
import {
  canDeleteComment,
  canCreatePostComment,
  canToggleCommentReaction,
  canViewPostComments
} from "./comments.policy.js";
import type {
  CreatePostCommentRequest,
  ListPostCommentsQuery,
  SetCommentReactionRequest
} from "./comments.schema.js";

export type CommentsService = {
  listPostComments: (
    postId: string,
    userId: string,
    query: ListPostCommentsQuery
  ) => Promise<PostCommentsResponse>;
  createPostComment: (
    postId: string,
    userId: string,
    input: CreatePostCommentRequest
  ) => Promise<CreatePostCommentResponse>;
  revealPostComment: (
    postId: string,
    commentId: string,
    userId: string
  ) => Promise<RevealCommentResponse>;
  setCommentReactionById: (
    commentId: string,
    userId: string,
    input: SetCommentReactionRequest
  ) => Promise<ToggleCommentReactionResponse>;
  deleteCommentById: (
    commentId: string,
    userId: string
  ) => Promise<DeleteCommentResponse>;
};

export const createCommentsService = (
  repository: CommentsRepository = commentsRepository
): CommentsService => ({
  listPostComments: async (postId, userId, query) => {
    const post = await repository.findPostForComments(postId, userId);

    if (!post) {
      throw new HttpError(404, "NOT_FOUND", "Post not found");
    }

    if (post.club.isCurrentUserBanned) {
      throw bannedFromClubError();
    }

    if (!canViewPostComments(post)) {
      throw new HttpError(404, "NOT_FOUND", "Post not found");
    }

    const result = await repository.listVisibleCommentsForPost(
      post.id,
      userId,
      {
        cursor: decodeTimestampUuidCursor(query.cursor),
        limit: query.limit
      }
    );

    return {
      comments: result.comments.map((comment) =>
        toCommentDto(comment, toCommentVisibilityContext(userId, post))
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

  createPostComment: async (postId, userId, input) => {
    const post = await repository.findPostForComments(postId, userId);

    if (!post) {
      throw new HttpError(404, "NOT_FOUND", "Post not found");
    }

    if (post.club.isCurrentUserBanned) {
      throw bannedFromClubError();
    }

    if (!canViewPostComments(post)) {
      throw new HttpError(404, "NOT_FOUND", "Post not found");
    }

    const parentComment = input.parentId
      ? await repository.findVisibleCommentForPost(input.parentId, post.id)
      : null;

    if (input.parentId && !parentComment) {
      throw new HttpError(
        400,
        "BAD_REQUEST",
        "Choose a parent comment from this post."
      );
    }

    if (parentComment?.parentId) {
      throw new HttpError(
        400,
        "BAD_REQUEST",
        "Replies can only be one level deep."
      );
    }

    const inheritedMilestone =
      parentComment?.requiredMilestone ?? post.requiredMilestone;
    const selectedMilestone = await resolveRequiredMilestone(
      repository,
      post,
      inheritedMilestone,
      input.requiredMilestoneId
    );

    if (!canCreatePostComment(post, selectedMilestone.position)) {
      throw new HttpError(
        403,
        "FORBIDDEN",
        getCommentDeniedMessage(post, selectedMilestone.position)
      );
    }

    const comment = await repository.createPostComment(post.id, userId, {
      ...input,
      requiredMilestoneId: selectedMilestone.id
    });

    if (!comment) {
      throw new HttpError(
        400,
        "BAD_REQUEST",
        "Choose a parent comment from this post."
      );
    }

    return {
      comment: toCommentDto(
        comment,
        toCommentVisibilityContext(userId, post)
      ) as CommentDto
    };
  },

  revealPostComment: async (postId, commentId, userId) => {
    const post = await repository.findPostForComments(postId, userId);

    if (!post) {
      throw new HttpError(404, "NOT_FOUND", "Post not found");
    }

    if (post.club.isCurrentUserBanned) {
      throw bannedFromClubError();
    }

    if (!canViewPostComments(post)) {
      throw new HttpError(404, "NOT_FOUND", "Post not found");
    }

    const comment = await repository.findVisibleCommentForPost(
      commentId,
      post.id
    );

    if (!comment) {
      throw new HttpError(404, "NOT_FOUND", "Comment not found");
    }

    if (
      !canRevealRequiredMilestone({
        mode: post.club.progress.mode,
        currentMilestonePosition: post.club.progress.currentMilestonePosition,
        requiredMilestonePosition: comment.requiredMilestone.position
      })
    ) {
      throw new HttpError(
        403,
        "FORBIDDEN",
        "Switch to Brave mode before revealing this comment."
      );
    }

    return {
      comment: toRevealedCommentDto(
        comment,
        toCommentVisibilityContext(userId, post)
      )
    };
  },

  setCommentReactionById: async (commentId, userId, input) => {
    const target = await repository.findVisibleCommentForReaction(
      commentId,
      userId
    );

    if (!target) {
      throw new HttpError(404, "NOT_FOUND", "Comment not found");
    }

    if (target.post.club.isCurrentUserBanned) {
      throw bannedFromClubError();
    }

    if (!canViewPostComments(target.post)) {
      throw new HttpError(404, "NOT_FOUND", "Comment not found");
    }

    if (!canToggleCommentReaction(target.post)) {
      throw new HttpError(
        403,
        "FORBIDDEN",
        "You cannot react in this club."
      );
    }

    if (
      !canViewRequiredMilestone({
        mode: target.post.club.progress.mode,
        currentMilestonePosition:
          target.post.club.progress.currentMilestonePosition,
        requiredMilestonePosition: target.comment.requiredMilestone.position
      })
    ) {
      throw new HttpError(
        403,
        "FORBIDDEN",
        "Reach the required milestone before reacting to this comment."
      );
    }

    const toggledTarget = await repository.setCommentReaction(
      commentId,
      userId,
      input
    );

    if (!toggledTarget) {
      throw new HttpError(404, "NOT_FOUND", "Comment not found");
    }

    if (toggledTarget.post.club.isCurrentUserBanned) {
      throw bannedFromClubError();
    }

    if (!canViewPostComments(toggledTarget.post)) {
      throw new HttpError(404, "NOT_FOUND", "Comment not found");
    }

    return {
      comment: toCommentDto(
        toggledTarget.comment,
        toCommentVisibilityContext(userId, toggledTarget.post)
      )
    };
  },

  deleteCommentById: async (commentId, userId) => {
    const target = await repository.findVisibleCommentForDeletion(
      commentId,
      userId
    );

    if (!target) {
      throw new HttpError(404, "NOT_FOUND", "Comment not found");
    }

    if (target.post.club.isCurrentUserBanned) {
      throw bannedFromClubError();
    }

    if (!canViewPostComments(target.post)) {
      throw new HttpError(404, "NOT_FOUND", "Comment not found");
    }

    if (
      !canDeleteComment({
        authorId: target.comment.author.id,
        currentUserId: userId,
        currentUserRole: target.post.club.currentUserRole
      })
    ) {
      throw new HttpError(
        403,
        "FORBIDDEN",
        "You can delete only your own comments in this club."
      );
    }

    const result = await repository.softDeleteComment({
      actorId: userId,
      clubId: target.post.clubId,
      commentId: target.comment.id,
      postId: target.post.id,
      targetUserId: target.comment.author.id
    });

    if (!result) {
      throw new HttpError(404, "NOT_FOUND", "Comment not found");
    }

    return {
      comment: {
        id: result.id,
        postId: result.postId,
        deletedAt: result.deletedAt.toISOString()
      }
    };
  }
});

export const commentsService = createCommentsService();

const resolveRequiredMilestone = async (
  repository: CommentsRepository,
  post: CommentPostRecord,
  inheritedMilestone: CommentMilestoneRecord,
  requiredMilestoneId?: string
) => {
  if (!requiredMilestoneId) {
    return inheritedMilestone;
  }

  const selectedMilestone = await repository.findMilestoneForClub(
    requiredMilestoneId,
    post.clubId
  );

  if (!selectedMilestone) {
    throw new HttpError(
      400,
      "BAD_REQUEST",
      "Choose a milestone from this club."
    );
  }

  if (selectedMilestone.position < inheritedMilestone.position) {
    throw new HttpError(
      400,
      "BAD_REQUEST",
      "Choose this discussion's milestone or a later one."
    );
  }

  return selectedMilestone;
};

const getCommentDeniedMessage = (
  post: CommentPostRecord,
  requiredMilestonePosition: number
) => {
  if (post.club.isCurrentUserBanned) {
    return "You cannot comment in this club.";
  }

  if (post.club.currentUserRole === null) {
    return "Join this club before commenting.";
  }

  if (
    !canViewRequiredMilestone({
      mode: post.club.progress.mode,
      currentMilestonePosition: post.club.progress.currentMilestonePosition,
      requiredMilestonePosition
    })
  ) {
    return "Reach the required milestone before commenting.";
  }

  return "You cannot comment on this post.";
};

const toCommentVisibilityContext = (
  currentUserId: string,
  post: CommentPostRecord
) => ({
  ...post.club.progress,
  currentUserId,
  currentUserRole: post.club.currentUserRole
});
