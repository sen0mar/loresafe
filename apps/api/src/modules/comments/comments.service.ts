import { HttpError } from "../../core/errors/http-error.js";
import { canViewRequiredMilestone } from "../spoilers/spoiler.policy.js";
import {
  type CommentDto,
  type CreatePostCommentResponse,
  type PostCommentsResponse,
  toCommentDto
} from "./comments.dto.js";
import {
  commentsRepository,
  type CommentPostRecord,
  type CommentsRepository
} from "./comments.repository.js";
import { canCreatePostComment, canViewPostComments } from "./comments.policy.js";
import type { CreatePostCommentRequest } from "./comments.schema.js";

export type CommentsService = {
  listPostComments: (
    postId: string,
    userId: string
  ) => Promise<PostCommentsResponse>;
  createPostComment: (
    postId: string,
    userId: string,
    input: CreatePostCommentRequest
  ) => Promise<CreatePostCommentResponse>;
};

export const createCommentsService = (
  repository: CommentsRepository = commentsRepository
): CommentsService => ({
  listPostComments: async (postId, userId) => {
    const post = await repository.findPostForComments(postId, userId);

    if (!post || !canViewPostComments(post)) {
      throw new HttpError(404, "NOT_FOUND", "Post not found");
    }

    const comments = await repository.listVisibleCommentsForPost(post.id);

    return {
      comments: comments.map((comment) =>
        toCommentDto(comment, post.club.progress)
      )
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

    const inheritedMilestone =
      parentComment?.requiredMilestone ?? post.requiredMilestone;

    if (!canCreatePostComment(post, inheritedMilestone.position)) {
      throw new HttpError(
        403,
        "FORBIDDEN",
        getCommentDeniedMessage(post, inheritedMilestone.position)
      );
    }

    const comment = await repository.createPostComment(post.id, userId, {
      ...input,
      requiredMilestoneId: inheritedMilestone.id
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
  }
});

export const commentsService = createCommentsService();

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
