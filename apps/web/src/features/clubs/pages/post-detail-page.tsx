import { Link, useParams } from "react-router-dom";
import { ArrowLeft, LockKeyhole, RefreshCw } from "lucide-react";

import { AuthenticatedAppShell } from "@/features/auth/components/authenticated-app-shell";
import { PostCard } from "@/features/clubs/components/club-feed-tab";
import { ApiError } from "@/shared/api/api-client";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader } from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";

import { usePostQuery } from "../api/clubs.js";

export const PostDetailPage = () => {
  const { postId = "" } = useParams();
  const postQuery = usePostQuery(postId);

  return (
    <AuthenticatedAppShell>
      <div className="mx-auto max-w-3xl space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/app/explore">
            <ArrowLeft />
            Explore
          </Link>
        </Button>

        {postQuery.isPending ? (
          <PostDetailLoading />
        ) : postQuery.isError ? (
          <PostDetailError
            error={postQuery.error}
            onRetry={() => void postQuery.refetch()}
          />
        ) : (
          <PostCard post={postQuery.data.post} />
        )}
      </div>
    </AuthenticatedAppShell>
  );
};

const PostDetailLoading = () => (
  <Card>
    <CardHeader className="space-y-3">
      <Skeleton className="h-5 w-56" />
      <Skeleton className="h-4 w-36" />
    </CardHeader>
    <CardContent className="space-y-3">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-4/5" />
      <Skeleton className="h-10 w-full" />
    </CardContent>
  </Card>
);

const PostDetailError = ({
  error,
  onRetry
}: {
  error: Error;
  onRetry: () => void;
}) => {
  const isNotFound = error instanceof ApiError && error.statusCode === 404;

  return (
    <Card>
      <CardContent className="flex min-h-64 flex-col justify-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-lg border border-default bg-inset text-warning">
          <LockKeyhole className="size-5" />
        </span>
        <div>
          <h1 className="text-lg font-semibold text-primary">
            {isNotFound ? "Post not found" : "Could not load post"}
          </h1>
          <p className="mt-1 max-w-lg text-sm leading-6 text-muted">
            {isNotFound
              ? "This post is unavailable from your account."
              : "Refresh the post and try again."}
          </p>
        </div>
        {isNotFound ? null : (
          <Button className="w-fit" variant="secondary" onClick={onRetry}>
            <RefreshCw />
            Retry
          </Button>
        )}
      </CardContent>
    </Card>
  );
};
