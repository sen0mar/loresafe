import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { AuthenticatedAppShell } from "@/features/auth/components/authenticated-app-shell";
import { PostCard } from "@/features/clubs/components/club-feed-tab";
import { ApiError } from "@/shared/api/api-client";
import { Button } from "@/shared/components/ui/button";

import {
  type RevealedClubPost,
  type RevealedComment,
  usePostCommentsQuery,
  usePostQuery,
  useRevealPostCommentMutation,
  useRevealPostMutation
} from "../api/clubs.js";
import {
  BraveRevealPostPanel,
  CommentsPanel,
  DeletedPostNotice,
  PostDetailError,
  PostDetailLoading,
  RevealedPostCard
} from "../components/post-detail-sections.js";

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));

type PostDetailReturnState = {
  returnLabel?: unknown;
  returnTo?: unknown;
};

const getSafeReturnTarget = (
  state: unknown,
  clubLinkName?: string
): { label: string; to: string } => {
  const returnState = state as PostDetailReturnState | null;

  if (
    typeof returnState?.returnTo === "string" &&
    returnState.returnTo.startsWith("/app/") &&
    !returnState.returnTo.startsWith("/app/posts/") &&
    typeof returnState.returnLabel === "string" &&
    returnState.returnLabel.trim().length > 0
  ) {
    return {
      label: returnState.returnLabel,
      to: returnState.returnTo
    };
  }

  if (clubLinkName) {
    return {
      label: "Feed",
      to: `/app/clubs/${clubLinkName}?tab=feed`
    };
  }

  return {
    label: "Explore",
    to: "/app/explore"
  };
};

export const PostDetailPage = () => {
  const { postId = "" } = useParams();
  const location = useLocation();
  const [revealedPost, setRevealedPost] = useState<RevealedClubPost | null>(
    null
  );
  const [isPostDeleted, setIsPostDeleted] = useState(false);
  const [revealedComments, setRevealedComments] = useState<
    Record<string, RevealedComment>
  >({});
  const [deletedCommentIds, setDeletedCommentIds] = useState<Set<string>>(
    () => new Set()
  );
  const postQuery = usePostQuery(postId);
  const commentsEnabled = postQuery.isSuccess;
  const commentsQuery = usePostCommentsQuery(postId, commentsEnabled);
  const comments =
    commentsQuery.data?.pages
      .flatMap((page) => page.comments)
      .filter((comment) => !deletedCommentIds.has(comment.id)) ?? [];
  const revealPostMutation = useRevealPostMutation(postId);
  const revealCommentMutation = useRevealPostCommentMutation(postId);
  const returnTarget = getSafeReturnTarget(
    location.state,
    postQuery.data?.club.linkName
  );

  useEffect(() => {
    setRevealedPost(null);
    setIsPostDeleted(false);
    setRevealedComments({});
    setDeletedCommentIds(new Set());
  }, [postId]);

  const handleRevealPost = () => {
    revealPostMutation.mutate(undefined, {
      onSuccess: (response) => {
        setRevealedPost(response.post);
        toast.warning("Discussion revealed for this view");
      },
      onError: (error) => {
        toast.error(
          error instanceof ApiError
            ? error.message
            : "Could not reveal this discussion. Try again."
        );
      }
    });
  };

  const handleRevealComment = (commentId: string) => {
    revealCommentMutation.mutate(commentId, {
      onSuccess: (response) => {
        setRevealedComments((currentComments) => ({
          ...currentComments,
          [response.comment.id]: response.comment
        }));
        toast.warning("Comment revealed for this view");
      },
      onError: (error) => {
        toast.error(
          error instanceof ApiError
            ? error.message
            : "Could not reveal this comment. Try again."
        );
      }
    });
  };

  const handleCommentDeleted = (commentId: string) => {
    setDeletedCommentIds((currentIds) => {
      const nextIds = new Set(currentIds);

      nextIds.add(commentId);

      return nextIds;
    });
    setRevealedComments((currentComments) => {
      const { [commentId]: _removedComment, ...nextComments } =
        currentComments;

      return nextComments;
    });
  };

  return (
    <AuthenticatedAppShell>
      <div className="mx-auto max-w-3xl space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to={returnTarget.to}>
            <ArrowLeft />
            {returnTarget.label}
          </Link>
        </Button>

        {postQuery.isPending ? (
          <PostDetailLoading />
        ) : postQuery.isError ? (
          <PostDetailError
            error={postQuery.error}
            onRetry={() => void postQuery.refetch()}
          />
        ) : isPostDeleted ? (
          <DeletedPostNotice />
        ) : (
          <>
            {revealedPost ? (
              <RevealedPostCard
                post={revealedPost}
                onDeleted={() => setIsPostDeleted(true)}
              />
            ) : (
              <>
                <PostCard
                  post={postQuery.data.post}
                  onDeleted={() => setIsPostDeleted(true)}
                />
                {postQuery.data.post.visibility === "LOCKED" ? (
                  <BraveRevealPostPanel
                    isRevealing={revealPostMutation.isPending}
                    onReveal={handleRevealPost}
                  />
                ) : null}
              </>
            )}
            <CommentsPanel
              clubLinkName={postQuery.data.club.linkName}
              comments={comments}
              error={commentsQuery.error}
              hasNextPage={commentsQuery.hasNextPage}
              isError={commentsQuery.isError}
              isFetchingNextPage={commentsQuery.isFetchingNextPage}
              isLoading={commentsQuery.isPending}
              onLoadMore={() => void commentsQuery.fetchNextPage()}
              onRetry={() => void commentsQuery.refetch()}
              onRevealComment={handleRevealComment}
              post={postQuery.data.post}
              postId={postId}
              onCommentDeleted={handleCommentDeleted}
              revealedComments={revealedComments}
              revealingCommentId={
                revealCommentMutation.isPending
                  ? revealCommentMutation.variables
                  : null
              }
            />
          </>
        )}
      </div>
    </AuthenticatedAppShell>
  );
};
