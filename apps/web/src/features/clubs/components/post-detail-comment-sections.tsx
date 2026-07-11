import { useMemo, useState } from "react";
import { ChevronDown, MessageSquareText } from "lucide-react";

import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader } from "@/shared/components/ui/card";

import {
  type Comment,
  type ClubPostCard,
  type RevealedComment,
  useClubMilestonesQuery
} from "../api/clubs.js";
import { CommentForm } from "./post-comment-form.js";
import { CommentThreadBlock, CommentsEmpty, CommentsError, CommentsLoading } from "./post-comment-thread.js";

export const CommentsPanel = ({
  clubLinkName,
  comments,
  error,
  hasNextPage,
  isError,
  isFetchingNextPage,
  isLoading,
  onLoadMore,
  onCommentDeleted,
  onRevealComment,
  onRetry,
  post,
  postId,
  revealedComments,
  revealingCommentId
}: {
  clubLinkName: string;
  comments: Comment[];
  error: Error | null;
  hasNextPage: boolean;
  isError: boolean;
  isFetchingNextPage: boolean;
  isLoading: boolean;
  onLoadMore: () => void;
  onCommentDeleted: (commentId: string) => void;
  onRevealComment: (commentId: string) => void;
  onRetry: () => void;
  post: ClubPostCard;
  postId: string;
  revealedComments: Record<string, RevealedComment>;
  revealingCommentId: string | null;
}) => {
  const [replyParentId, setReplyParentId] = useState<string | null>(null);
  const threads = useMemo(() => buildCommentThreads(comments), [comments]);
  const milestonesQuery = useClubMilestonesQuery(
    clubLinkName,
    1,
    post.visibility === "VISIBLE"
  );
  const milestones = milestonesQuery.data?.milestones ?? [];

  return (
    <Card>
      <CardHeader className="space-y-1">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-base font-semibold text-primary">
            <MessageSquareText className="size-5 text-brand" />
            Comments
          </h2>
          <span className="text-xs text-faint">{post.counts.commentCount}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {post.visibility === "VISIBLE" ? (
          <CommentForm
            baseMilestone={post.requiredMilestone}
            label="Add a comment"
            milestones={milestones}
            milestoneHelp={
              milestonesQuery.isError
                ? "Could not load advanced milestone options."
                : undefined
            }
            postId={postId}
            submitLabel="Post comment"
          />
        ) : (
          <div className="rounded-lg border border-default bg-inset p-4 text-sm text-muted">
            Reach the required milestone to join this discussion.
          </div>
        )}

        {isLoading ? (
          <CommentsLoading />
        ) : isError ? (
          <CommentsError error={error} onRetry={onRetry} />
        ) : comments.length === 0 ? (
          <CommentsEmpty />
        ) : (
          <>
            <div className="space-y-3">
              {threads.map((thread) => (
                <CommentThreadBlock
                  key={thread.parent.id}
                  milestones={milestones}
                  onReply={(commentId) => setReplyParentId(commentId)}
                  onReplyCancel={() => setReplyParentId(null)}
                  onCommentDeleted={onCommentDeleted}
                  onRevealComment={onRevealComment}
                  postId={postId}
                  revealedComments={revealedComments}
                  revealingCommentId={revealingCommentId}
                  replyParentId={replyParentId}
                  thread={thread}
                />
              ))}
            </div>
            {hasNextPage ? (
              <div className="flex flex-col gap-3 rounded-xl border border-default bg-surface p-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted">
                  {comments.length} comments loaded
                </p>
                <Button
                  className="w-full sm:w-fit"
                  type="button"
                  variant="secondary"
                  disabled={isFetchingNextPage}
                  onClick={onLoadMore}
                >
                  <ChevronDown />
                  {isFetchingNextPage ? "Loading..." : "Load more"}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export type CommentThread = {
  parent: Comment;
  replies: Comment[];
};

const buildCommentThreads = (comments: Comment[]): CommentThread[] => {
  const commentIds = new Set(comments.map((comment) => comment.id));
  const repliesByParent = new Map<string, Comment[]>();
  const parents: Comment[] = [];

  for (const comment of comments) {
    if (comment.parentId && commentIds.has(comment.parentId)) {
      repliesByParent.set(comment.parentId, [
        ...(repliesByParent.get(comment.parentId) ?? []),
        comment
      ]);
      continue;
    }

    parents.push(comment);
  }

  return parents.map((parent) => ({
    parent,
    replies: repliesByParent.get(parent.id) ?? []
  }));
};
