import type { InfiniteData, QueryClient } from "@tanstack/react-query";

import type {
  ClubPostCard,
  ClubPostsResponse,
  Comment,
  CommentReactionEmoji,
  PostCommentsResponse,
  PostReactionEmoji
} from "./clubs.types.js";

export const updatePostInInfiniteData = (
  currentData: InfiniteData<ClubPostsResponse> | undefined,
  updatePost: (post: ClubPostCard) => ClubPostCard
) => {
  if (!currentData) {
    return currentData;
  }

  return {
    ...currentData,
    pages: currentData.pages.map((page) => ({
      ...page,
      posts: page.posts.map(updatePost)
    }))
  };
};

export const removePostFromPostListQueries = (
  queryClient: QueryClient,
  postId: string
) => {
  queryClient.setQueriesData<InfiniteData<{ posts: ClubPostCard[] }>>(
    {
      predicate: (query) =>
        Array.isArray(query.queryKey) &&
        (query.queryKey.includes("feed") ||
          query.queryKey.includes("recently-unlocked") ||
          query.queryKey.includes("search"))
    },
    (currentData) => removePostFromInfiniteData(currentData, postId)
  );
};

const removePostFromInfiniteData = <TPage extends { posts: ClubPostCard[] }>(
  currentData: InfiniteData<TPage> | undefined,
  postId: string
) => {
  if (!currentData) {
    return currentData;
  }

  return {
    ...currentData,
    pages: currentData.pages.map((page) => ({
      ...page,
      posts: page.posts.filter((post) => post.id !== postId)
    }))
  };
};

export const updateCommentInInfiniteData = (
  currentData: InfiniteData<PostCommentsResponse> | undefined,
  updateComment: (comment: Comment) => Comment
) => {
  if (!currentData) {
    return currentData;
  }

  return {
    ...currentData,
    pages: currentData.pages.map((page) => ({
      ...page,
      comments: page.comments.map(updateComment)
    }))
  };
};

export const removeCommentFromInfiniteData = (
  currentData: InfiniteData<PostCommentsResponse> | undefined,
  commentId: string
) => {
  if (!currentData) {
    return currentData;
  }

  return {
    ...currentData,
    pages: currentData.pages.map((page) => ({
      ...page,
      comments: page.comments.filter((comment) => comment.id !== commentId)
    }))
  };
};

export const togglePostReactionOnCard = (
  post: ClubPostCard,
  emoji: PostReactionEmoji,
  active?: boolean
): ClubPostCard => {
  if (post.visibility === "LOCKED") {
    return post;
  }

  const reactions = post.counts.reactions.map((reaction) => {
    if (reaction.emoji !== emoji) {
      return reaction;
    }

    const reactedByMe = active ?? !reaction.reactedByMe;
    const count = reactedByMe
      ? reaction.count + 1
      : Math.max(0, reaction.count - 1);

    return {
      ...reaction,
      count,
      reactedByMe
    };
  });

  return {
    ...post,
    counts: {
      ...post.counts,
      reactionCount: reactions.reduce(
        (total, reaction) => total + reaction.count,
        0
      ),
      reactions
    }
  };
};

export const toggleCommentReactionOnComment = (
  comment: Comment,
  emoji: CommentReactionEmoji,
  active?: boolean
): Comment => {
  if (comment.visibility === "LOCKED") {
    return comment;
  }

  const reactions = comment.counts.reactions.map((reaction) => {
    if (reaction.emoji !== emoji) {
      return reaction;
    }

    const reactedByMe = active ?? !reaction.reactedByMe;
    const count = reactedByMe
      ? reaction.count + 1
      : Math.max(0, reaction.count - 1);

    return {
      ...reaction,
      count,
      reactedByMe
    };
  });

  return {
    ...comment,
    counts: {
      reactionCount: reactions.reduce(
        (total, reaction) => total + reaction.count,
        0
      ),
      reactions
    }
  };
};
