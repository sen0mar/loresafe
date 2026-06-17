import { HttpError } from "../../core/errors/http-error.js";
import {
  canRevealRequiredMilestone,
  canViewRequiredMilestone
} from "../spoilers/spoiler.policy.js";
import {
  type CommentDto,
  type CreatePostCommentResponse,
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
  canCreatePostComment,
  canToggleCommentReaction,
  canViewPostComments
} from "./comments.policy.js";
import type {
  CreatePostCommentRequest,
  ListPostCommentsQuery,
  ToggleCommentReactionRequest
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
  toggleCommentReactionById: (
    commentId: string,
    userId: string,
    input: ToggleCommentReactionRequest
  ) => Promise<ToggleCommentReactionResponse>;
};

export const createCommentsService = (
  repository: CommentsRepository = commentsRepository
): CommentsService => ({
  listPostComments: async (postId, userId, query) => {
    const post = await repository.findPostForComments(postId, userId);

    if (!post || !canViewPostComments(post)) {
      throw new HttpError(404, "NOT_FOUND", "Post not found");
    }

    const result = await repository.listVisibleCommentsForPost(
      post.id,
      userId,
      {
        cursor: decodeCommentsCursor(query.cursor),
        limit: query.limit
      }
    );

    return {
      comments: result.comments.map((comment) =>
        toCommentDto(comment, post.club.progress)
      ),
      pagination: {
        limit: query.limit,
        nextCursor: result.nextCursor
          ? encodeCommentsCursor(result.nextCursor)
          : null,
        hasMore: result.hasMore
      }
    };
  },

  createPostComment: async (postId, userId, input) => {
    const post = await repository.findPostForComments(postId, userId);

    if (!post || !canViewPostComments(post)) {
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
      comment: toCommentDto(comment, post.club.progress) as CommentDto
    };
  },

  revealPostComment: async (postId, commentId, userId) => {
    const post = await repository.findPostForComments(postId, userId);

    if (!post || !canViewPostComments(post)) {
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
      comment: toRevealedCommentDto(comment)
    };
  },

  toggleCommentReactionById: async (commentId, userId, input) => {
    const target = await repository.findVisibleCommentForReaction(
      commentId,
      userId
    );

    if (!target || !canViewPostComments(target.post)) {
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

    const toggledTarget = await repository.toggleCommentReaction(
      commentId,
      userId,
      input
    );

    if (!toggledTarget || !canViewPostComments(toggledTarget.post)) {
      throw new HttpError(404, "NOT_FOUND", "Comment not found");
    }

    return {
      comment: toCommentDto(
        toggledTarget.comment,
        toggledTarget.post.club.progress
      )
    };
  }
});

export const commentsService = createCommentsService();

const encodeCommentsCursor = ({ createdAt, id }: CommentsCursor) =>
  Buffer.from(
    JSON.stringify({
      createdAt: createdAt.toISOString(),
      id
    })
  ).toString("base64url");

const decodeCommentsCursor = (
  cursor: string | undefined
): CommentsCursor | null => {
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
      "Check the comments request and try again."
    );
  }
};

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
